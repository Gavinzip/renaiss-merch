import { HttpError } from "../http.mjs";

const WEBSITE_ORIGIN = "https://renaiss.zeabur.app";
let activeRequests = 0;

export function normalizeAssistantSources(sources) {
  return sources.slice(0, 6).flatMap((source, index) => {
    if (typeof source?.url !== "string") return [];
    try {
      const url = new URL(source.url, WEBSITE_ORIGIN);
      if (!["https:", "http:"].includes(url.protocol)) return [];
      // The website numbers its context in source-array order. Keep that
      // original number when an unsafe/malformed URL is excluded.
      return [{ citation: index + 1, url: url.href, title: String(source.title || url.hostname).slice(0, 160) }];
    } catch { return []; }
  });
}

export function normalizeAssistantRequest(value) {
  if (!value || typeof value.question !== "string" || !value.question.trim() || value.question.length > 1200 || !["en", "zh-TW"].includes(value.locale)) {
    throw new HttpError(400, "invalid_assistant_question");
  }
  if (!Array.isArray(value.history) || value.history.length > 8 || value.history.some(row => !row || !["user", "assistant"].includes(row.role) || typeof row.content !== "string" || !row.content.trim() || row.content.length > 6000)) {
    throw new HttpError(400, "invalid_assistant_history");
  }
  return { question: value.question.trim(), lang: value.locale === "en" ? "en" : "zh-Hant", history: value.history, top_k: 4 };
}

export async function askHubAssistant(value, signal) {
  const request = normalizeAssistantRequest(value);
  if (activeRequests >= 2) throw new HttpError(503, "assistant_busy");
  activeRequests++;
  try {
    const response = await fetch(`${WEBSITE_ORIGIN}/api/intel/agent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(request),
      signal: AbortSignal.any([signal, AbortSignal.timeout(90_000)]),
    });
    if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) {
      throw new HttpError(response.status === 503 || response.status === 429 ? 503 : 502, response.status === 503 || response.status === 429 ? "assistant_busy" : "assistant_unavailable");
    }
    const chunks = [];
    let bytes = 0;
    for await (const chunk of response.body) {
      bytes += chunk.length;
      if (bytes > 512 * 1024) throw new Error("assistant_response_too_large");
      chunks.push(chunk);
    }
    const payload = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (payload.ok !== true || typeof payload.answer !== "string" || !payload.answer.trim() || payload.answer.length > 24_000 || !Array.isArray(payload.sources)) throw new Error("invalid_assistant_response");
    return {
      answer: payload.answer,
      sources: normalizeAssistantSources(payload.sources),
    };
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(error.name === "TimeoutError" ? 504 : 502, error.name === "TimeoutError" ? "assistant_timeout" : "assistant_unavailable");
  } finally { activeRequests--; }
}
