import type { Question } from "../types/question";
import type { AzureOpenAISettings } from "../state/settingsStore";

const SYSTEM_PROMPT = `You are a Microsoft certification exam author. You rewrite practice questions so they test the same concept but with different wording. Rules:
- Preserve the technical meaning and the correct answer exactly.
- Do NOT change which option is correct.
- Rephrase the question prompt and each option in your own words.
- Keep the option count the same. Keep ordering as given (the caller has already shuffled).
- No preamble, no markdown — return ONLY a JSON object matching the schema.`;

interface RephraseResponse {
  prompt: string;
  options: string[];
  explanation?: string;
}

function buildUserPrompt(q: Question): string | null {
  if (q.type === "single" || q.type === "multiple" || q.type === "hot-area") {
    const options =
      q.type === "hot-area"
        ? q.options.map((o) => o.label)
        : q.options;
    const correct =
      q.type === "single"
        ? [q.answer]
        : q.type === "multiple"
        ? q.answer
        : q.options.map((o, i) => (o.isCorrect ? i : -1)).filter((i) => i >= 0);

    return JSON.stringify({
      instructions:
        "Rephrase 'prompt' and each entry in 'options' (keep same count and order). Return JSON: { prompt: string, options: string[], explanation?: string }. The correct option indices MUST stay the same.",
      prompt: q.prompt,
      options,
      correctIndices: correct,
      explanation: q.explanation ?? "",
    });
  }
  return null;
}

function applyRephrase(q: Question, r: RephraseResponse): Question {
  if (q.type === "single" || q.type === "multiple") {
    if (!Array.isArray(r.options) || r.options.length !== q.options.length) return q;
    return {
      ...q,
      prompt: r.prompt || q.prompt,
      options: r.options.map((s) => String(s)),
      explanation: r.explanation || q.explanation,
    };
  }
  if (q.type === "hot-area") {
    if (!Array.isArray(r.options) || r.options.length !== q.options.length) return q;
    return {
      ...q,
      prompt: r.prompt || q.prompt,
      options: q.options.map((o, i) => ({ ...o, label: String(r.options[i]) })),
      explanation: r.explanation || q.explanation,
    };
  }
  return q;
}

/**
 * Call Azure OpenAI Chat Completions to rephrase a question. Returns the
 * original question on any error so the caller can fall back transparently.
 */
export async function rephraseQuestion(
  q: Question,
  s: AzureOpenAISettings,
  signal?: AbortSignal,
): Promise<Question> {
  const userPrompt = buildUserPrompt(q);
  if (!userPrompt) return q; // unsupported type — skip

  const endpoint = s.endpoint.replace(/\/+$/, "");
  const url = `${endpoint}/openai/deployments/${encodeURIComponent(
    s.deployment,
  )}/chat/completions?api-version=${encodeURIComponent(s.apiVersion)}`;

  try {
    const baseBody: Record<string, unknown> = {
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
    };
    const doFetch = (body: Record<string, unknown>) =>
      fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "api-key": s.apiKey },
        signal,
        body: JSON.stringify(body),
      });
    let res = await doFetch({ ...baseBody, temperature: 0.7 });
    if (!res.ok) {
      const errText = await res.text();
      if (/temperature/i.test(errText) && /unsupported|not supported/i.test(errText)) {
        // gpt-5.x / reasoning models: omit temperature.
        res = await doFetch(baseBody);
      } else {
        console.warn("AOAI rephrase failed:", res.status, errText);
        return q;
      }
      if (!res.ok) {
        console.warn("AOAI rephrase failed:", res.status, await res.text());
        return q;
      }
    }
    const data = await res.json();
    const content: string | undefined = data?.choices?.[0]?.message?.content;
    if (!content) return q;
    const parsed = JSON.parse(content) as RephraseResponse;
    return applyRephrase(q, parsed);
  } catch (err) {
    if ((err as { name?: string })?.name === "AbortError") return q;
    console.warn("AOAI rephrase error:", err);
    return q;
  }
}

export interface AoaiTestResult {
  ok: boolean;
  status?: number;
  message: string;
  model?: string;
}

/**
 * Send a tiny chat completion to validate endpoint + deployment + key + version.
 */
export async function testAoaiConnection(
  s: AzureOpenAISettings,
): Promise<AoaiTestResult> {
  if (!s.endpoint.trim()) return { ok: false, message: "Endpoint is required." };
  if (!s.deployment.trim()) return { ok: false, message: "Deployment is required." };
  if (!s.apiKey.trim()) return { ok: false, message: "API key is required." };
  let endpoint: string;
  try {
    endpoint = new URL(s.endpoint).origin;
  } catch {
    return { ok: false, message: "Endpoint is not a valid URL." };
  }
  const url = `${endpoint}/openai/deployments/${encodeURIComponent(
    s.deployment,
  )}/chat/completions?api-version=${encodeURIComponent(s.apiVersion)}`;

  // Build a request that adapts to model quirks:
  // - newer reasoning models (gpt-5.x, o-series) require `max_completion_tokens` and reject custom temperature.
  // - legacy chat models use `max_tokens` and accept temperature.
  async function send(useNewParam: boolean, sendTemperature: boolean) {
    const body: Record<string, unknown> = {
      messages: [
        { role: "system", content: "Reply with the single word: pong" },
        { role: "user", content: "ping" },
      ],
    };
    if (useNewParam) body.max_completion_tokens = 16;
    else body.max_tokens = 5;
    if (sendTemperature) body.temperature = 0;
    return fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "api-key": s.apiKey },
      body: JSON.stringify(body),
    });
  }

  try {
    let res = await send(false, true);
    let text = await res.text();
    // Retry path 1: switch to max_completion_tokens if asked.
    if (!res.ok && /max_completion_tokens/i.test(text)) {
      res = await send(true, true);
      text = await res.text();
    }
    // Retry path 2: drop temperature if unsupported.
    if (!res.ok && /temperature/i.test(text) && /unsupported|not supported/i.test(text)) {
      res = await send(true, false);
      text = await res.text();
    }
    if (!res.ok) {
      let detail = text;
      try {
        const j = JSON.parse(text);
        detail = j?.error?.message || j?.message || text;
      } catch {
        /* keep raw */
      }
      return {
        ok: false,
        status: res.status,
        message: `HTTP ${res.status}: ${detail.slice(0, 300)}`,
      };
    }
    const data = JSON.parse(text);
    const model: string | undefined = data?.model;
    const reply: string | undefined = data?.choices?.[0]?.message?.content;
    return {
      ok: true,
      status: res.status,
      model,
      message: `Connected. Model responded: "${(reply ?? "").trim().slice(0, 40)}"`,
    };
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : "Unknown network error.";
    return {
      ok: false,
      message: `Network error: ${msg}. Check the endpoint URL and CORS / firewall settings.`,
    };
  }
}
