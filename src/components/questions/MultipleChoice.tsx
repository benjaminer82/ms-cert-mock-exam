import type { MultipleChoiceQuestion, UserAnswer } from "../../types/question";
import type { QuestionViewProps } from "./QuestionView";

export function MultipleChoice({
  question,
  value,
  onChange,
  revealed,
}: QuestionViewProps<MultipleChoiceQuestion>) {
  const selected =
    value && value.type === "multiple" ? new Set(value.choices) : new Set<number>();
  const correctSet = new Set(question.answer);

  function toggle(i: number) {
    if (revealed) return;
    const next = new Set(selected);
    if (next.has(i)) next.delete(i);
    else next.add(i);
    onChange({ type: "multiple", choices: [...next].sort((a, b) => a - b) } satisfies UserAnswer);
  }

  return (
    <fieldset className="space-y-2">
      {question.selectCount && (
        <legend className="text-sm text-slate-600 mb-1">
          Select <strong>{question.selectCount}</strong>.
        </legend>
      )}
      {question.options.map((opt, i) => {
        const isSelected = selected.has(i);
        const isCorrect = correctSet.has(i);
        const showCorrect = revealed && isCorrect;
        const showWrong = revealed && isSelected && !isCorrect;
        return (
          <label
            key={i}
            className={`flex items-start gap-3 rounded border p-3 cursor-pointer transition ${
              showCorrect
                ? "border-green-500 bg-green-50"
                : showWrong
                ? "border-red-500 bg-red-50"
                : isSelected
                ? "border-msblue-500 bg-msblue-50"
                : "border-slate-300 hover:bg-slate-50"
            } ${revealed ? "cursor-default" : ""}`}
          >
            <input
              type="checkbox"
              className="mt-1"
              checked={isSelected}
              disabled={revealed}
              onChange={() => toggle(i)}
              aria-label={`Option ${i + 1}: ${opt}`}
            />
            <span className="flex-1 leading-snug">
              <span className="mr-2 inline-block w-5 text-slate-500">{i + 1}.</span>
              {opt}
              {showCorrect && (
                <span className="ml-2 text-green-700 font-semibold">✓ correct</span>
              )}
              {showWrong && (
                <span className="ml-2 text-red-700 font-semibold">✗ your answer</span>
              )}
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}
