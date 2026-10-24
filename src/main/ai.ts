// AI theme analysis across three VOLUNTARY sources:
//   1. negative weekly check-ins
//   2. questions the company guide couldn't answer (onboarding gaps)
//   3. open IT/HR requests
// OpenAI when a key is set; offline rule-based analyser otherwise or if the call fails.
import { NEGATIVE_MOODS, REQUEST_CATEGORIES, type Employee, type EvidenceSource, type Theme } from "../shared/types";
import { inLastWeek, inWeekBefore, store, type InternalAnalysis, type InternalTheme } from "./store";
import { aiJson } from "./openai";

type Signal = { employeeId: string; team: string; source: EvidenceSource; text: string };

function collectSignals() {
  const thisWeek: Signal[] = [];
  const lastWeek: Signal[] = [];
  const push = (when: "this" | "last" | null, s: Signal) => when && (when === "this" ? thisWeek : lastWeek).push(s);
  const period = (iso: string) => (inLastWeek(iso) ? "this" : inWeekBefore(iso) ? "last" : null);

  for (const c of store.checkIns()) {
    if (!NEGATIVE_MOODS.includes(c.mood) || !c.note) continue;
    push(period(c.createdAt), { employeeId: c.employeeId, team: c.team, source: "check-in", text: c.note });
  }
  for (const a of store.asks()) {
    if (a.answered) continue;
    push(period(a.createdAt), { employeeId: a.employeeId, team: a.team, source: "question", text: a.question });
  }
  for (const r of store.requests()) {
    if (r.employeeId === "deleted") continue; // anonymised after "delete my data": not a person to count
    const label = REQUEST_CATEGORIES.find((x) => x.id === r.category)?.label ?? r.category;
    const s: Signal = { employeeId: r.employeeId, team: r.team, source: "request", text: `${label}: ${r.description}` };
    if (r.status !== "resolved") thisWeek.push(s); // anything still open is a current problem
    else if (inWeekBefore(r.createdAt)) lastWeek.push(s);
  }
  return { thisWeek, lastWeek };
}

function teamSizes(employees: Employee[]) {
  const sizes: Record<string, number> = {};
  for (const e of employees) sizes[e.team] = (sizes[e.team] ?? 0) + 1;
  return sizes;
}

function severityFor(affected: number, size: number, lastWeek: number): Theme["severity"] {
  const r = affected / Math.max(size, 1);
  let level = r >= 0.6 ? 2 : r >= 0.3 ? 1 : 0;
  if (affected - lastWeek >= 2) level = Math.min(2, level + 1); // rising fast
  return (["low", "medium", "high"] as const)[level];
}

function pickEvidence(signals: Signal[]) {
  // Prefer one quote from each source, then fill up to 3
  const out: Signal[] = [];
  for (const src of ["check-in", "question", "request"] as const) {
    const s = signals.find((x) => x.source === src);
    if (s) out.push(s);
  }
  for (const s of signals) if (out.length < 3 && !out.includes(s)) out.push(s);
  return out.slice(0, 3).map((s) => ({ source: s.source, text: s.text }));
}

function countSources(signals: Signal[]) {
  const c: Record<EvidenceSource, number> = { "check-in": 0, question: 0, request: 0 };
  for (const s of signals) c[s.source]++;
  return c;
}

export async function analyse(): Promise<InternalAnalysis> {
  const { thisWeek, lastWeek } = collectSignals();
  const employees = store.employees();

  try {
    const themes = await analyseWithAi(thisWeek, lastWeek, employees);
    if (themes) return { generatedAt: new Date().toISOString(), source: "openai", themes };
  } catch (err) {
    console.error("[ai] OpenAI failed, using offline analyser:", err);
  }
  return { generatedAt: new Date().toISOString(), source: "offline", themes: analyseOffline(thisWeek, lastWeek, employees) };
}

