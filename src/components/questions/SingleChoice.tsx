import type { SingleChoiceQuestion, UserAnswer } from "../../types/question";
import type { QuestionViewProps } from "./QuestionView";

export function SingleChoice({
  question,
  value,
  onChange,
  revealed,
}: QuestionViewProps<SingleChoiceQuestion>) {
  const selected = value && value.type === "single" ? value.choice : null;

  return (
    <fieldset className="space-y-2">
      <legend className="sr-only">Choose one option</legend>
      {question.options.map((opt, i) => {
        const isSelected = selected === i;
        const isCorrect = i === question.answer;
        const showAsCorrect = revealed && isCorrect;
        const showAsWrong = revealed && isSelected && !isCorrect;
        return (
          <label
            key={i}
            className={`flex items-start gap-3 rounded border p-3 cursor-pointer transition ${
              showAsCorrect
                ? "border-green-500 bg-green-50"
                : showAsWrong
                ? "border-red-500 bg-red-50"
                : isSelected
                ? "border-msblue-500 bg-msblue-50"
                : "border-slate-300 hover:bg-slate-50"
            } ${revealed ? "cursor-default" : ""}`}
          >
            <input
              type="radio"
              name={`q-${question.id}`}
              className="mt-1"
              checked={isSelected}
              disabled={revealed}
              onChange={() =>
                onChange({ type: "single", choice: i } satisfies UserAnswer)
              }
              aria-label={`Option ${i + 1}: ${opt}`}
            />
            <span className="flex-1 leading-snug">
              <span className="mr-2 inline-block w-5 text-slate-500">{i + 1}.</span>
              {opt}
              {showAsCorrect && (
                <span className="ml-2 text-green-700 font-semibold">✓ correct</span>
              )}
              {showAsWrong && (
                <span className="ml-2 text-red-700 font-semibold">✗ your answer</span>
              )}
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}
