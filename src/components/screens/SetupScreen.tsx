import { useState } from "react";
import { CERT_PROFILES, computeSessionSeconds, getProfile } from "../../data/examProfiles";
import { useExamStore, pickQuestions } from "../../state/examStore";
import { useSettingsStore, isAoaiConfigured } from "../../state/settingsStore";
import { parseFile, parseJson } from "../../parsers";
import { testAoaiConnection, type AoaiTestResult } from "../../services/azureOpenAI";
import sampleBank from "../../data/sampleQuestions.json";
import { formatHms } from "../../utils/helpers";

export function SetupScreen() {
  const {
    bank,
    bankErrors,
    bankFileName,
    certCode,
    selectedCount,
    mode,
    seenQuestionIds,
    setBank,
    setCertCode,
    setSelectedCount,
    setMode,
    startExam,
    clearSeenHistory,
  } = useExamStore();

  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [showAoai, setShowAoai] = useState(false);
  const [aoaiTesting, setAoaiTesting] = useState(false);
  const [aoaiResult, setAoaiResult] = useState<AoaiTestResult | null>(null);
  const aoai = useSettingsStore((s) => s.aoai);
  const setAoai = useSettingsStore((s) => s.setAoai);

  async function onTestAoai() {
    setAoaiTesting(true);
    setAoaiResult(null);
    const r = await testAoaiConnection(aoai);
    setAoaiResult(r);
    setAoaiTesting(false);
  }

  const profile = getProfile(certCode) ?? CERT_PROFILES[0];
  const sessionSeconds = computeSessionSeconds(profile, selectedCount);
  const totalAvailable = bank?.questions.length ?? 0;

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setBusy(true);
    setInfo(null);
    const result = await parseFile(f);
    setBank(result.bank ?? null, result.errors, result.bank ? f.name : null);
    if (result.bank) setInfo(`Loaded ${result.bank.questions.length} questions from ${f.name}.`);
    setBusy(false);
    e.target.value = "";
  }

  function loadSample() {
    const result = parseJson(JSON.stringify(sampleBank));
    setBank(result.bank ?? null, result.errors, "sample bank");
    setInfo(`Loaded sample bank (${result.bank?.questions.length} questions).`);
  }

  function onStart() {
    if (!bank) return;
    const count = Math.min(selectedCount, bank.questions.length);
    const picked = pickQuestions(bank, count);
    startExam(picked, computeSessionSeconds(profile, count), mode);
  }
  // Breakdown of next session's picks: how many will be unseen vs repeats.
  const seenInBank = bank
    ? bank.questions.filter((q) => seenQuestionIds.includes(q.id)).length
    : 0;
  const unseenInBank = (bank?.questions.length ?? 0) - seenInBank;
  const take = Math.min(selectedCount, totalAvailable);
  const newPicks = Math.min(take, unseenInBank);
  const repeatPicks = take - newPicks;
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
              accept=".json,.md,.markdown,.txt,.docx,.pdf"
              className="hidden"
              onChange={onFile}
              disabled={busy}
            />
            Upload file (.json / .md / .txt / .docx)
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
              {bankFileName ? ` — ${bankFileName}` : bank.name ? ` — ${bank.name}` : ""}
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

        <div>
          <span className="text-sm font-medium">Mode</span>
          <div className="mt-1 grid sm:grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setMode("exam")}
              className={`text-left rounded border p-3 ${
                mode === "exam"
                  ? "border-msblue-500 bg-msblue-50 ring-1 ring-msblue-500"
                  : "border-slate-300 hover:bg-slate-50"
              }`}
            >
              <div className="font-semibold text-sm">Exam mode</div>
              <div className="text-xs text-slate-600 mt-0.5">
                Timed countdown. Auto-submits when time runs out — mirrors the real test.
              </div>
            </button>
            <button
              type="button"
              onClick={() => setMode("learning")}
              className={`text-left rounded border p-3 ${
                mode === "learning"
                  ? "border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500"
                  : "border-slate-300 hover:bg-slate-50"
              }`}
            >
              <div className="font-semibold text-sm">Learning mode</div>
              <div className="text-xs text-slate-600 mt-0.5">
                Stopwatch counts up. No time pressure — take as long as you need.
              </div>
            </button>
          </div>
        </div>

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

        <div className="rounded bg-slate-50 border border-slate-200 p-3 text-sm space-y-1">
          {mode === "exam" ? (
            <div>
              Time budget: <strong>{formatHms(sessionSeconds)}</strong>{" "}
              <span className="text-slate-500">
                ({Math.round((profile.durationMinutes * 60) / profile.questionCount)}s per question
                based on {profile.code})
              </span>
            </div>
          ) : (
            <div>
              <strong>Learning mode</strong> — no countdown. The timer will count up so
              you can see how long you spent.
            </div>
          )}
          {bank && (
            <div className="text-slate-600">
              Next session: <strong>{newPicks}</strong> new question
              {newPicks === 1 ? "" : "s"}
              {repeatPicks > 0 ? (
                <>
                  {" "}+ <strong>{repeatPicks}</strong> repeat
                  {repeatPicks === 1 ? "" : "s"} (reshuffled
                  {isAoaiConfigured(aoai) ? " & rephrased" : ""})
                </>
              ) : null}
              .{" "}
              <span className="text-slate-500">
                {seenInBank} of {bank.questions.length} already answered.
              </span>
              {seenInBank > 0 && (
                <>
                  {" "}
                  <button
                    type="button"
                    onClick={() => {
                      if (
                        window.confirm(
                          "Clear your answer history? Future sessions will treat all questions as new.",
                        )
                      ) {
                        clearSeenHistory();
                      }
                    }}
                    className="underline text-msblue-600 hover:text-msblue-700"
                  >
                    reset history
                  </button>
                </>
              )}
            </div>
          )}
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

      <section className="bg-white rounded shadow-sm border border-slate-200 p-5">
        <button
          type="button"
          className="flex items-center justify-between w-full text-left"
          onClick={() => setShowAoai((v) => !v)}
        >
          <h2 className="text-lg font-semibold">
            Azure OpenAI (optional) —{" "}
            <span
              className={
                isAoaiConfigured(aoai)
                  ? "text-emerald-700 text-sm font-normal"
                  : "text-slate-500 text-sm font-normal"
              }
            >
              {isAoaiConfigured(aoai) ? "configured" : "not configured"}
            </span>
          </h2>
          <span className="text-slate-400">{showAoai ? "▲" : "▼"}</span>
        </button>
        {showAoai && (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-slate-600">
              When enabled, retake questions are rephrased via Azure OpenAI so
              the wording differs each attempt. Options are always re-shuffled
              on retake regardless of this setting. Credentials are stored
              locally in your browser (localStorage) and are sent only to your
              own Azure endpoint.
            </p>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={aoai.enabled}
                onChange={(e) => setAoai({ enabled: e.target.checked })}
              />
              Enable rephrasing on retakes
            </label>
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="block text-sm">
                <span className="font-medium">Endpoint</span>
                <input
                  type="url"
                  placeholder="https://my-aoai.openai.azure.com"
                  value={aoai.endpoint}
                  onChange={(e) => setAoai({ endpoint: e.target.value })}
                  className="mt-1 w-full rounded border border-slate-300 p-2 font-mono text-xs"
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium">Deployment name</span>
                <input
                  type="text"
                  placeholder="gpt-4o-mini"
                  value={aoai.deployment}
                  onChange={(e) => setAoai({ deployment: e.target.value })}
                  className="mt-1 w-full rounded border border-slate-300 p-2 font-mono text-xs"
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium">API key</span>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={aoai.apiKey}
                  onChange={(e) => setAoai({ apiKey: e.target.value })}
                  className="mt-1 w-full rounded border border-slate-300 p-2 font-mono text-xs"
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium">API version</span>
                <input
                  type="text"
                  value={aoai.apiVersion}
                  onChange={(e) => setAoai({ apiVersion: e.target.value })}
                  className="mt-1 w-full rounded border border-slate-300 p-2 font-mono text-xs"
                />
              </label>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <button
                type="button"
                onClick={onTestAoai}
                disabled={
                  aoaiTesting ||
                  !aoai.endpoint.trim() ||
                  !aoai.deployment.trim() ||
                  !aoai.apiKey.trim()
                }
                className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-50"
              >
                {aoaiTesting ? "Testing…" : "Test connection"}
              </button>
              {aoaiResult && (
                <span
                  className={`text-sm ${
                    aoaiResult.ok ? "text-emerald-700" : "text-red-700"
                  }`}
                >
                  {aoaiResult.ok ? "✓" : "✗"} {aoaiResult.message}
                  {aoaiResult.model ? ` (model: ${aoaiResult.model})` : ""}
                </span>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