// Same team + title = same theme across analyses, so follow-ups stay matched after Re-analyse
const themeId = (team: string, title: string) =>
  `${team}:${title}`.toLowerCase().replace(/[^a-z0-9:]+/g, "-").replace(/^-|-$/g, "");

// ---------- OpenAI ----------

async function analyseWithAi(thisWeek: Signal[], lastWeek: Signal[], employees: Employee[]): Promise<InternalTheme[] | null> {
  const sizes = teamSizes(employees);

  // Names and IDs never leave the device. P1, P2… only let the AI count unique people.
  const alias = new Map<string, string>();
  const back = new Map<string, string>();
  const pid = (id: string) => {
    if (!alias.has(id)) {
      const p = `P${alias.size + 1}`;
      alias.set(id, p);
      back.set(p, id);
    }
    return alias.get(id)!;
  };
  const rows = [
    ...thisWeek.map((s) => ({ period: "this week", person: pid(s.employeeId), team: s.team, source: s.source, text: s.text })),
    ...lastWeek.map((s) => ({ period: "last week", person: pid(s.employeeId), team: s.team, source: s.source, text: s.text })),
  ];

  const result = await aiJson<{
    themes: {
      title: string;
      team: string;
      people: string[];
      lastWeekPeople: number;
      summary: string;
      evidence: { source: EvidenceSource; text: string }[];
      suggestedAction: string;
    }[];
  }>(`You help an HR team spot early onboarding problems for new hires (first 90 days).
All data below is VOLUNTARY and anonymised. Sources:
- "check-in": a weekly check-in where the person said they were stuck, frustrated or overloaded
- "question": a question the company guide (handbook, IT help, glossary) could NOT answer (an onboarding gap)
- "request": an open IT/HR request

New hires per team: ${JSON.stringify(sizes)}
Signals:
${rows.map((r) => JSON.stringify(r)).join("\n")}

Group THIS WEEK's signals into recurring themes per team. Rules:
- A theme needs at least 2 different people in the same team.
- "people" = the person codes (this week only) behind the theme.
- "lastWeekPeople" = how many different people in that team had the same problem last week.
- Describe the work problem only. Never guess emotions, personality or performance.
- "suggestedAction" = one concrete step HR, IT or the manager can take this week.
- "evidence" = up to 3 items copied exactly from the signals, mixing sources where possible.
- Titles: short and plain, e.g. "Waiting on tools, licences or access".

Return JSON only: {"themes":[{"title":string,"team":string,"people":string[],"lastWeekPeople":number,"summary":string,"evidence":[{"source":string,"text":string}],"suggestedAction":string}]}`);

  if (!result) return null;

  return (result.themes ?? [])
    .map((t) => {
      const team = String(t.team);
      const teamSize = sizes[team] ?? 0;
      const contributorIds = Array.from(
        new Set((t.people ?? []).map((p) => back.get(p)).filter((id): id is string => !!id && employees.find((e) => e.id === id)?.team === team))
      );
      const affected = contributorIds.length;
      const lastWeekAffected = Math.max(0, Math.min(Number(t.lastWeekPeople) || 0, teamSize));
      const themeSignals = thisWeek.filter((s) => contributorIds.includes(s.employeeId));
      return {
        id: themeId(team, String(t.title)),
        title: String(t.title),
        team,
        affected,
        teamSize,
        lastWeekAffected,
        severity: severityFor(affected, teamSize, lastWeekAffected),
        summary: String(t.summary ?? ""),
        evidence: (t.evidence ?? []).slice(0, 3).map((e) => ({ source: e.source, text: String(e.text) })),
        suggestedAction: String(t.suggestedAction ?? ""),
        sources: countSources(themeSignals),
        contributorIds,
      };
    })
    .filter((t) => t.teamSize > 0 && t.affected >= 2)
    .sort(byUrgency);
}

// ---------- Offline fallback ----------

type Rule = { title: string; match: RegExp; summary: string; action: string };

