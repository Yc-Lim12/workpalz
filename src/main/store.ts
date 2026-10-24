// Local JSON store for the demo. All reads/writes go through here, so swapping
// to Supabase/Postgres later only touches this file.
//
// Privacy rule enforced here: anything sent to the HR window goes through an
// `hr*` function that strips employee IDs (and names, unless the employee opted in).
import { app } from "electron";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  guideLabel,
  NEGATIVE_MOODS,
  STATUS_LABEL,
  type Action,
  type Analysis,
  type Ask,
  type HandbookEntry,
  type HandbookInput,
  type CheckIn,
  type Employee,
  type HrAsk,
  type HrCheckIn,
  type HrImpact,
  type HrRequest,
  type HrStats,
  type Mood,
  type Notice,
  type Ping,
  type RequestStatus,
  type SupportRequest,
  type Theme,
} from "../shared/types";
import { COLLEAGUES, EMPLOYEES, seedAsks, seedCheckIns, seedRequests } from "./seed";
import { HANDBOOK } from "./handbook";

// Internal versions keep who contributed, so we can notify them later.
// These IDs never reach the HR window.
export type InternalTheme = Theme & { contributorIds: string[] };
export type InternalAnalysis = Omit<Analysis, "themes"> & { themes: InternalTheme[] };
// notifyIds: who asked to hear back, fixed when the follow-up is created (from their check-ins then),
// so a later check-in can't silently change who gets told about this one
type InternalAction = Action & { contributorIds: string[]; notifyIds?: string[] };

type Data = {
  version: 2;
  employees: Employee[];
  checkIns: CheckIn[];
  asks: Ask[];
  requests: SupportRequest[];
  actions: InternalAction[];
  notices: Notice[];
  pings: Ping[];
  handbook: HandbookEntry[]; // entries HR added to fill gaps
  solvedByGuide: { team: string; tipId: string; at: string }[]; // "That fixed it", no ticket needed
  analysis: InternalAnalysis | null;
};

const WEEK = 7 * 24 * 60 * 60 * 1000;
export const inLastWeek = (iso: string) => Date.now() - new Date(iso).getTime() < WEEK;
export const inWeekBefore = (iso: string) => {
  const age = Date.now() - new Date(iso).getTime();
  return age >= WEEK && age < 2 * WEEK;
};

let data: Data;
const file = () => path.join(app.getPath("userData"), "workpalz-data.json");
const now = () => new Date().toISOString();

function fresh(): Data {
  return {
    version: 2,
    employees: EMPLOYEES,
    checkIns: seedCheckIns(),
    asks: seedAsks(),
    requests: seedRequests(),
    actions: [],
    notices: [],
    pings: [],
    handbook: [],
    solvedByGuide: [],
    analysis: null,
  };
}

function save() {
  // Write to a temp file then rename, so a crash never leaves a half-written file
  const tmp = file() + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, file());
}

export function loadStore() {
  let raw: string | null = null;
  try {
    raw = fs.readFileSync(file(), "utf8");
    const parsed = JSON.parse(raw);
    if (parsed.version !== 2) throw new Error("unknown version");
    data = parsed;
    // Fill in anything an older or partly written file doesn't have
    const f = fresh();
    data.employees ??= f.employees;
    data.checkIns ??= [];
    data.asks ??= [];
    data.requests ??= [];
    data.actions ??= [];
    data.notices ??= [];
    data.pings ??= [];
    data.handbook ??= [];
    data.solvedByGuide ??= [];
    data.analysis ??= null;
    for (const a of data.actions) a.contributorIds ??= [];
    for (const t of data.analysis?.themes ?? []) t.contributorIds ??= [];
  } catch {
    // Unreadable: keep a copy instead of silently overwriting it, then start fresh
    if (raw !== null) {
      try {
        fs.writeFileSync(file() + ".bak", raw);
      } catch {}
    }
    data = fresh();
  }
  save();
}

// Bumped on reset and "delete my data": slow work (AI) started before must not save stale results
let generation = 0;
export const storeGeneration = () => generation;

export function resetStore() {
  generation++;
  data = fresh();
  save();
}

