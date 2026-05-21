import type { YesNoSeriesQuestion, UserAnswer } from "../../types/question";
import type { QuestionViewProps } from "./QuestionView";

export function YesNoSeries({
  question,
  value,
  onChange,
  revealed,
}: QuestionViewProps<YesNoSeriesQuestion>) {
  const values: ("yes" | "no" | null)[] =
    value && value.type === "yesno-series"
      ? value.values
      : question.statements.map(() => null);

  function set(i: number, v: "yes" | "no") {
    if (revealed) return;
    const next = values.slice();
    next[i] = v;
    onChange({ type: "yesno-series", values: next } satisfies UserAnswer);
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">
        Each statement is evaluated independently. You cannot revisit a statement after
        the whole series is submitted.
      </p>
      {question.statements.map((s, i) => {
        const userVal = values[i];
        const correct = s.answer;
        const isCorrect = revealed && userVal === correct;
        const isWrong = revealed && userVal !== null && userVal !== correct;
        return (
          <div
            key={i}
            className={`rounded border p-3 ${
              isCorrect
                ? "border-green-500 bg-green-50"
                : isWrong
                ? "border-red-500 bg-red-50"
                : "border-slate-300"
            }`}
          >
            <p className="mb-2">
              <span className="mr-2 text-slate-500">{i + 1}.</span>
              {s.statement}
            </p>
            <div className="flex gap-2">
              {(["yes", "no"] as const).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  disabled={revealed}
                  onClick={() => set(i, opt)}
                  className={`px-4 py-1.5 rounded border text-sm font-medium ${
                    userVal === opt
                      ? "bg-msblue-500 text-white border-msblue-500"
                      : "bg-white border-slate-300 hover:bg-slate-50"
                  } disabled:opacity-70`}
                >
                  {opt === "yes" ? "Yes" : "No"}
                </button>
              ))}
              {revealed && (
                <span className="ml-3 text-sm self-center">
                  Correct: <strong>{correct === "yes" ? "Yes" : "No"}</strong>
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