const RULES: Rule[] = [
  {
    title: "Waiting on tools, licences or access",
    match: /licen[cs]e|access|laptop|install|account|permission|staging|server|software|hardware|dev tools/i,
    summary: "New hires can't start real work because software, accounts or system access aren't ready.",
    action: "Ask IT to clear the pending licence and access requests today, and add a 'ready on day 1' checklist to onboarding.",
  },
  {
    title: "Unclear priorities or expectations",
    match: /priorit|unclear|not sure which|success looks|expectation|two different answers/i,
    summary: "New hires are getting mixed messages about what to focus on and what good work looks like.",
    action: "Manager to share written 30-day goals and one clear top priority in this week's 1:1.",
  },
  {
    title: "Little feedback or manager contact",
    match: /1:1|one-on-one|more feedback|no feedback|haven't met|haven't had/i,
    summary: "New hires aren't getting regular feedback or 1:1 time with their manager yet.",
    action: "Schedule a 20-minute 1:1 with each affected new hire within the next 3 days.",
  },
  {
    title: "Workload pressure",
    match: /overload|too much|overtime|deadline|late night|workload/i,
    summary: "New hires feel the amount of work is too high for their stage of onboarding.",
    action: "Manager to review task load and pause one non-essential task.",
  },
  {
    title: "Not feeling part of the team",
    match: /lonely|left out|don't know anyone|isolated|no one to ask/i,
    summary: "New hires don't feel connected to their team yet.",
    action: "Set up a team lunch and check the buddy is meeting them weekly.",
  },
];

const GAP_RULE: Rule = {
  title: "Questions the company guide can't answer",
  match: /.*/,
  summary: "Several new hires asked the same thing and the company guide had no answer. This is an onboarding gap.",
  action: "Add an answer to the company guide for these questions and mention it in the next onboarding session.",
};

function analyseOffline(thisWeek: Signal[], lastWeek: Signal[], employees: Employee[]): InternalTheme[] {
  const sizes = teamSizes(employees);
  const themes: InternalTheme[] = [];
  const used = new Set<Signal>();

  const build = (rule: Rule, pool: Signal[], lastPool: Signal[]) => {
    const byTeam = new Map<string, Signal[]>();
    for (const s of pool) if (rule.match.test(s.text)) byTeam.set(s.team, [...(byTeam.get(s.team) ?? []), s]);

    for (const [team, signals] of byTeam) {
      const contributorIds = Array.from(new Set(signals.map((s) => s.employeeId)));
      if (contributorIds.length < 2) continue;
      signals.forEach((s) => used.add(s));
      const teamSize = sizes[team] ?? contributorIds.length;
      const lastWeekAffected = new Set(lastPool.filter((s) => s.team === team && rule.match.test(s.text)).map((s) => s.employeeId)).size;
      themes.push({
        id: themeId(team, rule.title),
        title: rule.title,
        team,
        affected: contributorIds.length,
        teamSize,
        lastWeekAffected,
        severity: severityFor(contributorIds.length, teamSize, lastWeekAffected),
        summary: rule.summary,
        evidence: pickEvidence(signals),
        suggestedAction: rule.action,
        sources: countSources(signals),
        contributorIds,
      });
    }
  };

  for (const rule of RULES) build(rule, thisWeek, lastWeek);

  // Leftover unanswered questions = gaps in the company guide
  const leftoverQuestions = thisWeek.filter((s) => s.source === "question" && !used.has(s));
  build(
    GAP_RULE,
    leftoverQuestions,
    lastWeek.filter((s) => s.source === "question")
  );
  for (const gap of themes.filter((t) => t.title === GAP_RULE.title)) {
    gap.suggestedAction = `Add an answer to the company guide for "${gap.evidence[0]?.text}" and mention it in the next onboarding session.`;
  }

  return themes.sort(byUrgency);
}

const RANK = { high: 0, medium: 1, low: 2 };
function byUrgency(a: Theme, b: Theme) {
  return RANK[a.severity] - RANK[b.severity] || b.affected / b.teamSize - a.affected / a.teamSize;
}
