// Flexible plain-text question parser. Two layouts are supported:
//
// 1) Line-oriented:
//      Q1. Prompt?
//      A. Option one
//      B. Option two *
//      Answer: B
//      Explanation: ...
//
// 2) Inline (common in Word-exported practice exams):
//      Q1. (Single Choice) Prompt...   A. one   B. two   C. three   D. four
//      Answer: C. three   Skill Area: ...   Explanation: ...
//
// Question headers: Q1., Q1), Question 1:, 1., 1), Q:.
// Answers: `Answer: B`, `Answer: A and D`, `Answer: A, B, and C`, `Answer: C. Contributor`.

import type { Question } from "../types/question";
import { validateBank, type ParseResult } from "./validate";

const Q_HEADER = /^\s*(?:Q(?:uestion)?\s*(\d+)\s*[:.)\-]?|(\d+)\s*[.)])\s*(.*)$/i;
const OPTION_LINE = /^\s*\(?([A-Ha-h])\)?\s*[.):\-]?\s+(.+?)(\s*[*✓])?\s*$/;
const ANSWER_LINE =
  /^\s*(?:Correct\s+answer\s+is|Answer\s+is|Answers?|Correct(?:\s+answer)?)\s*[:.\-]?\s*(.+)$/i;
const EXPL_LINE = /^\s*(?:Explanation|Explain|Rationale|Reason)\s*[:.\-]\s*(.+)$/i;
const TAGS_LINE = /^\s*Tags?\s*[:.\-]\s*(.+)$/i;
const SKILL_LINE = /^\s*Skill\s*Areas?\s*[:.\-]\s*(.+)$/i;

// Inline option boundary: 2+ spaces, then a letter, then a separator. Used to
// split a single-line "prompt   A. one   B. two   C. three" into pieces.
const INLINE_OPTION_SPLIT = /\s{2,}\(?([A-H])\)?\s*[.):\-]\s+/g;

function lettersToIndices(s: string): number[] {
  // Take only the leading letter sequence so we don't pick up letters from
  // trailing prose like "Answer: A. Contributor   Skill Area: ...".
  const out: number[] = [];
  const re = /([A-H])(?!\w)/g;
  let lastEnd = -1;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) {
    if (lastEnd === -1) {
      if (m.index > 3) break; // first letter must be near the start
    } else {
      const between = s.slice(lastEnd, m.index);
      if (!/^[\s,.&]*(?:and|or)?[\s,.&]*$/i.test(between)) break;
    }
    out.push(m[1].toUpperCase().charCodeAt(0) - 65);
    lastEnd = m.index + 1;
  }
  return [...new Set(out)];
}

function splitInlineOptions(
  line: string,
): { prompt: string; options: string[] } | null {
  INLINE_OPTION_SPLIT.lastIndex = 0;
  const first = INLINE_OPTION_SPLIT.exec(line);
  if (!first) return null;
  const prompt = line.slice(0, first.index).trim();
  if (!prompt) return null;

  const boundaries: { letter: string; start: number; textStart: number }[] = [];
  INLINE_OPTION_SPLIT.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = INLINE_OPTION_SPLIT.exec(line)) !== null) {
    boundaries.push({
      letter: m[1].toUpperCase(),
      start: m.index,
      textStart: m.index + m[0].length,
    });
  }
  if (boundaries.length < 2) return null;
  // Determine highest letter to size the array.
  const maxIdx = Math.max(
    ...boundaries.map((b) => b.letter.charCodeAt(0) - 65),
  );
  const options: string[] = new Array(maxIdx + 1).fill("");
  for (let i = 0; i < boundaries.length; i++) {
    const end = i + 1 < boundaries.length ? boundaries[i + 1].start : line.length;
    const idx = boundaries[i].letter.charCodeAt(0) - 65;
    options[idx] = line.slice(boundaries[i].textStart, end).trim();
  }
  return { prompt, options };
}

interface Draft {
  prompt: string;
  options: string[];
  starred: Set<number>;
  answer?: number[];
  explanation?: string;
  tags?: string[];
  isOrdering?: boolean;
}

function flush(d: Draft | null, out: Question[]) {
  if (!d) return;
  if (d.isOrdering) return; // skip ordering questions — not handled here
  if (!d.prompt || d.options.length < 2) return;
  const correct =
    d.answer && d.answer.length > 0
      ? d.answer
      : [...d.starred].sort((a, b) => a - b);
  if (correct.length === 0) return;
  const validCorrect = correct.filter((i) => i >= 0 && i < d.options.length);
  if (validCorrect.length === 0) return;
  const id = `txt-q-${out.length + 1}`;
  if (validCorrect.length === 1) {
    out.push({
      id,
      type: "single",
      prompt: d.prompt,
      options: d.options,
      answer: validCorrect[0],
      explanation: d.explanation,
      tags: d.tags,
    });
  } else {
    out.push({
      id,
      type: "multiple",
      prompt: d.prompt,
      options: d.options,
      answer: validCorrect,
      selectCount: validCorrect.length,
      explanation: d.explanation,
      tags: d.tags,
    });
  }
}

