import type {
  DropdownSentenceQuestion,
  UserAnswer,
} from "../../types/question";
import type { QuestionViewProps } from "./QuestionView";

export function DropdownSentence({
  question,
  value,
  onChange,
  revealed,
}: QuestionViewProps<DropdownSentenceQuestion>) {
  const choices: (number | null)[] =
    value && value.type === "dropdown-sentence"
      ? value.choices
      : question.blanks.map(() => null);

  function set(idx: number, opt: number) {
    if (revealed) return;
    const next = choices.slice();
    next[idx] = opt;
    onChange({ type: "dropdown-sentence", choices: next } satisfies UserAnswer);
  }

  // Split template on `{{N}}` markers.
  const parts: Array<{ kind: "text"; value: string } | { kind: "blank"; index: number }> = [];
  const re = /\{\{(\d+)\}\}/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(question.template)) !== null) {
    if (m.index > last) parts.push({ kind: "text", value: question.template.slice(last, m.index) });
    parts.push({ kind: "blank", index: parseInt(m[1], 10) });
    last = m.index + m[0].length;
  }
  if (last < question.template.length) {
    parts.push({ kind: "text", value: question.template.slice(last) });
  }

  return (
    <div className="leading-relaxed text-lg">
      {parts.map((p, idx) => {
        if (p.kind === "text") return <span key={idx}>{p.value}</span>;
        const blank = question.blanks[p.index];
        if (!blank) return null;
        const userVal = choices[p.index];
        const isCorrect = revealed && userVal === blank.answer;
        const isWrong = revealed && userVal !== null && userVal !== blank.answer;
        return (
          <span key={idx} className="inline-block align-middle mx-1 my-1">
            <select
              disabled={revealed}
              value={userVal ?? ""}
              onChange={(e) => set(p.index, parseInt(e.target.value, 10))}
              className={`rounded border px-2 py-1 ${
                isCorrect
                  ? "border-green-500 bg-green-50"
                  : isWrong
                  ? "border-red-500 bg-red-50"
                  : "border-slate-400 bg-white"
              }`}
              aria-label={`Blank ${p.index + 1}`}
            >
              <option value="" disabled>
                -- select --
              </option>
              {blank.options.map((o, i) => (
                <option key={i} value={i}>
                  {o}
                </option>
              ))}
            </select>
            {revealed && (
              <span className="ml-2 text-sm">
                (correct: <strong>{blank.options[blank.answer]}</strong>)
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
}
