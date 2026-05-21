import { useCallback, useEffect } from "react";
import { useExamStore } from "../../state/examStore";
import { Timer } from "../Timer";
import { QuestionView } from "../questions/QuestionView";
import { FeedbackPanel } from "../FeedbackPanel";

export function ExamScreen() {
  const {
    queue,
    currentIndex,
    totalPlanned,
    pendingAnswer,
    submittedVerdict,
    setPendingAnswer,
    submitCurrent,
    advanceAfterFeedback,
    endsAt,
    finishExam,
    records,
    retakeCounts,
  } = useExamStore();

  const current = queue[0];
  const revealed = submittedVerdict !== null;

  const onSubmit = useCallback(() => {
    if (!current) return;
    if (revealed) advanceAfterFeedback();
    else submitCurrent();
  }, [current, revealed, advanceAfterFeedback, submitCurrent]);

  // Keyboard shortcuts: Enter (submit/next), digits 1-9 (select option for single/multiple/hot-area)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!current) return;
      const target = e.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;

      if (e.key === "Enter") {
        e.preventDefault();
        onSubmit();
        return;
      }
      if (revealed) return;

      const digit = parseInt(e.key, 10);
      if (Number.isNaN(digit) || digit < 1 || digit > 9) return;

      const idx = digit - 1;
      if (current.question.type === "single") {
        const opts = current.question.options;
        if (idx < opts.length) setPendingAnswer({ type: "single", choice: idx });
      } else if (current.question.type === "multiple") {
        const opts = current.question.options;
        if (idx < opts.length) {
          const cur =
            pendingAnswer && pendingAnswer.type === "multiple"
              ? new Set(pendingAnswer.choices)
              : new Set<number>();
          if (cur.has(idx)) cur.delete(idx);
          else cur.add(idx);
          setPendingAnswer({
            type: "multiple",
            choices: [...cur].sort((a, b) => a - b),
          });
        }
      } else if (current.question.type === "hot-area") {
        const opts = current.question.options;
        if (idx < opts.length) setPendingAnswer({ type: "hot-area", choice: idx });
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current, revealed, pendingAnswer, onSubmit, setPendingAnswer]);

  if (!current) {
    return (
      <div className="max-w-2xl mx-auto p-6 text-center">
        <p>No more questions.</p>
      </div>
    );
  }

  const answeredCount = records.length;
  const retakesPending = queue.length - 1; // very rough

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6">
      <header className="flex items-center justify-between mb-3 gap-3 flex-wrap">
        <div className="text-sm text-slate-600">
          Question <strong>{Math.min(currentIndex + 1, totalPlanned + 99)}</strong> of{" "}
          <strong>{totalPlanned}</strong>
          {current.attempt > 1 && (
            <span className="ml-2 inline-block bg-amber-100 text-amber-800 rounded px-2 py-0.5 text-xs">
              Retake (attempt {current.attempt})
            </span>
          )}
        </div>
        <Timer endsAt={endsAt} onExpire={() => finishExam(true)} />
      </header>

      <div
        className="h-1 bg-slate-200 rounded mb-4 overflow-hidden"
        aria-hidden="true"
      >
        <div
          className="h-full bg-msblue-500 transition-all"
          style={{
            width: `${Math.min(100, (answeredCount / Math.max(1, totalPlanned)) * 100)}%`,
          }}
        />
      </div>

      <main className="bg-white rounded shadow-sm border border-slate-200 p-5">
        <h2 className="text-lg font-semibold leading-snug mb-4">{current.question.prompt}</h2>

        <QuestionView
          question={current.question}
          value={pendingAnswer}
          onChange={setPendingAnswer}
          revealed={revealed}
          verdict={submittedVerdict}
        />

        {revealed && (
          <FeedbackPanel
            verdict={submittedVerdict!}
            explanation={current.question.explanation}
          />
        )}

        <div className="mt-6 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            Tip: press <kbd className="px-1 py-0.5 bg-slate-100 rounded border">Enter</kbd>{" "}
            to {revealed ? "go to next" : "submit"}; digits{" "}
            <kbd className="px-1 py-0.5 bg-slate-100 rounded border">1-9</kbd> select options.
          </span>
          <button
            type="button"
            onClick={onSubmit}
            disabled={!revealed && pendingAnswer === null}
            className="rounded bg-msblue-500 text-white px-5 py-2 font-semibold hover:bg-msblue-600 disabled:opacity-50"
          >
            {revealed ? "Next →" : "Submit answer"}
          </button>
        </div>
      </main>

      <p className="text-xs text-slate-400 mt-3">
        Retakes queued: {Object.values(retakeCounts).reduce((a, b) => a + b, 0)} (pending in queue: {retakesPending})
      </p>
    </div>
  );
}
