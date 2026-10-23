// HR assistant: one AI that knows everything on the HR dashboard.
// It only sees what HR already sees (the hr* views), minus names: requests and
// opted-in check-ins carry names for HR, but names are never sent to the AI.
// A manager's assistant only gets their own team, without check-in notes or
// request details, so it can't point at individuals (enforced here, not in the UI).
// OpenAI when a key is set; a simple offline answerer otherwise.
import { DRAFT_PLACEHOLDER, GUIDE_SOURCES, guideLabel, REQUEST_CATEGORIES, type GuideSource, type AssistantMessage, type HandbookDraft, type AssistantReply, type AssistantView } from "../shared/types";
import { store } from "./store";
import { tokens } from "./ask";
import { aiJson } from "./openai";

const MAX_ROWS = 150;
const daysAgo = (iso: string) => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000));
const dept = (category: string) => REQUEST_CATEGORIES.find((c) => c.id === category);

function snapshot(view: AssistantView) {
  const manager = view.role === "manager";
  const mine = <T extends { team: string }>(x: T) => !manager || x.team === view.team;
  const teams = manager ? store.hrTeams().filter((t) => t === view.team) : store.hrTeams();
  const analysis = store.hrAnalysis();
  return {
    today: new Date().toDateString(),
    stats: Object.fromEntries((manager ? teams : ["All", ...teams]).map((t) => [t, store.hrStats(t)])),
    impact: store.hrImpact(manager ? view.team : "All"),
    themes: (analysis?.themes ?? []).filter(mine).map((t) => ({
      title: t.title,
      team: t.team,
      affected: `${t.affected} of ${t.teamSize}`,
      lastWeek: t.lastWeekAffected,
      severity: t.severity,
      summary: t.summary,
      suggestedAction: t.suggestedAction,
    })),
    themesAnalysed: analysis ? `${daysAgo(analysis.generatedAt)} days ago` : "not yet (HR can press Analyse on Overview)",
    checkIns: store
      .hrCheckIns()
      .filter(mine)
      .slice(-MAX_ROWS)
      .map((c) => ({ team: c.team, week: c.week, mood: c.mood, note: manager ? undefined : c.note, daysAgo: daysAgo(c.createdAt) })),
    questions: store
      .hrAsks()
      .filter(mine)
      .slice(-MAX_ROWS)
      .map((a) => ({ team: a.team, question: a.question, answeredByCompanyGuide: a.answered, topic: a.topic, daysAgo: daysAgo(a.createdAt) })),
    requests: store
      .hrRequests()
      .filter(mine)
      .slice(0, MAX_ROWS)
      .map((r) => ({
        team: r.team,
        goesTo: dept(r.category)?.dept,
        category: dept(r.category)?.label ?? r.category,
        description: manager ? undefined : r.description,
        status: r.status,
        daysOpen: daysAgo(r.createdAt),
      })),
    followUps: store.hrActions().filter(mine).map((a) => ({ theme: a.themeTitle, team: a.team, action: a.action, owner: a.owner, status: a.status })),
    companyGuide: store.handbook().map((h) => `${h.title} (${guideLabel(h.source)})`),
  };
}

type Snapshot = ReturnType<typeof snapshot>;

const PAGE: Record<AssistantView["tab"], string> = {
  overview: "Overview (stats and AI themes)",
  requests: "Requests",
  questions: "Questions",
  followups: "Follow-ups",
  checkins: "Check-ins",
};