const strip = <T extends { contributorIds: string[] }>({ contributorIds: _c, ...rest }: T) => rest;

// Who gets told when a follow-up is done (older saved follow-ups: decide from check-ins now)
const toTell = (a: InternalAction) => (a.notifyIds ?? a.contributorIds.filter(wantsUpdates)).filter((id) => a.contributorIds.includes(id));

// A person's latest check-in says whether they want updates when HR acts on what they raised
function wantsUpdates(employeeId: string) {
  const latest = data.checkIns.filter((c) => c.employeeId === employeeId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  return latest?.notifyMe !== false;
}

export const store = {
  // ----- raw (main process only) -----
  employees: () => data.employees,
  employee: (id: string) => data.employees.find((e) => e.id === id),
  checkIns: () => data.checkIns,
  asks: () => data.asks,
  requests: () => data.requests,
  internalAnalysis: () => data.analysis,

  // ----- employee writes -----
  addCheckIn(c: Omit<CheckIn, "id" | "createdAt">) {
    data.checkIns.push({ ...c, id: randomUUID(), createdAt: now() });
    save();
  },

  addAsk(a: Omit<Ask, "id" | "createdAt">) {
    data.asks.push({ ...a, id: randomUUID(), createdAt: now() });
    save();
  },

  addRequest(r: Omit<SupportRequest, "id" | "createdAt" | "updatedAt" | "status">): SupportRequest {
    const req: SupportRequest = { ...r, id: randomUUID(), status: "open", createdAt: now(), updatedAt: now() };
    data.requests.unshift(req);
    save();
    return req;
  },

  myRequests: (employeeId: string) => data.requests.filter((r) => r.employeeId === employeeId),
  myNotices: (employeeId: string) =>
    data.notices.filter((n) => n.employeeId === employeeId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),

  markNoticeRead(id: string) {
    const n = data.notices.find((x) => x.id === id);
    if (n) n.read = true;
    save();
  },

  // The whole company guide. Entries HR added before sources existed count as Employee Handbook.
  handbook: (): HandbookEntry[] => [...HANDBOOK, ...data.handbook.map((h) => ({ ...h, source: h.source ?? "handbook" }))],
  handbookAdded: (): HandbookEntry[] => data.handbook.map((h) => ({ ...h, source: h.source ?? "handbook" })),

  // Publishing closes the loop: the questions count as answered, and whoever asked hears about it.
  // Returns how many people were told.
  publishHandbookEntry(input: HandbookInput): number {
    const entry: HandbookEntry = {
      id: `hr-${randomUUID()}`,
      title: input.title,
      kind: input.place === "glossary" ? "jargon" : input.place === "it" ? "how-to" : "policy",
      source: input.place,
      keywords: input.keywords,
      answer: input.answer,
    };
    data.handbook.push(entry);
    const askers = new Map<string, string>();
    for (const a of data.asks) {
      if (a.answered || !input.askIds.includes(a.id)) continue;
      a.answered = true;
      a.entryId = entry.id;
      askers.set(a.employeeId, a.question);
    }
    for (const [employeeId, question] of [...askers].filter(([id]) => wantsUpdates(id))) {
      store.notify(employeeId, "Your question has an answer", `You asked: "${question}"\nThe ${guideLabel(entry.source)} now covers it: ${entry.title}. Ask WorkPalz to read it.`);
    }
    save();
    return [...askers.keys()].filter(wantsUpdates).length;
  },

  addSolvedByGuide(team: string, tipId: string) {
    data.solvedByGuide.push({ team, tipId, at: now() });
    save();
  },

  colleagues: () => COLLEAGUES,
  colleague: (id: string) => COLLEAGUES.find((c) => c.id === id),

  addPing(p: Omit<Ping, "id" | "createdAt" | "reply">): Ping {
    const ping = { ...p, id: randomUUID(), reply: null, createdAt: now() };
    data.pings.unshift(ping);
    save();
    return ping;
  },

  replyToPing(id: string, from: string, reply: string) {
    const p = data.pings.find((x) => x.id === id);
    if (!p) return; // deleted or demo reset in the meantime
    p.reply = reply;
    store.notify(p.fromId, `${from.split(" ")[0]} replied`, reply, from);
    save();
  },

  myPings: (employeeId: string) => data.pings.filter((p) => p.fromId === employeeId),

  myData(employeeId: string) {
    return {
      employee: data.employees.find((e) => e.id === employeeId),
      checkIns: data.checkIns.filter((c) => c.employeeId === employeeId),
      questions: data.asks.filter((a) => a.employeeId === employeeId),
      requests: data.requests.filter((r) => r.employeeId === employeeId),
      notices: data.notices.filter((n) => n.employeeId === employeeId),
      pings: data.pings.filter((p) => p.fromId === employeeId),
    };
  },

  // Right to erasure. Requests stay only if still open (IT is mid-way), but are anonymised.
  deleteMyData(employeeId: string) {
    generation++;
    data.checkIns = data.checkIns.filter((c) => c.employeeId !== employeeId);
    data.asks = data.asks.filter((a) => a.employeeId !== employeeId);
    data.notices = data.notices.filter((n) => n.employeeId !== employeeId);
    data.pings = data.pings.filter((p) => p.fromId !== employeeId);
    data.requests = data.requests
      .filter((r) => r.employeeId !== employeeId || r.status !== "resolved")
      .map((r) => (r.employeeId === employeeId ? { ...r, employeeId: "deleted", name: "Former requester" } : r));
    for (const a of data.actions) {
      a.contributorIds = a.contributorIds.filter((id) => id !== employeeId);
      if (a.notifyIds) a.notifyIds = a.notifyIds.filter((id) => id !== employeeId);
    }
    // AI themes quote check-ins, questions and requests. If any came from this person, the themes
    // have to go (HR presses Analyse again) so none of their words stay visible.
    if (data.analysis?.themes.some((t) => t.contributorIds.includes(employeeId))) data.analysis = null;
    save();
  },

  // ----- HR views (sanitised) -----
  hrTeams: () => Array.from(new Set(data.employees.map((e) => e.team))),

  hrCheckIns(): HrCheckIn[] {
    return data.checkIns.map(({ employeeId, shareName, notifyMe: _n, ...c }) => ({
      ...c,
      name: shareName ? (data.employees.find((e) => e.id === employeeId)?.name ?? null) : null,
    }));
  },

  hrAsks(): HrAsk[] {
    return data.asks.map((a) => ({
      id: a.id,
      team: a.team,
      week: a.week,
      question: a.question,
      answered: a.answered,
      topic: a.entryId ? (store.handbook().find((h) => h.id === a.entryId)?.title ?? null) : null,
      createdAt: a.createdAt,
    }));
  },

  hrRequests: (): HrRequest[] => data.requests.map(({ employeeId: _e, ...r }) => r),

  hrStats(team: string): HrStats {
    const inTeam = <T extends { team: string }>(x: T) => team === "All" || x.team === team;
    const people = data.employees.filter(inTeam);
    const recent = data.checkIns.filter((c) => inTeam(c) && inLastWeek(c.createdAt));
    const moodCounts = { great: 0, okay: 0, stuck: 0, frustrated: 0, overloaded: 0 } as Record<Mood, number>;
    for (const c of recent) moodCounts[c.mood]++;
    const asks = data.asks.filter((a) => inTeam(a) && inLastWeek(a.createdAt));
    return {
      newHires: people.length,
      checkedIn: new Set(recent.map((c) => c.employeeId)).size,
      checkIns: recent.length,
      negative: recent.filter((c) => NEGATIVE_MOODS.includes(c.mood)).length,
      moodCounts,
      openRequests: data.requests.filter((r) => inTeam(r) && r.status !== "resolved").length,
      unanswered: asks.filter((a) => !a.answered).length,
      questions: asks.length,
    };
  },

  hrImpact(team: string): HrImpact {
    const inTeam = <T extends { team: string }>(x: T) => team === "All" || x.team === team;
    const days = (from: string, to: string) => (new Date(to).getTime() - new Date(from).getTime()) / 86400000;
    const resolved = data.requests.filter((r) => inTeam(r) && r.status === "resolved");
    const open = data.requests.filter((r) => inTeam(r) && r.status !== "resolved");
    const actions = data.actions.filter(inTeam);
    const done = actions.filter((a) => a.status === "done");
    const people = data.employees.filter(inTeam).length || 1;
    const rate = (pick: (iso: string) => boolean) =>
      Math.round((new Set(data.checkIns.filter((x) => inTeam(x) && pick(x.createdAt)).map((x) => x.employeeId)).size / people) * 100);
    return {
      requestsResolved: resolved.length,
      avgDaysToResolve: resolved.length ? Math.round((resolved.reduce((s, r) => s + days(r.createdAt, r.updatedAt), 0) / resolved.length) * 10) / 10 : null,
      oldestOpenDays: open.length ? Math.floor(Math.max(...open.map((r) => days(r.createdAt, now())))) : null,
      followUpsDone: done.length,
      followUpsOpen: actions.length - done.length,
      peopleTold: new Set(done.flatMap(toTell)).size,
      // Entries HR added that answered this team's questions (company-wide when "All")
      handbookAdded:
        team === "All"
          ? data.handbook.length
          : new Set(data.asks.filter((a) => inTeam(a) && a.entryId?.startsWith("hr-")).map((a) => a.entryId)).size,
      questionsNowAnswered: data.asks.filter((a) => inTeam(a) && a.entryId?.startsWith("hr-")).length,
      solvedByGuide: data.solvedByGuide.filter(inTeam).length,
      checkInRate: { thisWeek: rate(inLastWeek), lastWeek: rate(inWeekBefore) },
    };
  },

  setRequestStatus(id: string, status: RequestStatus) {
    const r = data.requests.find((x) => x.id === id);
    if (!r || r.status === status) return;
    r.status = status;
    r.updatedAt = now();
    if (r.employeeId !== "deleted") {
      store.notify(
        r.employeeId,
        status === "resolved" ? "Request resolved" : "Request update",
        `Your request "${r.description}" is now ${STATUS_LABEL[status].toLowerCase()}.`
      );
    }
    save();
  },

  setAnalysis(a: InternalAnalysis) {
    data.analysis = a;
    save();
  },

  hrAnalysis(): Analysis | null {
    if (!data.analysis) return null;
    return { ...data.analysis, themes: data.analysis.themes.map(strip) };
  },

  hrActions: (): Action[] =>
    data.actions.map((a) => {
      const { notifyIds: _n, ...rest } = a; // who exactly is never sent to HR, only how many
      return { ...strip(rest), peopleToTell: toTell(a).length };
    }),

  addAction(themeId: string) {
    const t = data.analysis?.themes.find((x) => x.id === themeId);
    // Re-analysing gives the same theme again: one follow-up per team + theme, so nobody is told twice
    if (!t || data.actions.some((a) => a.themeId === themeId || (a.team === t.team && a.themeTitle === t.title))) return;
    data.actions.unshift({
      id: randomUUID(),
      themeId,
      themeTitle: t.title,
      team: t.team,
      action: t.suggestedAction,
      owner: `${t.team} manager`,
      status: "open",
      createdAt: now(),
      contributorIds: [...t.contributorIds],
      notifyIds: t.contributorIds.filter(wantsUpdates),
    });
    save();
  },

  // Closing the loop: everyone who raised it hears that something was done
  setActionStatus(id: string, status: Action["status"]): number {
    const a = data.actions.find((x) => x.id === id);
    if (!a || a.status === status) return 0;
    a.status = status;
    a.doneAt = status === "done" ? now() : undefined;
    if (status === "done") {
      for (const employeeId of toTell(a)) {
        store.notify(employeeId, "Update on something you raised", `You and others raised: ${a.themeTitle.toLowerCase()}.\nWhat was done: ${a.action}`);
      }
    }
    save();
    return status === "done" ? toTell(a).length : 0;
  },

  notify(employeeId: string, title: string, body: string, from?: string) {
    data.notices.push({ id: randomUUID(), employeeId, title, body, createdAt: now(), read: false, from });
  },
};
