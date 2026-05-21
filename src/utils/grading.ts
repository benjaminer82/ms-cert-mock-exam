import type {
  Question,
  UserAnswer,
  Verdict,
  SingleChoiceQuestion,
  MultipleChoiceQuestion,
  YesNoSeriesQuestion,
  DragOrderQuestion,
  BuildListQuestion,
  DropdownSentenceQuestion,
  HotAreaQuestion,
  CaseStudyQuestion,
} from "../types/question";

export function gradeQuestion(q: Question, a: UserAnswer | null): Verdict {
  if (a === null) return "skipped";

  switch (q.type) {
    case "single":
      return gradeSingle(q, a);
    case "multiple":
      return gradeMultiple(q, a);
    case "yesno-series":
      return gradeYesNo(q, a);
    case "drag-order":
      return gradeDragOrder(q, a);
    case "build-list":
      return gradeBuildList(q, a);
    case "dropdown-sentence":
      return gradeDropdown(q, a);
    case "hot-area":
      return gradeHotArea(q, a);
    case "case-study":
      return gradeCaseStudy(q, a);
  }
}

function gradeSingle(q: SingleChoiceQuestion, a: UserAnswer): Verdict {
  if (a.type !== "single") return "incorrect";
  if (a.choice === null) return "skipped";
  return a.choice === q.answer ? "correct" : "incorrect";
}

function gradeMultiple(q: MultipleChoiceQuestion, a: UserAnswer): Verdict {
  if (a.type !== "multiple") return "incorrect";
  if (a.choices.length === 0) return "skipped";
  const correctSet = new Set(q.answer);
  const userSet = new Set(a.choices);
  const correctHits = a.choices.filter((c) => correctSet.has(c)).length;
  const allCorrect =
    userSet.size === correctSet.size &&
    [...userSet].every((c) => correctSet.has(c));
  if (allCorrect) return "correct";
  if (correctHits > 0) return "partial";
  return "incorrect";
}

function gradeYesNo(q: YesNoSeriesQuestion, a: UserAnswer): Verdict {
  if (a.type !== "yesno-series") return "incorrect";
  if (a.values.every((v) => v === null)) return "skipped";
  let correctCount = 0;
  q.statements.forEach((s, i) => {
    if (a.values[i] === s.answer) correctCount += 1;
  });
  if (correctCount === q.statements.length) return "correct";
  if (correctCount === 0) return "incorrect";
  return "partial";
}

function gradeDragOrder(q: DragOrderQuestion, a: UserAnswer): Verdict {
  if (a.type !== "drag-order") return "incorrect";
  if (a.order.length === 0) return "skipped";
  const ok = q.items.every((item, i) => a.order[i] === item);
  return ok ? "correct" : "incorrect";
}

function gradeBuildList(q: BuildListQuestion, a: UserAnswer): Verdict {
  if (a.type !== "build-list") return "incorrect";
  if (a.order.length === 0) return "skipped";
  const exact =
    a.order.length === q.answer.length &&
    a.order.every((it, i) => it === q.answer[i]);
  if (exact) return "correct";
  // Partial credit: any correct items in any position
  const correctSet = new Set(q.answer);
  const hit = a.order.filter((it) => correctSet.has(it)).length;
  if (hit > 0) return "partial";
  return "incorrect";
}

function gradeDropdown(q: DropdownSentenceQuestion, a: UserAnswer): Verdict {
  if (a.type !== "dropdown-sentence") return "incorrect";
  if (a.choices.every((c) => c === null)) return "skipped";
  let correct = 0;
  q.blanks.forEach((b, i) => {
    if (a.choices[i] === b.answer) correct += 1;
  });
  if (correct === q.blanks.length) return "correct";
  if (correct === 0) return "incorrect";
  return "partial";
}

function gradeHotArea(q: HotAreaQuestion, a: UserAnswer): Verdict {
  if (a.type !== "hot-area") return "incorrect";
  if (a.choice === null) return "skipped";
  return q.options[a.choice]?.isCorrect ? "correct" : "incorrect";
}

function gradeCaseStudy(q: CaseStudyQuestion, a: UserAnswer): Verdict {
  if (a.type !== "case-study") return "incorrect";
  const verdicts = q.subQuestions.map((sq, i) =>
    gradeQuestion(sq, a.subAnswers[i])
  );
  if (verdicts.every((v) => v === "correct")) return "correct";
  if (verdicts.every((v) => v === "skipped")) return "skipped";
  if (verdicts.every((v) => v === "incorrect" || v === "skipped")) return "incorrect";
  return "partial";
}
