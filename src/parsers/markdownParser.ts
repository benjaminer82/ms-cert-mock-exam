// Minimal Markdown parser for question banks.
// Supports `single` and `multiple` type questions in a friendly format:
//
// # Question Bank Name
// > certification: AZ-104
//
// ## Q: Which Azure service provides a managed Kubernetes cluster?
// - [ ] Azure Container Instances
// - [x] Azure Kubernetes Service
// - [ ] Azure Service Fabric
// - [ ] Azure App Service
// > Explanation: AKS is the managed Kubernetes offering.
// > Tags: Compute, Containers
//
// Multiple-answer is auto-detected (more than one `[x]`).
// Other question types are not supported in Markdown — use JSON for those.

import type { Question } from "../types/question";
import { validateBank, type ParseResult } from "./validate";

export function parseMarkdown(text: string): ParseResult {
  const lines = text.split(/\r?\n/);
  const bank: { name?: string; certification?: string; questions: Question[] } = {
    questions: [],
  };

  let i = 0;
  let bankHeaderHandled = false;

  // Skip leading blanks
  while (i < lines.length && lines[i].trim() === "") i++;

  if (i < lines.length && lines[i].startsWith("# ")) {
    bank.name = lines[i].slice(2).trim();
    i++;
    bankHeaderHandled = true;
  }

  // Optional bank-level meta blockquotes
  while (i < lines.length && lines[i].startsWith(">")) {
    const meta = lines[i].slice(1).trim();
    const m = meta.match(/^certification:\s*(.+)$/i);
    if (m) bank.certification = m[1].trim();
    i++;
  }

  let qIndex = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith("## ")) {
      const promptMatch = line.replace(/^## (Q:\s*)?/i, "").trim();
      const options: string[] = [];
      const answer: number[] = [];
      let explanation: string | undefined;
      let tags: string[] | undefined;
      i++;

      while (i < lines.length && !lines[i].startsWith("## ")) {
        const l = lines[i];
        const opt = l.match(/^\s*-\s*\[( |x|X)\]\s*(.+)$/);
        if (opt) {
          if (opt[1].toLowerCase() === "x") answer.push(options.length);
          options.push(opt[2].trim());
        } else if (l.startsWith(">")) {
          const meta = l.slice(1).trim();
          const e = meta.match(/^Explanation:\s*(.+)$/i);
          const t = meta.match(/^Tags:\s*(.+)$/i);
          if (e) explanation = e[1].trim();
          else if (t) tags = t[1].split(",").map((s) => s.trim()).filter(Boolean);
        }
        i++;
      }

      if (options.length >= 2 && answer.length >= 1) {
        qIndex++;
        if (answer.length === 1) {
          bank.questions.push({
            id: `md-q-${qIndex}`,
            type: "single",
            prompt: promptMatch,
            options,
            answer: answer[0],
            explanation,
            tags,
          });
        } else {
          bank.questions.push({
            id: `md-q-${qIndex}`,
            type: "multiple",
            prompt: promptMatch,
            options,
            answer,
            selectCount: answer.length,
            explanation,
            tags,
          });
        }
      }
    } else {
      i++;
    }
  }

  if (!bankHeaderHandled && !bank.name) bank.name = "Markdown Question Bank";

  const result: ParseResult = validateBank(bank);
  if (bank.questions.length === 0) {
    result.errors.unshift(
      "No questions found. Markdown questions must use `## Q: ...` headings followed by `- [ ]` / `- [x]` option lists."
    );
  }
  return result;
}
