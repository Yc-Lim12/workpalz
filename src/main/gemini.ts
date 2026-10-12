// Minimal Gemini client. Returns null when no key is configured, so callers fall back offline.

const TIMEOUT_MS = 15000;

function config() {
  const env = (import.meta as { env?: Record<string, string | undefined> }).env ?? {};
  return {
    key: process.env.GEMINI_API_KEY || env.MAIN_VITE_GEMINI_API_KEY || "",
    model: process.env.GEMINI_MODEL || env.MAIN_VITE_GEMINI_MODEL || "gemini-2.5-flash",
  };
}

export const geminiEnabled = () => !!config().key;

export async function geminiJson<T>(prompt: string): Promise<T | null> {
  const { key, model } = config();
  if (!key) return null;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      signal: ctrl.signal,
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.2 },
      }),
    });
    if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const json = await res.json();
    const text: string = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    return JSON.parse(text) as T;
  } finally {
    clearTimeout(timer);
  }
}
