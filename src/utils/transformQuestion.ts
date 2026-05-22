import type { Question } from "../types/question";
import { shuffle } from "./helpers";

/**
 * Return a copy of `q` with options re-sequenced and correct-answer indices
 * remapped. Used when re-presenting a question on retake so the user can't
 * pattern-match to a remembered option position. Question types that have no
 * meaningful "shuffle" (build-list, drag-order, case-study, etc.) are returned
 * unchanged.
 */
export function shuffleQuestion(q: Question): Question {
  switch (q.type) {
    case "single": {
      const order = shuffle(q.options.map((_, i) => i));
      const newOptions = order.map((i) => q.options[i]);
      const newAnswer = order.indexOf(q.answer);
      return { ...q, options: newOptions, answer: newAnswer };
    }
    case "multiple": {
      const order = shuffle(q.options.map((_, i) => i));
      const newOptions = order.map((i) => q.options[i]);
      const correctSet = new Set(q.answer);
      const newAnswer = order
        .map((origIdx, newIdx) => (correctSet.has(origIdx) ? newIdx : -1))
        .filter((x) => x >= 0)
        .sort((a, b) => a - b);
      return { ...q, options: newOptions, answer: newAnswer };
    }
    case "hot-area": {
      const order = shuffle(q.options.map((_, i) => i));
      return { ...q, options: order.map((i) => q.options[i]) };
    }
    case "dropdown-sentence": {
      const newBlanks = q.blanks.map((b) => {
        const order = shuffle(b.options.map((_, i) => i));
        return {
          options: order.map((i) => b.options[i]),
          answer: order.indexOf(b.answer),
        };
      });
      return { ...q, blanks: newBlanks };
    }
    default:
      return q;
  }
}