export async function askAssistant(messages: AssistantMessage[], view: AssistantView): Promise<AssistantReply> {
  const history = messages.slice(-8).map((m) => ({ role: m.role, text: String(m.text).slice(0, 1000) }));
  const question = history.filter((m) => m.role === "user").pop()?.text.trim() ?? "";
  const data = snapshot(view);
  const who =
    view.role === "manager"
      ? `the ${view.team} manager. They only see patterns for their own team, never individuals`
      : "HR. They can see every team";

  try {
    const ai = await aiJson<{ answer: string; suggestions?: string[] }>(`You are the WorkPalz assistant. You help support new hires in their first 90 days.
You are talking to ${who}. All data is voluntary (check-ins, questions to the company guide, IT/HR requests) and has no names.

Rules:
- Answer only from the DATA below. If the data doesn't say, say so plainly.
- Never try to work out who an anonymous person is. Never judge anyone's personality or performance.
- Talk about work problems and concrete next steps HR, IT or a manager can take.
- Be short: 2 to 6 sentences, or a few lines starting with "- ". Plain text, no markdown headings or bold.
- Use numbers from the data ("3 of 5 in Engineering"). Point to the dashboard page where HR can act, e.g. "see Requests".
- "suggestions": up to 3 short follow-up questions HR might ask next.

They are on the ${PAGE[view.tab]} page, team: ${view.team}. Unless they say otherwise, focus on that team.

DATA:
${JSON.stringify(data)}

CONVERSATION:
${history.map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.text}`).join("\n")}

Return JSON only: {"answer": string, "suggestions": string[]}`);
    if (ai?.answer) {
      return { answer: String(ai.answer), suggestions: (ai.suggestions ?? []).slice(0, 3).map(String), source: "openai" };
    }
  } catch (err) {
    console.error("[assistant] OpenAI failed, using offline answers:", err);
  }
  return answerOffline(question, view, data);
}

// ---------- Offline fallback: keyword intents over the same data ----------

function answerOffline(question: string, view: AssistantView, d: Snapshot): AssistantReply {
  const q = question.toLowerCase();
  const team = Object.keys(d.stats).find((t) => t !== "All" && q.includes(t.toLowerCase())) ?? view.team;
  const inTeam = <T extends { team: string }>(x: T) => team === "All" || x.team === team;
  const where = team === "All" ? "across all teams" : `in ${team}`;
  const s = d.stats[team] ?? d.stats.All ?? Object.values(d.stats)[0];
  const hr = view.role === "hr";
  const lines: string[] = [];

  const openRequests = d.requests.filter((r) => inTeam(r) && r.status !== "resolved").sort((a, b) => b.daysOpen - a.daysOpen);
  const gaps = d.questions.filter((a) => inTeam(a) && !a.answeredByCompanyGuide);
  const themes = d.themes.filter(inTeam);
  const followUps = d.followUps.filter((f) => inTeam(f) && f.status === "open");

  if (/request|ticket|licen|access|laptop|it\b|overdue|waiting|longest/.test(q)) {
    lines.push(`${openRequests.length} open request${openRequests.length === 1 ? "" : "s"} ${where}.`);
    for (const r of openRequests.slice(0, 4)) lines.push(`- ${r.category} (${r.team}, ${r.goesTo}): open ${r.daysOpen} days.${r.description ? ` "${r.description}"` : ""}`);
    if (openRequests.length) lines.push(hr ? "Oldest first. Update them on the Requests page." : "Oldest first. HR and IT handle the details.");
  } else if (/question|handbook|guide|gap|faq|answer/.test(q)) {
    lines.push(`${gaps.length} question${gaps.length === 1 ? "" : "s"} ${where} had no answer in the company guide.`);
    for (const a of gaps.slice(0, 4)) lines.push(`- "${a.question}" (${a.team})`);
    if (gaps.length) lines.push("Adding answers to the company guide would close the gap. See Questions.");
  } else if (/follow|action|done|todo|to-do/.test(q)) {
    lines.push(`${followUps.length} open follow-up${followUps.length === 1 ? "" : "s"} ${where}.`);
    for (const f of followUps.slice(0, 4)) lines.push(`- ${f.action} (owner: ${f.owner})`);
  } else if (/check.?in|mood|feel|saying|stuck|frustrat|overload/.test(q)) {
    const notes = d.checkIns.filter((c) => inTeam(c) && c.daysAgo < 7 && ["stuck", "frustrated", "overloaded"].includes(c.mood) && c.note);
    lines.push(`This week ${where}: ${s.negative} of ${s.checkIns} check-ins said stuck, frustrated or overloaded.`);
    for (const c of notes.slice(0, 4)) lines.push(`- ${c.mood} (${c.team}): "${c.note}"`);
  } else if (themes.length || /theme|problem|issue|struggl|why|worst|most|priority|help/.test(q)) {
    if (!themes.length) lines.push(`No AI themes ${where} yet. Press Analyse on the Overview page first.`);
    for (const t of themes.slice(0, 3)) lines.push(`- ${t.title} (${t.team}, ${t.affected}, ${t.severity}). Suggested: ${t.suggestedAction}`);
  }

  if (!lines.length || /summar|overview|how is|how are|week/.test(q)) {
    lines.unshift(
      `This week ${where}: ${s.checkedIn} of ${s.newHires} new hires checked in, ${s.negative} said stuck, frustrated or overloaded, ${s.openRequests} open requests, ${s.unanswered} unanswered questions.`
    );
  }
  lines.push("(Offline mode: add an OpenAI key for full answers.)");

  return {
    answer: lines.join("\n"),
    suggestions: ["Which requests have waited longest?", "What should we add to the company guide?", "Summarise this week"],
    source: "offline",
  };
}

// ---------- Drafts for questions the company guide couldn't answer ----------
// The AI doesn't know this company's real facts, so anything company-specific
// becomes an "[HR: ...]" placeholder that HR must fill in before publishing.

export async function draftHandbookEntry(questions: string[]): Promise<HandbookDraft> {
  const qs = questions.map((q) => String(q).trim().slice(0, 200)).filter(Boolean).slice(0, 10);
  const examples = store
    .handbook()
    .slice(0, 3)
    .map((h) => JSON.stringify({ place: h.source, title: h.title, answer: h.answer }));

  try {
    const ai = await aiJson<{ title: string; answer: string; keywords: string[]; place: GuideSource }>(`You help HR write an entry for the company guide for new hires.
The company guide has three parts:
${GUIDE_SOURCES.map((g) => `- "${g.id}" = ${g.label}: ${g.holds}`).join("\n")}
New hires asked these questions and the company guide had no answer:
${qs.map((q) => `- ${JSON.stringify(q)}`).join("\n")}

Write ONE entry that answers them. Rules:
- You do NOT know this company's real facts. Never invent names, teams, systems, numbers, links or policies.
  Wherever a company-specific fact is needed, write a placeholder like "${DRAFT_PLACEHOLDER} who approves this]".
- 2 to 4 short, friendly sentences in plain English, in the same style as these existing entries:
${examples.join("\n")}
- "place": where it belongs: "handbook" only for formal HR policy, "it" for systems/access/how-tos, "glossary" for jargon or names.
- "title": short and plain, like a heading in that part of the guide.
- "keywords": 4 to 8 short lowercase words or phrases a new hire might type when asking this.

Return JSON only: {"title": string, "answer": string, "keywords": string[], "place": "handbook" | "it" | "glossary"}`);
    if (ai?.title && ai.answer) {
      return {
        title: String(ai.title).slice(0, 80),
        answer: String(ai.answer).slice(0, 1000),
        keywords: (ai.keywords ?? []).map((k) => String(k).toLowerCase().slice(0, 40)).slice(0, 8),
        place: GUIDE_SOURCES.some((g) => g.id === ai.place) ? ai.place : guessPlace(qs),
        source: "openai",
      };
    }
  } catch (err) {
    console.error("[assistant] OpenAI failed, using an offline draft:", err);
  }

  const first = qs[0] ?? "";
  const title = first.replace(/[?.!]+$/, "");
  return {
    title: (title.charAt(0).toUpperCase() + title.slice(1)).slice(0, 80),
    answer: `${DRAFT_PLACEHOLDER} write the answer here]. If you're still unsure, ask your onboarding buddy.`,
    keywords: Array.from(new Set(qs.flatMap(tokens))).slice(0, 8),
    place: guessPlace(qs),
    source: "offline",
  };
}

// Offline guess at where an answer belongs; HR can change it before publishing
function guessPlace(questions: string[]): GuideSource {
  const q = questions.join(" ").toLowerCase();
  if (/access|server|vpn|laptop|install|licen[cs]e|password|wifi|wi-fi|system|account|printer|email/.test(q)) return "it";
  if (/what (is|does|are)|\bmean|stand for|acronym/.test(q)) return "glossary";
  return "handbook";
}
