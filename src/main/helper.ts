// AI helpers on the employee side, all grounded in company data (never made up):
//   - Smart Quick request: picks the category and suggests a guide answer before a ticket
//   - "Who can help?": suggests the right colleague for a problem
//   - Check-in reply: a guide tip and the status of a related open request
// Each has an instant offline version; OpenAI only gets a short time limit so the island stays fast.
import {
  guideLabel,
  REQUEST_CATEGORIES,
  type CheckInReply,
  type ColleagueSuggestion,
  type GuideTip,
  type HandbookEntry,
  type RequestCategory,
  type RequestSuggestion,
} from "../shared/types";
import { MIN_SCORE, searchHandbook, tokens } from "./ask";
import { aiJson } from "./openai";
import { store } from "./store";

const FAST_MS = 8000;

const tipOf = (e: HandbookEntry): GuideTip => ({
  id: e.id,
  title: e.title,
  from: guideLabel(e.source),
  answer: e.answer,
  link: e.link,
  linkLabel: e.linkLabel,
});

export function guessCategory(text: string): RequestCategory {
  const t = text.toLowerCase();
  // Connection and access problems first: "my laptop won't connect to the VPN" is access, not hardware
  if (/access|vpn|server|staging|password|login|log in|account|permission|wifi|wi-fi|connect/.test(t)) return "access";
  if (/laptop|keyboard|screen|monitor|mouse|charger|hardware|printer|headset/.test(t)) return "hardware";
  if (/licen[cs]e|software|install|\bide\b|\bapp\b|program|tool/.test(t)) return "software";
  if (/leave|holiday|\bmc\b|sick|medical|time off|half day/.test(t)) return "leave";
  if (/pay|salary|claim|expense|reimburs|allowance/.test(t)) return "payroll";
  return "other";
}

// ---------- Smart Quick request ----------

export async function suggestRequest(text: string): Promise<RequestSuggestion> {
  const t = String(text ?? "").trim().slice(0, 280);
  const hits = searchHandbook(t);
  try {
    const ai = await aiJson<{ category: RequestCategory; entryId: string | null }>(
      `A new hire describes a problem they want IT or HR to help with: ${JSON.stringify(t)}
Pick the best request category id from: ${JSON.stringify(REQUEST_CATEGORIES.map((c) => ({ id: c.id, label: c.label, team: c.dept })))}
If one of these company guide entries would probably solve it without a ticket, give its id, otherwise null:
${(hits.length ? hits.map((h) => h.entry) : store.handbook()).map((e) => JSON.stringify({ id: e.id, title: e.title, answer: e.answer })).join("\n")}
Return JSON only: {"category": string, "entryId": string | null}`,
      FAST_MS
    );
    if (ai) {
      const category = REQUEST_CATEGORIES.some((c) => c.id === ai.category) ? ai.category : guessCategory(t);
      const entry = store.handbook().find((e) => e.id === ai.entryId);
      return { category, tip: entry ? tipOf(entry) : null, source: "openai" };
    }
  } catch (err) {
    console.error("[helper] OpenAI failed, using offline request suggestion:", err);
  }
  const best = hits[0];
  return { category: guessCategory(t), tip: best && best.score >= MIN_SCORE ? tipOf(best.entry) : null, source: "offline" };
}

// ---------- Who can help? ----------

export async function suggestColleague(text: string): Promise<ColleagueSuggestion | null> {
  const t = String(text ?? "").trim().slice(0, 200);
  const people = store.colleagues();
  if (!t) return null;
  try {
    // Colleague names aren't needed by the AI: it picks by id from roles and skills
    const ai = await aiJson<{ colleagueId: string | null; reason: string }>(
      `A new hire needs help with: ${JSON.stringify(t)}
Pick the one colleague best placed to help, preferring someone available. If nobody fits, colleagueId is null.
Colleagues: ${JSON.stringify(people.map((c) => ({ id: c.id, role: c.role, team: c.team, helpsWith: c.helpsWith, availability: c.availability })))}
"reason": one short sentence starting with "Helps with", no names.
Return JSON only: {"colleagueId": string | null, "reason": string}`,
      FAST_MS
    );
    if (ai) {
      const c = people.find((p) => p.id === ai.colleagueId);
      return c ? { colleagueId: c.id, reason: String(ai.reason || `Helps with ${c.helpsWith.join(", ")}`).slice(0, 160), source: "openai" } : null;
    }
  } catch (err) {
    console.error("[helper] OpenAI failed, using offline colleague match:", err);
  }
  // Offline: the most skills in common with the problem, available people first
  const words = new Set(tokens(t));
  const rank = { available: 2, busy: 1, away: 0 };
  const scored = people
    .map((c) => {
      const skills = c.helpsWith.flatMap(tokens).concat(tokens(c.role));
      const hits = c.helpsWith.filter((h) => tokens(h).some((w) => words.has(w)));
      return { c, hits, score: skills.filter((w) => words.has(w)).length * 3 + rank[c.availability] };
    })
    .filter((x) => x.hits.length || x.score > 2)
    .sort((a, b) => b.score - a.score);
  const top = scored[0];
  if (!top || top.score < 3) return null;
  return { colleagueId: top.c.id, reason: `Helps with ${(top.hits.length ? top.hits : top.c.helpsWith).join(", ")}`, source: "offline" };
}

// ---------- Check-in reply ----------

export async function checkInReply(employeeId: string, note: string, negative: boolean): Promise<CheckInReply> {
  if (!note.trim() || !negative) return { tip: null, openRequest: null };
  const s = await suggestRequest(note);
  const open = store
    .myRequests(employeeId)
    .filter((r) => r.status !== "resolved" && r.category === s.category)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
  const cat = open && REQUEST_CATEGORIES.find((c) => c.id === open.category);
  return {
    tip: s.tip,
    openRequest:
      open && cat
        ? {
            label: cat.label,
            dept: cat.dept,
            status: open.status,
            days: Math.max(0, Math.floor((Date.now() - new Date(open.createdAt).getTime()) / 86400000)),
          }
        : null,
  };
}
