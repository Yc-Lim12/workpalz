// AI helpers on the employee side, all grounded in company data (never made up):
//   - Smart Quick request: picks the category and suggests a guide answer before a ticket
//   - "Who can help?": suggests the right colleague for a problem
//   - Check-in reply: a guide tip and the status of a related open request
// Hybrid: clear cases are answered by keyword rules instantly and the same way every time;
// only wording the rules can't place goes to OpenAI (with a short time limit), and the rules
// are the fallback if it's slow or offline. The person always confirms (e.g. "Change").
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

// The clear cases; null = the rules aren't sure
export function matchCategory(text: string): RequestCategory | null {
  const t = text.toLowerCase();
  // Connection and access problems first: "my laptop won't connect to the VPN" is access, not hardware
  if (/access|vpn|server|staging|password|login|log in|account|permission|wifi|wi-fi|connect/.test(t)) return "access";
  if (/laptop|keyboard|screen|monitor|mouse|charger|hardware|printer|headset/.test(t)) return "hardware";
  if (/licen[cs]e|software|install|\bide\b|\bapp\b|program|tool/.test(t)) return "software";
  if (/leave|holiday|\bmc\b|sick|medical|time off|half day/.test(t)) return "leave";
  if (/pay|salary|claim|expense|reimburs|allowance/.test(t)) return "payroll";
  return null;
}

export function guessCategory(text: string): RequestCategory {
  const t = text.toLowerCase();
  const rule = matchCategory(text);
  if (rule) return rule;
  // Nothing specific: go by who they asked for ("IT ticket", "tech support"), else HR
  if (/\bIT\b/.test(text) || /\b(tech|technical|helpdesk|help desk|computer|it support|it ticket)\b/.test(t)) return "it-other";
  return "other";
}

// "I want to submit an IT ticket" says who, but not what. Ask one short question instead of
// sending IT a ticket they can't act on.
const FILLER = new Set(
  "want need submit send raise open create make log file ticket request help support issue issues problem problems please hi hello it hr someone something urgent asap thanks thank you".split(" ")
);
export function vagueQuestion(text: string, category: RequestCategory): string | null {
  const meaningful = tokens(text).filter((w) => !FILLER.has(w));
  if (meaningful.length > 0) return null;
  const dept = REQUEST_CATEGORIES.find((c) => c.id === category)?.dept ?? "IT";
  return dept === "IT" ? "What isn't working, and since when? IT can help faster with a bit more detail." : "What would you like HR to help with?";
}

// ---------- Smart Quick request ----------

// Inside Quick request, a tip that just says "use Quick request" sends people in a circle:
// there, only offer answers they can act on themselves. Elsewhere (check-in replies) they're useful.
const sendsToRequest = (e: HandbookEntry) => /quick request/i.test(e.answer);

export async function suggestRequest(text: string, opts: { selfHelpOnly?: boolean } = {}): Promise<RequestSuggestion> {
  const t = String(text ?? "").trim().slice(0, 280);
  const usable = (e: HandbookEntry) => !opts.selfHelpOnly || !sendsToRequest(e);
  const hits = searchHandbook(t).filter((h) => usable(h.entry));
  const best = hits[0];
  const category = guessCategory(t);
  const rules: RequestSuggestion = {
    category,
    tip: best && best.score >= MIN_SCORE ? tipOf(best.entry) : null,
    askMore: vagueQuestion(t, category),
    source: "offline",
  };
  // Clear ("laptop broken", "VPN not working") or too vague to place: the rules answer instantly
  if (matchCategory(t) || rules.askMore) return rules;
  try {
    const ai = await aiJson<{ category: RequestCategory; entryId: string | null; askMore: string | null }>(
      `A new hire describes a problem they want IT or HR to help with: ${JSON.stringify(t)}
Pick the best request category id from: ${JSON.stringify(REQUEST_CATEGORIES.map((c) => ({ id: c.id, label: c.label, team: c.dept })))}
If they name a team (e.g. "IT ticket") but not the problem, use that team's "other" category.
If one of these company guide entries would probably let them solve it themselves, without a ticket, give its id, otherwise null.
Only pick an entry that gives them something to do or know; never one that just says to send a request.
${(hits.length ? hits.map((h) => h.entry) : store.handbook().filter(usable)).map((e) => JSON.stringify({ id: e.id, title: e.title, answer: e.answer })).join("\n")}
"askMore": if the description is too vague for IT or HR to act on (it doesn't say what is wrong), one short friendly question asking what's wrong; otherwise null.
Return JSON only: {"category": string, "entryId": string | null, "askMore": string | null}`,
      FAST_MS
    );
    if (ai) {
      const category = REQUEST_CATEGORIES.some((c) => c.id === ai.category) ? ai.category : guessCategory(t);
      const entry = store.handbook().find((e) => e.id === ai.entryId && usable(e));
      const askMore = typeof ai.askMore === "string" && ai.askMore.trim() ? ai.askMore.trim().slice(0, 160) : null;
      return { category, tip: entry ? tipOf(entry) : null, askMore, source: "openai" };
    }
  } catch (err) {
    console.error("[helper] OpenAI failed, using offline request suggestion:", err);
  }
  return rules;
}

// ---------- Who can help? ----------

export async function suggestColleague(text: string): Promise<ColleagueSuggestion | null> {
  const t = String(text ?? "").trim().slice(0, 200);
  const people = store.colleagues();
  if (!t) return null;

  // Rules first: the most skills in common with the problem, available people first
  const words = new Set(tokens(t));
  const rank = { available: 2, busy: 1, away: 0 };
  const top = people
    .map((c) => {
      const skills = c.helpsWith.flatMap(tokens).concat(tokens(c.role));
      const hits = c.helpsWith.filter((h) => tokens(h).some((w) => words.has(w)));
      return { c, hits, score: skills.filter((w) => words.has(w)).length * 3 + rank[c.availability] };
    })
    .sort((a, b) => b.score - a.score)[0];
  // A skill named in the problem ("staging server", "expense claim"): clear, no AI needed
  if (top && top.hits.length) return { colleagueId: top.c.id, reason: `Helps with ${top.hits.join(", ")}`, source: "offline" };

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
    console.error("[helper] OpenAI failed, no colleague suggestion:", err);
  }
  return null;
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