function appendExplanation(d: Draft, extra: string) {
  d.explanation = d.explanation ? d.explanation + " " + extra : extra;
}

export function parseText(text: string, name = "Imported Bank"): ParseResult {
  // Normalise smart punctuation.
  const normalised = text
    .replace(/\u2019|\u2018/g, "'")
    .replace(/\u201c|\u201d/g, '"')
    .replace(/\u2013|\u2014/g, "-");
  const lines = normalised.split(/\r?\n/);
  const out: Question[] = [];
  let cur: Draft | null = null;
  let skipping = false;

  function startNew(prompt: string, inlineOptions?: string[], ordering = false) {
    flush(cur, out);
    cur = {
      prompt: prompt.trim(),
      options: inlineOptions ? [...inlineOptions] : [],
      starred: new Set(),
      isOrdering: ordering,
    };
    skipping = ordering;
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const headerMatch = line.match(Q_HEADER);
    if (headerMatch) {
      const rest = (headerMatch[3] || "").trim();
      const isOrdering = /\(\s*(?:Ordering|Sequence|Drag\s*and\s*drop|Hot\s*area)/i.test(
        rest,
      );
      const inline = splitInlineOptions(rest);
      if (inline && !isOrdering) {
        startNew(inline.prompt, inline.options);
      } else {
        startNew(rest, undefined, isOrdering);
      }
      continue;
    }

    if (!cur) continue;
    const d: Draft = cur;
    if (skipping) {
      if (ANSWER_LINE.test(line)) skipping = false;
      continue;
    }

    const ansMatch = line.match(ANSWER_LINE);
    if (ansMatch) {
      const ansBody = ansMatch[1];
      d.answer = lettersToIndices(ansBody);
      const explIdx = ansBody.search(/\bExplanation\s*[:.\-]/i);
      if (explIdx >= 0) {
        appendExplanation(
          d,
          ansBody
            .slice(explIdx)
            .replace(/^Explanation\s*[:.\-]\s*/i, "")
            .trim(),
        );
      }
      const skillSeg = ansBody.match(
        /Skill\s*Areas?\s*[:.\-]\s*([^]*?)(?:\bExplanation\s*[:.\-]|$)/i,
      );
      if (skillSeg) {
        const tagText = skillSeg[1].trim().replace(/[.;]\s*$/, "");
        if (tagText) {
          d.tags = tagText
            .split(/[;,]/)
            .map((t) => t.trim())
            .filter(Boolean)
            .slice(0, 6);
        }
      }
      continue;
    }
    const explMatch = line.match(EXPL_LINE);
    if (explMatch) {
      appendExplanation(d, explMatch[1].trim());
      continue;
    }
    const tagsMatch = line.match(TAGS_LINE);
    if (tagsMatch) {
      d.tags = tagsMatch[1]
        .split(/[;,]/)
        .map((t) => t.trim())
        .filter(Boolean);
      continue;
    }
    const skillMatch = line.match(SKILL_LINE);
    if (skillMatch && !d.tags) {
      d.tags = skillMatch[1]
        .split(/[;,]/)
        .map((t) => t.trim())
        .filter(Boolean);
      continue;
    }

    // After answer captured, treat further lines as explanation.
    if (d.answer && d.answer.length > 0) {
      appendExplanation(d, line);
      continue;
    }

    // Option (line-oriented).
    const optMatch = line.match(OPTION_LINE);
    if (optMatch && d.options.length < 8) {
      const idx = optMatch[1].toUpperCase().charCodeAt(0) - 65;
      const optText = optMatch[2].trim();
      const starred = !!optMatch[3];
      while (d.options.length < idx) d.options.push("");
      d.options[idx] = optText;
      if (starred) d.starred.add(idx);
      continue;
    }

    // Prompt continuation.
    if (d.options.length === 0) {
      d.prompt = d.prompt ? d.prompt + " " + line : line;
    }
  }
  flush(cur, out);

  if (out.length === 0) {
    const preview = normalised.replace(/\s+/g, " ").slice(0, 600);
    return {
      errors: [
        "No questions found. Each question should start with a header like `Q1.` or `1.` and be followed by lettered options (`A.`, `B.`, ...). Mark correct option(s) with `*` after the text or add an `Answer: B` line.",
        `Preview of extracted text (first 600 chars): ${preview}`,
      ],
    };
  }

  return validateBank({ name, questions: out });
}
