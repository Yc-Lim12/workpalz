// Minimal OpenAI client. Returns null when no key is configured (or tests force offline),
// so callers fall back to their offline versions.

const TIMEOUT_MS = 30000;

function config() {
  const env = (import.meta as { env?: Record<string, string | undefined> }).env ?? {};
  return {
    key: process.env.WORKPALZ_OFFLINE ? "" : process.env.OPENAI_API_KEY || env.MAIN_VITE_OPENAI_API_KEY || "",
    model: process.env.OPENAI_MODEL || env.MAIN_VITE_OPENAI_MODEL || "gpt-5.6-luna",
  };
}

export const aiEnabled = () => !!config().key;

// timeoutMs: short for things people wait on in the island, longer for HR analysis
export async function aiJson<T>(prompt: string, timeoutMs = TIMEOUT_MS): Promise<T | null> {
  const { key, model } = config();
  if (!key) return null;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: ctrl.signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const json = await res.json();
    const text: string = json.choices?.[0]?.message?.content ?? "";
    return JSON.parse(text) as T;
  } finally {
    clearTimeout(timer);
  }
}
