import { parseJson } from "./jsonParser";
import { parseMarkdown } from "./markdownParser";
import type { ParseResult } from "./validate";

export type SupportedFormat = "json" | "markdown" | "pdf" | "docx";

export function detectFormat(filename: string): SupportedFormat | null {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".json")) return "json";
  if (lower.endsWith(".md") || lower.endsWith(".markdown")) return "markdown";
  if (lower.endsWith(".pdf")) return "pdf";
  if (lower.endsWith(".docx")) return "docx";
  return null;
}

export async function parseFile(file: File): Promise<ParseResult> {
  const fmt = detectFormat(file.name);
  if (!fmt) {
    return {
      errors: [
        `Unsupported file extension. Use .json, .md, .pdf, or .docx (PDF/DOCX coming soon).`,
      ],
    };
  }
  if (fmt === "pdf" || fmt === "docx") {
    return {
      errors: [
        `${fmt.toUpperCase()} parsing is not yet implemented. Convert to Markdown or JSON, or open the file and paste into the JSON template. See README for the schema.`,
      ],
    };
  }
  const text = await file.text();
  if (fmt === "json") return parseJson(text);
  return parseMarkdown(text);
}

export { parseJson, parseMarkdown };
export type { ParseResult };
