import type { Verdict } from "../types/question";

export function FeedbackPanel({
  verdict,
  explanation,
}: {
  verdict: Verdict;
  explanation?: string;
}) {
  const styles: Record<Verdict, { bg: string; label: string; emoji: string }> = {
    correct: { bg: "bg-green-50 border-green-500", label: "Correct", emoji: "✓" },
    partial: { bg: "bg-amber-50 border-amber-500", label: "Partially correct", emoji: "~" },
    incorrect: { bg: "bg-red-50 border-red-500", label: "Incorrect", emoji: "✗" },
    skipped: { bg: "bg-slate-100 border-slate-400", label: "Skipped", emoji: "–" },
  };
  const s = styles[verdict];
  return (
    <div
      className={`mt-4 rounded border-l-4 ${s.bg} p-3`}
      role="status"
      aria-live="polite"
    >
      <p className="font-semibold">
        <span className="mr-2">{s.emoji}</span>
        {s.label}
      </p>
      <p className="mt-1 text-sm text-slate-700">
        {explanation || "No explanation provided."}
      </p>
    </div>
  );
}
