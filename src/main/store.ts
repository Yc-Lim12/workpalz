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
  NEGATIVE_MOODS,
  type Action,
  type Analysis,
  type Ask,
  type CheckIn,
  type Employee,
  type HrAsk,
  type HrCheckIn,
  type HrStats,
  type Mood,
  type Notice,
  type RequestStatus,
  type SupportRequest,
  type Theme,
} from "../shared/types";
import { EMPLOYEES, seedAsks, seedCheckIns, seedRequests } from "./seed";
import { HANDBOOK } from "./handbook";

// Internal versions keep who contributed, so we can notify them later.
// These IDs never reach the HR window.
export type InternalTheme = Theme & { contributorIds: string[] };
export type InternalAnalysis = Omit<Analysis, "themes"> & { themes: InternalTheme[] };
type InternalAction = Action & { contributorIds: string[] };

type Data = {
  version: 2;
  employees: Employee[];
  checkIns: CheckIn[];
  asks: Ask[];
  requests: SupportRequest[];
  actions: InternalAction[];
  notices: Notice[];
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
  try {
    const parsed = JSON.parse(fs.readFileSync(file(), "utf8"));
    data = parsed.version === 2 ? parsed : fresh();
  } catch {
    data = fresh();
  }
  save();
}

export function resetStore() {
  data = fresh();
  save();
}

const strip = <T extends { contributorIds: string[] }>({ contributorIds: _c, ...rest }: T) => rest;

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

  addRequest(r: Omit<SupportRequest, "id" | "createdAt" | "updatedAt" | "status">) {
    data.requests.unshift({ ...r, id: randomUUID(), status: "open", createdAt: now(), updatedAt: now() });
    save();
  },

  myRequests: (employeeId: string) => data.requests.filter((r) => r.employeeId === employeeId),
  myNotices: (employeeId: string) =>
    data.notices.filter((n) => n.employeeId === employeeId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),

  markNoticeRead(id: string) {
    const n = data.notices.find((x) => x.id === id);
    if (n) n.read = true;
    save();
  },

  myData(employeeId: string) {
    return {
      employee: data.employees.find((e) => e.id === employeeId),
      checkIns: data.checkIns.filter((c) => c.employeeId === employeeId),
      questions: data.asks.filter((a) => a.employeeId === employeeId),
      requests: data.requests.filter((r) => r.employeeId === employeeId),
      notices: data.notices.filter((n) => n.employeeId === employeeId),
    };
  },

  // Right to erasure. Requests stay only if still open (IT is mid-way), but are anonymised.
  deleteMyData(employeeId: string) {
    data.checkIns = data.checkIns.filter((c) => c.employeeId !== employeeId);
    data.asks = data.asks.filter((a) => a.employeeId !== employeeId);
    data.notices = data.notices.filter((n) => n.employeeId !== employeeId);
    data.requests = data.requests
      .filter((r) => r.employeeId !== employeeId || r.status !== "resolved")
      .map((r) => (r.employeeId === employeeId ? { ...r, employeeId: "deleted", name: "Former requester" } : r));
    for (const t of data.analysis?.themes ?? []) t.contributorIds = t.contributorIds.filter((id) => id !== employeeId);
    for (const a of data.actions) a.contributorIds = a.contributorIds.filter((id) => id !== employeeId);
    save();
  },

  // ----- HR views (sanitised) -----
  hrTeams: () => Array.from(new Set(data.employees.map((e) => e.team))),

  hrCheckIns(): HrCheckIn[] {
    return data.checkIns.map(({ employeeId, shareName, ...c }) => ({
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
      topic: a.entryId ? (HANDBOOK.find((h) => h.id === a.entryId)?.title ?? null) : null,
      createdAt: a.createdAt,
    }));
  },

  hrRequests: () => data.requests,

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

  setRequestStatus(id: string, status: RequestStatus) {
    const r = data.requests.find((x) => x.id === id);
    if (!r || r.status === status) return;
    r.status = status;
    r.updatedAt = now();
    if (r.employeeId !== "deleted") {
      store.notify(
        r.employeeId,
        status === "resolved" ? "Request resolved" : "Request update",
        `Your request "${r.description}" is now ${status === "resolved" ? "resolved" : "in progress"}.`
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

  hrActions: (): Action[] => data.actions.map(strip),

  addAction(themeId: string) {
    const t = data.analysis?.themes.find((x) => x.id === themeId);
    if (!t || data.actions.some((a) => a.themeId === themeId)) return;
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
    });
    save();
  },

  // Closing the loop: everyone who raised it hears that something was done
  setActionStatus(id: string, status: Action["status"]) {
    const a = data.actions.find((x) => x.id === id);
    if (!a || a.status === status) return;
    a.status = status;
    if (status === "done") {
      for (const employeeId of a.contributorIds) {
        store.notify(employeeId, "Update on something you raised", `You and others raised: ${a.themeTitle.toLowerCase()}.\nWhat was done: ${a.action}`);
      }
    }
    save();
  },

  notify(employeeId: string, title: string, body: string) {
    data.notices.push({ id: randomUUID(), employeeId, title, body, createdAt: now(), read: false });
  },
};
