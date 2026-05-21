import { validateBank, type ParseResult } from "./validate";

export function parseJson(text: string): ParseResult {
  try {
    const parsed = JSON.parse(text);
    return validateBank(parsed);
  } catch (e) {
    return { errors: [`Invalid JSON: ${(e as Error).message}`] };
  }
}
