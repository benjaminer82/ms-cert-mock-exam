import { useState, useEffect } from "react";
import type { BuildListQuestion, UserAnswer } from "../../types/question";
import type { QuestionViewProps } from "./QuestionView";

export function BuildList({
  question,
  value,
  onChange,
  revealed,
}: QuestionViewProps<BuildListQuestion>) {
  const initial = value && value.type === "build-list" ? value.order : [];
  const [chosen, setChosen] = useState<string[]>(initial);

  useEffect(() => {
    onChange({ type: "build-list", order: chosen } satisfies UserAnswer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chosen]);

  const remaining = question.pool.filter((p) => !chosen.includes(p));

  function add(item: string) {
    if (revealed) return;
    setChosen([...chosen, item]);
  }
  function removeAt(i: number) {
    if (revealed) return;
    setChosen(chosen.filter((_, idx) => idx !== i));
  }
  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= chosen.length) return;
    const next = chosen.slice();
    [next[i], next[j]] = [next[j], next[i]];
    setChosen(next);
  }

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <div>
        <h3 className="text-sm font-semibold mb-2 text-slate-600 uppercase tracking-wide">
          Available
        </h3>
        <ul className="space-y-2">
          {remaining.map((item) => (
            <li key={item}>
              <button
                type="button"
                onClick={() => add(item)}
                disabled={revealed}
                className="w-full text-left rounded border border-slate-300 bg-white p-2 hover:bg-slate-50 disabled:opacity-60"
              >
                {item}
              </button>
            </li>
          ))}
          {remaining.length === 0 && (
            <li className="text-sm text-slate-500 italic">All items used.</li>
          )}
        </ul>
      </div>
      <div>
        <h3 className="text-sm font-semibold mb-2 text-slate-600 uppercase tracking-wide">
          Your sequence
        </h3>
        <ol className="space-y-2">
          {chosen.map((item, i) => {
            const correctAtI = question.answer[i];
            const isCorrect = revealed && correctAtI === item;
            const isWrong = revealed && correctAtI !== item;
            return (
              <li
                key={item + i}
                className={`flex items-center gap-2 rounded border p-2 ${
                  isCorrect
                    ? "border-green-500 bg-green-50"
                    : isWrong
                    ? "border-red-500 bg-red-50"
                    : "border-slate-300 bg-white"
                }`}
              >
                <span className="w-6 text-slate-500 font-mono">{i + 1}.</span>
                <span className="flex-1">{item}</span>
                {!revealed && (
                  <>
                    <button
                      type="button"
                      onClick={() => move(i, -1)}
                      aria-label="Move up"
                      className="px-2 py-1 text-sm border rounded"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => move(i, 1)}
                      aria-label="Move down"
                      className="px-2 py-1 text-sm border rounded"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() => removeAt(i)}
                      aria-label="Remove"
                      className="px-2 py-1 text-sm border rounded text-red-700"
                    >
                      ✕
                    </button>
                  </>
                )}
              </li>
            );
          })}
          {chosen.length === 0 && (
            <li className="text-sm text-slate-500 italic">
              Click items on the left to build the sequence.
            </li>
          )}
        </ol>
        {revealed && (
          <div className="mt-3 text-sm">
            <strong>Correct sequence:</strong>
            <ol className="list-decimal ml-6 mt-1">
              {question.answer.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}
