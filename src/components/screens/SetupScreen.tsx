import { useState } from "react";
import { CERT_PROFILES, computeSessionSeconds, getProfile } from "../../data/examProfiles";
import { useExamStore, pickQuestions } from "../../state/examStore";
import { parseFile, parseJson } from "../../parsers";
import sampleBank from "../../data/sampleQuestions.json";
import { formatHms } from "../../utils/helpers";

export function SetupScreen() {
  const {
    bank,
    bankErrors,
    certCode,
    selectedCount,
    setBank,
    setCertCode,
    setSelectedCount,
    startExam,
  } = useExamStore();

  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState<string | null>(null);

  const profile = getProfile(certCode) ?? CERT_PROFILES[0];
  const sessionSeconds = computeSessionSeconds(profile, selectedCount);
  const totalAvailable = bank?.questions.length ?? 0;

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setBusy(true);
    setInfo(null);
    const result = await parseFile(f);
    setBank(result.bank ?? null, result.errors);
    if (result.bank) setInfo(`Loaded ${result.bank.questions.length} questions from ${f.name}.`);
    setBusy(false);
    e.target.value = "";
  }

  function loadSample() {
    const result = parseJson(JSON.stringify(sampleBank));
    setBank(result.bank ?? null, result.errors);
    setInfo(`Loaded sample bank (${result.bank?.questions.length} questions).`);
  }

  function onStart() {
    if (!bank) return;
    const count = Math.min(selectedCount, bank.questions.length);
    const picked = pickQuestions(bank, count);
    startExam(picked, computeSessionSeconds(profile, count));
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <header>
        <h1 className="text-3xl font-bold text-msblue-700">MS Cert Mock Exam</h1>
        <p className="text-slate-600 mt-1">
          Practice exam runner modeled on the Microsoft certification exam interface. Fully
          client-side — your question bank never leaves the browser.
        </p>
      </header>

      <section className="bg-white rounded shadow-sm border border-slate-200 p-5 space-y-4">
        <h2 className="text-lg font-semibold">1. Load a question bank</h2>
        <div className="flex flex-wrap gap-3 items-center">
          <label className="inline-flex items-center gap-2 cursor-pointer rounded bg-msblue-500 text-white px-4 py-2 hover:bg-msblue-600">
            <input
              type="file"
              accept=".json,.md,.markdown,.pdf,.docx"
              className="hidden"
              onChange={onFile}
              disabled={busy}
            />
            Upload file (.json / .md)
          </label>
          <button
            type="button"
            onClick={loadSample}
            className="rounded border border-slate-300 px-4 py-2 hover:bg-slate-50"
          >
            Use sample bank
          </button>
          {bank && (
            <span className="text-sm text-slate-600">
              ✓ {bank.questions.length} questions loaded
              {bank.name ? ` — ${bank.name}` : ""}
            </span>
          )}
        </div>
        {info && <p className="text-sm text-green-700">{info}</p>}
        {bankErrors.length > 0 && (
          <div className="rounded border border-red-300 bg-red-50 p-3">
            <p className="text-sm font-semibold text-red-800 mb-1">
              {bankErrors.length} parsing issue{bankErrors.length === 1 ? "" : "s"}:
            </p>
            <ul className="list-disc ml-6 text-sm text-red-700 space-y-0.5 max-h-40 overflow-auto">
              {bankErrors.slice(0, 20).map((e, i) => (
                <li key={i}>{e}</li>
              ))}
              {bankErrors.length > 20 && <li>… and {bankErrors.length - 20} more</li>}
            </ul>
          </div>
        )}
      </section>

      <section className="bg-white rounded shadow-sm border border-slate-200 p-5 space-y-4">
        <h2 className="text-lg font-semibold">2. Configure session</h2>

        <div className="grid sm:grid-cols-2 gap-4">
          <label className="block">
            <span className="text-sm font-medium">Target certification</span>
            <select
              className="mt-1 w-full rounded border border-slate-300 p-2"
              value={certCode}
              onChange={(e) => setCertCode(e.target.value)}
            >
              {CERT_PROFILES.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.code} — {p.name}
                </option>
              ))}
            </select>
            <span className="block text-xs text-slate-500 mt-1">
              Official: {profile.questionCount} questions / {profile.durationMinutes} min
            </span>
          </label>

          <label className="block">
            <span className="text-sm font-medium">Number of questions</span>
            <div className="mt-1 flex gap-2 flex-wrap">
              {[5, 10, 25, 50].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setSelectedCount(n)}
                  className={`px-3 py-1.5 rounded border text-sm ${
                    selectedCount === n
                      ? "bg-msblue-500 text-white border-msblue-500"
                      : "bg-white border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  {n}
                </button>
              ))}
              <input
                type="number"
                min={1}
                max={200}
                value={selectedCount}
                onChange={(e) =>
                  setSelectedCount(Math.max(1, parseInt(e.target.value || "1", 10)))
                }
                className="w-20 rounded border border-slate-300 p-1.5 text-sm"
                aria-label="Custom question count"
              />
            </div>
            {bank && (
              <span className="block text-xs text-slate-500 mt-1">
                {selectedCount > totalAvailable
                  ? `Only ${totalAvailable} questions in bank — will cap to ${totalAvailable}.`
                  : `${selectedCount} of ${totalAvailable} available`}
              </span>
            )}
          </label>
        </div>

        <div className="rounded bg-slate-50 border border-slate-200 p-3 text-sm">
          Time budget: <strong>{formatHms(sessionSeconds)}</strong>{" "}
          <span className="text-slate-500">
            ({Math.round((profile.durationMinutes * 60) / profile.questionCount)}s per question
            based on {profile.code})
          </span>
        </div>
      </section>

      <div className="flex justify-end">
        <button
          type="button"
          disabled={!bank || bank.questions.length === 0 || busy}
          onClick={onStart}
          className="rounded bg-msblue-500 text-white px-6 py-2.5 font-semibold hover:bg-msblue-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Start exam →
        </button>
      </div>
    </div>
  );
}
