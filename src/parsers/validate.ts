import type { Question, QuestionBank, QuestionType } from "../types/question";

export interface ParseResult {
  bank?: QuestionBank;
  errors: string[];
}

const VALID_TYPES: QuestionType[] = [
  "single",
  "multiple",
  "yesno-series",
  "drag-order",
  "build-list",
  "dropdown-sentence",
  "hot-area",
  "case-study",
];

/** Validate a parsed bank in-place; returns list of error messages. */
export function validateBank(raw: unknown): ParseResult {
  const errors: string[] = [];
  if (!raw || typeof raw !== "object") {
    return { errors: ["Top-level document must be a JSON object."] };
  }
  const obj = raw as Record<string, unknown>;
  const list = obj.questions;
  if (!Array.isArray(list)) {
    return { errors: ["Document must contain a `questions` array."] };
  }

  const seen = new Set<string>();
  const validated: Question[] = [];

  list.forEach((q, i) => {
    const ctx = `questions[${i}]`;
    if (!q || typeof q !== "object") {
      errors.push(`${ctx}: must be an object`);
      return;
    }
    const r = q as Record<string, unknown>;
    if (typeof r.id !== "string" || !r.id) {
      errors.push(`${ctx}: missing string \`id\``);
      return;
    }
    if (seen.has(r.id)) {
      errors.push(`${ctx}: duplicate id "${r.id}"`);
    }
    seen.add(r.id);
    if (!VALID_TYPES.includes(r.type as QuestionType)) {
      errors.push(`${ctx} (${r.id}): invalid type "${String(r.type)}"`);
      return;
    }
    if (typeof r.prompt !== "string" || !r.prompt) {
      errors.push(`${ctx} (${r.id}): missing string \`prompt\``);
      return;
    }
    const typeErrors = validateByType(r, ctx);
    errors.push(...typeErrors);
    if (typeErrors.length === 0) {
      validated.push(r as unknown as Question);
    }
  });

  if (errors.length > 0 && validated.length === 0) {
    return { errors };
  }

  return {
    bank: {
      name: typeof obj.name === "string" ? obj.name : undefined,
      certification:
        typeof obj.certification === "string" ? obj.certification : undefined,
      questions: validated,
    },
    errors,
  };
}

function validateByType(q: Record<string, unknown>, ctx: string): string[] {
  const errs: string[] = [];
  const id = q.id;
  switch (q.type) {
    case "single": {
      if (!Array.isArray(q.options) || q.options.length < 2)
        errs.push(`${ctx} (${id}): \`options\` must be a string array with >=2 items`);
      if (typeof q.answer !== "number")
        errs.push(`${ctx} (${id}): \`answer\` must be a number`);
      break;
    }
    case "multiple": {
      if (!Array.isArray(q.options) || q.options.length < 2)
        errs.push(`${ctx} (${id}): \`options\` must be a string array with >=2 items`);
      if (!Array.isArray(q.answer) || (q.answer as unknown[]).length === 0)
        errs.push(`${ctx} (${id}): \`answer\` must be a non-empty number[]`);
      break;
    }
    case "yesno-series": {
      const s = q.statements;
      if (!Array.isArray(s) || s.length === 0)
        errs.push(`${ctx} (${id}): \`statements\` must be a non-empty array`);
      break;
    }
    case "drag-order": {
      if (!Array.isArray(q.items) || (q.items as unknown[]).length < 2)
        errs.push(`${ctx} (${id}): \`items\` must be an array with >=2 items`);
      break;
    }
    case "build-list": {
      if (!Array.isArray(q.pool) || !Array.isArray(q.answer))
        errs.push(`${ctx} (${id}): build-list needs \`pool\` and \`answer\` arrays`);
      break;
    }
    case "dropdown-sentence": {
      if (typeof q.template !== "string")
        errs.push(`${ctx} (${id}): missing string \`template\``);
      if (!Array.isArray(q.blanks) || (q.blanks as unknown[]).length === 0)
        errs.push(`${ctx} (${id}): \`blanks\` must be a non-empty array`);
      break;
    }
    case "hot-area": {
      if (!Array.isArray(q.options) || (q.options as unknown[]).length === 0)
        errs.push(`${ctx} (${id}): \`options\` must be a non-empty array`);
      break;
    }
    case "case-study": {
      if (typeof q.scenario !== "string")
        errs.push(`${ctx} (${id}): missing string \`scenario\``);
      if (!Array.isArray(q.subQuestions) || (q.subQuestions as unknown[]).length === 0)
        errs.push(`${ctx} (${id}): \`subQuestions\` must be a non-empty array`);
      break;
    }
  }
  return errs;
}
