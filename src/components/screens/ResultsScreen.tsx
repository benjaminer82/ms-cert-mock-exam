import { useMemo } from "react";
import { useExamStore } from "../../state/examStore";
import { formatHms } from "../../utils/helpers";

export function ResultsScreen() {
  const { records, startedAt, endsAt, sessionSeconds, resetToSetup } = useExamStore();

  const summary = useMemo(() => {
    // Final verdict per question = the LAST record for that question.
    const lastByQ = new Map<string, (typeof records)[number]>();
    records.forEach((r) => lastByQ.set(r.questionId, r));
    const finals = [...lastByQ.values()];

    const correct = finals.filter((r) => r.verdict === "correct").length;
    const partial = finals.filter((r) => r.verdict === "partial").length;
    const incorrect = finals.filter(
      (r) => r.verdict === "incorrect" || r.verdict === "skipped"
    ).length;
    const total = finals.length;
    const percent = total === 0 ? 0 : Math.round((correct / total) * 100);

    // By tag and by type (using records' attempt counts; final verdict)
    const byType: Record<string, { correct: number; total: number }> = {};
    finals.forEach((r) => {
      const t = r.userAnswer?.type ?? "unknown";
      byType[t] = byType[t] || { correct: 0, total: 0 };
      byType[t].total += 1;
      if (r.verdict === "correct") byType[t].correct += 1;
    });

    const stillMissed = finals.filter(
      (r) => r.verdict !== "correct" && r.verdict !== "partial"
    );

    return { correct, partial, incorrect, total, percent, byType, finals, stillMissed };
  }, [records]);

  const timeTakenSec = Math.max(
    0,
    Math.floor((Math.min(Date.now(), endsAt) - startedAt) / 1000)
  );

  function exportJson() {
    const data = {
      generatedAt: new Date().toISOString(),
      summary: {
        total: summary.total,
        correct: summary.correct,
        partial: summary.partial,
        incorrect: summary.incorrect,
        percent: summary.percent,
        timeTakenSeconds: timeTakenSec,
        timeAllowedSeconds: sessionSeconds,
      },
      records,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    download(blob, "mock-exam-results.json");
  }

  function exportPdf() {
    // Lightweight "PDF" via the browser print dialog.
    window.print();
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6 print:p-2">
      <header>
        <h1 className="text-3xl font-bold text-msblue-700">Results</h1>
      </header>

      <section className="bg-white rounded shadow-sm border border-slate-200 p-6 text-center">
        <p className="text-6xl font-bold text-msblue-700">{summary.percent}%</p>
        <p className="text-slate-600 mt-2">
          {summary.correct} / {summary.total} fully correct
          {summary.partial > 0 && (
            <> · <span className="text-amber-700">{summary.partial} partial</span></>
          )}
        </p>
        <p className="text-sm text-slate-500 mt-2">
          Time taken: {formatHms(timeTakenSec)} of {formatHms(sessionSeconds)}
        </p>
      </section>

      <section className="bg-white rounded shadow-sm border border-slate-200 p-5">
        <h2 className="text-lg font-semibold mb-3">Breakdown by question type</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 border-b">
              <th className="py-1.5">Type</th>
              <th className="py-1.5 text-right">Correct / Total</th>
              <th className="py-1.5 text-right">Score</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(summary.byType).map(([t, v]) => (
              <tr key={t} className="border-b last:border-b-0">
                <td className="py-1.5">{t}</td>
                <td className="py-1.5 text-right">
                  {v.correct} / {v.total}
                </td>
                <td className="py-1.5 text-right">
                  {Math.round((v.correct / Math.max(1, v.total)) * 100)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="bg-white rounded shadow-sm border border-slate-200 p-5">
        <h2 className="text-lg font-semibold mb-3">
          Still missed ({summary.stillMissed.length})
        </h2>
        {summary.stillMissed.length === 0 ? (
          <p className="text-sm text-green-700">
            Excellent — every question was eventually mastered.
          </p>
        ) : (
          <ul className="space-y-2">
            {summary.stillMissed.map((r) => (
              <li key={r.questionId} className="rounded border border-red-200 bg-red-50 p-3 text-sm">
                <div className="font-mono text-xs text-slate-500">{r.questionId}</div>
                <div>
                  Final verdict: <strong>{r.verdict}</strong> after {r.attempts} attempt
                  {r.attempts === 1 ? "" : "s"}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="bg-white rounded shadow-sm border border-slate-200 p-5">
        <h2 className="text-lg font-semibold mb-3">Attempt history</h2>
        <ul className="space-y-1 text-sm">
          {records.map((r, i) => (
            <li key={i} className="flex justify-between border-b last:border-b-0 py-1">
              <span className="font-mono text-xs text-slate-500">{r.questionId}</span>
              <span>
                attempt {r.attempts} — <strong className={verdictClass(r.verdict)}>{r.verdict}</strong>
                {r.verdict === "correct" && r.attempts > 1 && (
                  <span className="text-slate-500"> (mastered after {r.attempts} attempts)</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <div className="flex flex-wrap gap-3 justify-end print:hidden">
        <button
          type="button"
          onClick={exportJson}
          className="rounded border border-slate-300 px-4 py-2 hover:bg-slate-50"
        >
          Export JSON
        </button>
        <button
          type="button"
          onClick={exportPdf}
          className="rounded border border-slate-300 px-4 py-2 hover:bg-slate-50"
        >
          Export PDF (print)
        </button>
        <button
          type="button"
          onClick={resetToSetup}
          className="rounded bg-msblue-500 text-white px-5 py-2 font-semibold hover:bg-msblue-600"
        >
          Start another exam
        </button>
      </div>
    </div>
  );
}

function verdictClass(v: string) {
  switch (v) {
    case "correct":
      return "text-green-700";
    case "partial":
      return "text-amber-700";
    case "incorrect":
      return "text-red-700";
    default:
      return "text-slate-600";
  }
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
