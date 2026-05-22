import { useCallback, useEffect, useRef, useState } from "react";
import { useExamStore } from "../../state/examStore";
import { useSettingsStore, isAoaiConfigured } from "../../state/settingsStore";
import { rephraseQuestion } from "../../services/azureOpenAI";
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
    resetToSetup,
    reviewOffset,
    goBack,
    goForward,
    bank,
    mode,
    startedAt,
    replaceCurrentQuestion,
  } = useExamStore();
  const aoai = useSettingsStore((s) => s.aoai);
  const [rephrasing, setRephrasing] = useState(false);
  const rephrasedKeysRef = useRef<Set<string>>(new Set());

  const current = queue[0];
  const inReview = reviewOffset > 0;

  // When a retake or repeat-from-history question becomes current, optionally
  // call AOAI to rephrase its wording. Options were already shuffled.
  useEffect(() => {
    if (!current || inReview) return;
    const isReshown = current.attempt > 1 || current.repeat;
    if (!isReshown) return;
    if (!isAoaiConfigured(aoai)) return;
    const key = `${current.question.id}#${current.attempt}#${current.repeat ? "r" : ""}`;
    if (rephrasedKeysRef.current.has(key)) return;
    rephrasedKeysRef.current.add(key);
    const controller = new AbortController();
    setRephrasing(true);
    rephraseQuestion(current.question, aoai, controller.signal)
      .then((q) => {
        if (q !== current.question) replaceCurrentQuestion(q);
      })
      .finally(() => setRephrasing(false));
    return () => controller.abort();
  }, [current, inReview, aoai, replaceCurrentQuestion]);
  // In review mode, look up the historical record and its question from the bank.
  const reviewRecord = inReview
    ? records[records.length - reviewOffset]
    : null;
  const reviewQuestion =
    reviewRecord
      ? reviewRecord.question ??
        (bank ? bank.questions.find((q) => q.id === reviewRecord.questionId) ?? null : null)
      : null;
  const displayQuestion = inReview ? reviewQuestion : current?.question ?? null;
  const displayAnswer = inReview ? reviewRecord?.userAnswer ?? null : pendingAnswer;
  const displayVerdict = inReview ? reviewRecord?.verdict ?? null : submittedVerdict;
  const revealed = inReview ? true : submittedVerdict !== null;
  const canGoBack = reviewOffset < records.length;
  const canGoForward = reviewOffset > 0;

  const onQuit = useCallback(() => {
    if (
      window.confirm(
        "Quit this exam and return to the main menu? Your in-progress answers will be lost.",
      )
    ) {
      resetToSetup();
    }
  }, [resetToSetup]);

  const onSubmit = useCallback(() => {
    if (!current || inReview) return;
    if (revealed) advanceAfterFeedback();
    else submitCurrent();
  }, [current, inReview, revealed, advanceAfterFeedback, submitCurrent]);

  // Keyboard shortcuts: Enter (submit/next), digits 1-9, ← / → for review nav.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!current) return;
      const target = e.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;

      if (e.key === "ArrowLeft") {
        if (canGoBack) {
          e.preventDefault();
          goBack();
        }
        return;
      }
      if (e.key === "ArrowRight") {
        if (canGoForward) {
          e.preventDefault();
          goForward();
        }
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        onSubmit();
        return;
      }
      if (revealed || inReview) return;

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
  }, [
    current,
    revealed,
    inReview,
    pendingAnswer,
    onSubmit,
    setPendingAnswer,
    canGoBack,
    canGoForward,
    goBack,
    goForward,
  ]);

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
        <div className="text-sm text-slate-600 flex items-center gap-2">
          <button
            type="button"
            onClick={goBack}
            disabled={!canGoBack}
            aria-label="Previous question"
            title="Previous question (←)"
            className="rounded border border-slate-300 bg-white px-2 py-1 text-sm hover:bg-slate-50 disabled:opacity-40"
          >
            ← Back
          </button>
          <button
            type="button"
            onClick={goForward}
            disabled={!canGoForward}
            aria-label="Next question"
            title="Forward (→)"
            className="rounded border border-slate-300 bg-white px-2 py-1 text-sm hover:bg-slate-50 disabled:opacity-40"
          >
            Forward →
          </button>
          <span className="ml-2">
            {inReview ? (
              <>
                Reviewing answered question (
                <strong>{records.length - reviewOffset + 1}</strong> of{" "}
                <strong>{records.length}</strong>)
              </>
            ) : (
              <>
                Question{" "}
                <strong>{Math.min(currentIndex + 1, totalPlanned + 99)}</strong> of{" "}
                <strong>{totalPlanned}</strong>
              </>
            )}
          </span>
          {!inReview && current.attempt > 1 && (
            <span
              className="ml-2 inline-block bg-amber-100 text-amber-800 rounded px-2 py-0.5 text-xs"
              title="This retake has its options re-shuffled (and rephrased if Azure OpenAI is configured)."
            >
              Retake (attempt {current.attempt})
              {rephrasing ? " — rephrasing…" : ""}
            </span>
          )}
          {!inReview && current.attempt === 1 && current.repeat && (
            <span
              className="ml-2 inline-block bg-sky-100 text-sky-800 rounded px-2 py-0.5 text-xs"
              title="You’ve seen this question before. Options are reshuffled (and rephrased if Azure OpenAI is configured)."
            >
              Repeat from history
              {rephrasing ? " — rephrasing…" : ""}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Timer
            endsAt={endsAt}
            startedAt={startedAt}
            countUp={mode === "learning"}
            onExpire={() => finishExam(true)}
          />
          <button
            type="button"
            onClick={onQuit}
            className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
            title="Quit exam and return to setup"
          >
            Quit exam
          </button>
        </div>
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

      {inReview && (
        <div className="mb-3 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          You are reviewing a previously answered question. Use{" "}
          <kbd className="px-1 py-0.5 bg-white rounded border">→</kbd> or the
          Forward button to return to the live question.
        </div>
      )}

      <main className="bg-white rounded shadow-sm border border-slate-200 p-5">
        {displayQuestion ? (
          <>
            <h2 className="text-lg font-semibold leading-snug mb-4">
              {displayQuestion.prompt}
            </h2>

            <QuestionView
              question={displayQuestion}
              value={displayAnswer}
              onChange={inReview ? () => {} : setPendingAnswer}
              revealed={revealed}
              verdict={displayVerdict}
            />

            {revealed && displayVerdict && (
              <FeedbackPanel
                verdict={displayVerdict}
                explanation={displayQuestion.explanation}
              />
            )}
          </>
        ) : (
          <p className="text-slate-500 italic">
            This question is no longer available in the loaded bank.
          </p>
        )}

        <div className="mt-6 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            Tip: press <kbd className="px-1 py-0.5 bg-slate-100 rounded border">Enter</kbd>{" "}
            to {revealed ? "go to next" : "submit"}; digits{" "}
            <kbd className="px-1 py-0.5 bg-slate-100 rounded border">1-9</kbd> select
            options; <kbd className="px-1 py-0.5 bg-slate-100 rounded border">←</kbd>/
            <kbd className="px-1 py-0.5 bg-slate-100 rounded border">→</kbd> navigate.
          </span>
          {!inReview && (
            <button
              type="button"
              onClick={onSubmit}
              disabled={!revealed && pendingAnswer === null}
              className="rounded bg-msblue-500 text-white px-5 py-2 font-semibold hover:bg-msblue-600 disabled:opacity-50"
            >
              {revealed ? "Next →" : "Submit answer"}
            </button>
          )}
        </div>
      </main>

      <p className="text-xs text-slate-400 mt-3">
        Retakes queued: {Object.values(retakeCounts).reduce((a, b) => a + b, 0)} (pending in queue: {retakesPending})
      </p>
    </div>
  );
}
