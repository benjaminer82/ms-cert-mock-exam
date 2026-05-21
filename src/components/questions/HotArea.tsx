import type { HotAreaQuestion, UserAnswer } from "../../types/question";
import type { QuestionViewProps } from "./QuestionView";

export function HotArea({
  question,
  value,
  onChange,
  revealed,
}: QuestionViewProps<HotAreaQuestion>) {
  const selected = value && value.type === "hot-area" ? value.choice : null;

  return (
    <div className="space-y-3">
      {question.imageUrl && (
        <img
          src={question.imageUrl}
          alt="Question reference"
          className="max-w-full rounded border border-slate-300"
        />
      )}
      <p className="text-sm text-slate-600">
        Select the region/label that best answers the question.
      </p>
      <div className="grid sm:grid-cols-2 gap-2">
        {question.options.map((opt, i) => {
          const isSelected = selected === i;
          const showCorrect = revealed && opt.isCorrect;
          const showWrong = revealed && isSelected && !opt.isCorrect;
          return (
            <button
              key={i}
              type="button"
              disabled={revealed}
              onClick={() =>
                onChange({ type: "hot-area", choice: i } satisfies UserAnswer)
              }
              className={`text-left rounded border p-3 transition ${
                showCorrect
                  ? "border-green-500 bg-green-50"
                  : showWrong
                  ? "border-red-500 bg-red-50"
                  : isSelected
                  ? "border-msblue-500 bg-msblue-50"
                  : "border-slate-300 hover:bg-slate-50"
              } disabled:opacity-80`}
            >
              <span className="mr-2 inline-block w-5 text-slate-500">{i + 1}.</span>
              {opt.label}
              {showCorrect && (
                <span className="ml-2 text-green-700 font-semibold">✓</span>
              )}
              {showWrong && (
                <span className="ml-2 text-red-700 font-semibold">✗</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
