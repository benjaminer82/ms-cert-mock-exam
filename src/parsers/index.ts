import { parseJson } from "./jsonParser";
import { parseMarkdown } from "./markdownParser";
import { parseText } from "./textParser";
import { parseDocx } from "./docxParser";
import type { ParseResult } from "./validate";

export type SupportedFormat = "json" | "markdown" | "text" | "pdf" | "docx";

export function detectFormat(filename: string): SupportedFormat | null {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".json")) return "json";
  if (lower.endsWith(".md") || lower.endsWith(".markdown")) return "markdown";
  if (lower.endsWith(".txt")) return "text";
  if (lower.endsWith(".pdf")) return "pdf";
  if (lower.endsWith(".docx")) return "docx";
  return null;
}

export async function parseFile(file: File): Promise<ParseResult> {
  const fmt = detectFormat(file.name);
  if (!fmt) {
    return {
      errors: [
        "Unsupported file extension. Use .json, .md, .txt, or .docx (PDF coming soon).",
      ],
    };
  }
  if (fmt === "pdf") {
    return {
      errors: [
        "PDF parsing is not yet implemented. Convert to DOCX, Markdown, or JSON. See README for the schema.",
      ],
    };
  }
  if (fmt === "docx") return parseDocx(file);
  const text = await file.text();
  if (fmt === "json") return parseJson(text);
  if (fmt === "markdown") return parseMarkdown(text);
  return parseText(text, file.name);
}

export { parseJson, parseMarkdown, parseText, parseDocx };
export type { ParseResult };
