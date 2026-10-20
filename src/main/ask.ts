// Ask WorkPalz: jargon buster + quick search, grounded in the company handbook.
// The AI may only answer from handbook entries, so it can't make up policies.
import type { AskResult, HandbookEntry } from "../shared/types";
import { store } from "./store";
import { geminiJson } from "./gemini";

const STOP = new Set(
  "a an the is are am do does did i me my we our to of for in on at and or what whats what's how who where when which can could should would please tell about mean means meaning get".split(
    " "
  )
);

const normalise = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9:\- ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
export const tokens = (s: string) => normalise(s).split(" ").filter((t) => t && !STOP.has(t));

export function searchHandbook(question: string, limit = 4) {
  const q = ` ${normalise(question)} `;
  const qTokens = new Set(tokens(question));

  return store.handbook().map((entry) => {
    let score = 0;
    for (const k of entry.keywords) {
      const kn = normalise(k);
      if (q.includes(` ${kn} `)) score += 3 + kn.split(" ").length; // whole phrase match
    }
    const entryTokens = new Set([...tokens(entry.title), ...entry.keywords.flatMap(tokens)]);
    for (const t of qTokens) if (entryTokens.has(t)) score += 1;
    return { entry, score };
  })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

const MIN_SCORE = 3;
const NOT_FOUND =
  "I couldn't find that in the handbook. I've noted it so HR can add an answer. Your onboarding buddy is a good person to ask in the meantime.";

const asResult = (entry: HandbookEntry, answer: string, source: AskResult["source"]): AskResult => ({
  answered: true,
  answer,
  entry: { title: entry.title, link: entry.link, linkLabel: entry.linkLabel },
  source,
});

export async function answerQuestion(question: string): Promise<{ result: AskResult; entryId: string | null }> {
  const hits = searchHandbook(question);

  try {
    const ai = await geminiJson<{ answered: boolean; entryId?: string; answer?: string }>(
      `You are "Ask WorkPalz", a helper for new employees at Lumora Tech.
Answer ONLY using the handbook entries below. If they don't answer the question, reply {"answered": false}.
Keep answers to 1–3 short, friendly sentences in plain English. Explain jargon simply.

Handbook entries:
${(hits.length ? hits.map((h) => h.entry) : store.handbook())
  .map((e) => JSON.stringify({ id: e.id, title: e.title, answer: e.answer }))
  .join("\n")}

Question: ${JSON.stringify(question)}

Return JSON: {"answered": boolean, "entryId": string, "answer": string}`
    );
    if (ai) {
      const entry = store.handbook().find((e) => e.id === ai.entryId);
      if (ai.answered && entry && ai.answer) return { result: asResult(entry, ai.answer, "gemini"), entryId: entry.id };
      return { result: { answered: false, answer: NOT_FOUND, entry: null, source: "gemini" }, entryId: null };
    }
  } catch (err) {
    console.error("[ask] Gemini failed, using handbook search:", err);
  }

  const best = hits[0];
  if (best && best.score >= MIN_SCORE) return { result: asResult(best.entry, best.entry.answer, "handbook"), entryId: best.entry.id };
  return { result: { answered: false, answer: NOT_FOUND, entry: null, source: "handbook" }, entryId: null };
}
