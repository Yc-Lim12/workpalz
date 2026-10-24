// Types shared by the main process and both UIs.

// ---------- Check-ins ----------

export type Mood = "great" | "okay" | "stuck" | "frustrated" | "overloaded";

export const MOODS: { id: Mood; label: string; color: string }[] = [
  { id: "great", label: "Great", color: "#4C8DFF" },
  { id: "okay", label: "Okay", color: "#8AB3FF" },
  { id: "stuck", label: "Stuck", color: "#FFC98A" },
  { id: "frustrated", label: "Frustrated", color: "#FFA94D" },
  { id: "overloaded", label: "Overloaded", color: "#E8590C" },
];

export const NEGATIVE_MOODS: Mood[] = ["stuck", "frustrated", "overloaded"];

export type Employee = {
  id: string;
  name: string;
  team: string;
  week: number; // onboarding week, 1–12
};

export type CheckIn = {
  id: string;
  employeeId: string;
  team: string;
  week: number;
  question: string;
  mood: Mood;
  note: string;
  shareName: boolean;
  // "Tell me if HR acts on this". WorkPalz, not HR, delivers the update; HR never learns who got it.
  // Older saved check-ins don't have it: treated as yes.
  notifyMe?: boolean;
  createdAt: string;
};

export type CheckInInput = { mood: Mood; note: string; shareName: boolean; notifyMe: boolean };

// ---------- Ask WorkPalz (jargon + quick search) ----------
// Answers come from the "company guide": the company's knowledge, kept in three places.

export type GuideSource = "handbook" | "it" | "glossary";

export const GUIDE_SOURCES: { id: GuideSource; label: string; holds: string }[] = [
  { id: "handbook", label: "Employee Handbook", holds: "Formal HR policy: leave, conduct, probation, pay" },
  { id: "it", label: "IT Help Centre", holds: "Systems, access and how-tos" },
  { id: "glossary", label: "Team Glossary", holds: "Company jargon, project names and rituals" },
];
export const guideLabel = (s: GuideSource | undefined) => GUIDE_SOURCES.find((g) => g.id === s)?.label ?? "Employee Handbook";

export type HandbookEntry = {
  id: string;
  title: string;
  kind: "jargon" | "policy" | "how-to";
  source: GuideSource; // where this lives; shown with every answer
  keywords: string[];
  answer: string;
  link?: string;
  linkLabel?: string;
};

// HR fills a gap in the company guide: the AI drafts (and suggests where it belongs), HR edits and publishes
export type HandbookDraft = { title: string; answer: string; keywords: string[]; place: GuideSource; source: "openai" | "offline" };
export type HandbookInput = { title: string; answer: string; keywords: string[]; place: GuideSource; askIds: string[] };
// Drafts mark facts the AI can't know like this; they must be filled in before publishing
export const DRAFT_PLACEHOLDER = "[HR:";

export type Ask = {
  id: string;
  employeeId: string;
  team: string;
  week: number;
  question: string;
  entryId: string | null;
  answered: boolean;
  createdAt: string;
};

export type AskResult = {
  answered: boolean;
  answer: string;
  entry: { title: string; from: string; link?: string; linkLabel?: string } | null; // from = "Employee Handbook" etc.
  source: "openai" | "handbook";
};

// ---------- Quick requests (IT / HR tickets) ----------

export type RequestCategory = "software" | "hardware" | "access" | "it-other" | "leave" | "payroll" | "other";

export const REQUEST_CATEGORIES: { id: RequestCategory; label: string; dept: "IT" | "HR" }[] = [
  { id: "software", label: "Software or licence", dept: "IT" },
  { id: "access", label: "System access", dept: "IT" },
  { id: "hardware", label: "Laptop or hardware", dept: "IT" },
  { id: "it-other", label: "Other IT issue", dept: "IT" },
  { id: "leave", label: "Leave", dept: "HR" },
  { id: "payroll", label: "Pay or claims", dept: "HR" },
  { id: "other", label: "Other HR question", dept: "HR" },
];

export type RequestStatus = "open" | "in_progress" | "resolved";

export const STATUS_LABEL: Record<RequestStatus, string> = {
  open: "Open",
  in_progress: "In progress",
  resolved: "Resolved",
};

export type SupportRequest = {
  id: string;
  employeeId: string;
  name: string; // requests are NOT anonymous: IT needs to know who to help
  team: string;
  category: RequestCategory;
  description: string;
  status: RequestStatus;
  createdAt: string;
  updatedAt: string;
};

export type RequestInput = { category: RequestCategory; description: string };

// ---------- AI helpers on the island (all from company data) ----------

export type GuideTip = { id: string; title: string; from: string; answer: string; link?: string; linkLabel?: string };
// askMore: the description is too vague to act on, so ask one short question (sending is still allowed)
export type RequestSuggestion = { category: RequestCategory; tip: GuideTip | null; askMore: string | null; source: "openai" | "offline" };
export type ColleagueSuggestion = { colleagueId: string; reason: string; source: "openai" | "offline" };
export type CheckInReply = {
  tip: GuideTip | null;
  openRequest: { label: string; dept: "IT" | "HR"; status: RequestStatus; days: number } | null;
};

// ---------- Themes, actions, notices ----------

export type EvidenceSource = "check-in" | "question" | "request";

export type Theme = {
  id: string;
  title: string;
  team: string;
  affected: number;
  teamSize: number;
  lastWeekAffected: number;
  severity: "high" | "medium" | "low";
  summary: string;
  evidence: { source: EvidenceSource; text: string }[];
  suggestedAction: string;
  sources: Record<EvidenceSource, number>;
};

export type Analysis = {
  generatedAt: string;
  source: "openai" | "offline";
  themes: Theme[];
};

export type Action = {
  id: string;
  themeId: string;
  themeTitle: string;
  team: string;
  action: string;
  owner: string;
  status: "open" | "done";
  createdAt: string;
  doneAt?: string;
  peopleToTell?: number; // how many will get the update (HR sees the number, never who)
};

export type Notice = {
  id: string;
  employeeId: string;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  from?: string; // set when a colleague replied to a ping (otherwise it's from HR)
};

// ---------- Ping a colleague ----------
// Person to person only: pings never reach the HR window.

export type Availability = "available" | "busy" | "away";

export type Colleague = {
  id: string;
  name: string;
  role: string;
  team: string;
  helpsWith: string[];
  availability: Availability;
};

export type Ping = {
  id: string;
  fromId: string;
  toId: string;
  toName: string;
  message: string;
  reply: string | null;
  createdAt: string;
};

export type PingInput = { colleagueId: string; message: string };

// ---------- What HR is allowed to see (no employee IDs) ----------

export type HrCheckIn = Omit<CheckIn, "employeeId" | "shareName" | "notifyMe"> & { name: string | null };
// Requests carry the name (IT needs it) but never the internal employee ID
export type HrRequest = Omit<SupportRequest, "employeeId">;
export type HrAsk = { id: string; team: string; week: number; question: string; answered: boolean; topic: string | null; createdAt: string };

// What WorkPalz has changed so far: proof the loop works
export type HrImpact = {
  requestsResolved: number;
  avgDaysToResolve: number | null;
  oldestOpenDays: number | null;
  followUpsDone: number;
  followUpsOpen: number;
  peopleTold: number; // new hires who heard "here's what we did"
  handbookAdded: number;
  questionsNowAnswered: number;
  solvedByGuide: number; // problems fixed by a guide tip instead of a ticket
  checkInRate: { thisWeek: number; lastWeek: number }; // % of new hires
};

export type HrStats = {
  newHires: number;
  checkedIn: number;
  checkIns: number;
  negative: number;
  moodCounts: Record<Mood, number>;
  openRequests: number;
  unanswered: number;
  questions: number;
};

// ---------- HR assistant ----------

export type AssistantMessage = { role: "user" | "assistant"; text: string };
// A manager only ever sees their own team, as patterns (no quotes, no single requests)
export type AssistantView = { tab: "overview" | "requests" | "questions" | "followups" | "checkins"; team: string; role: "hr" | "manager" };
export type AssistantReply = { answer: string; suggestions: string[]; source: "openai" | "offline" };

// ---------- Island ----------

export type IslandLayout = {
  notch: boolean; // macOS with a notch: island merges into it
  topInset: number; // px of notch/menu bar inside the island's top edge
};

export type IslandEvent =
  | { type: "layout"; layout: IslandLayout }
  | { type: "checkin-prompt" }
  | { type: "open" }
  | { type: "open-ask" }
  | { type: "open-request" }
  | { type: "open-ping" }
  | { type: "toggle-focus" }
  | { type: "toggle-hidden" }
  | { type: "show" }
  | { type: "hide" }
  | { type: "idle" } // shrink now (what 10 idle minutes does)
  | { type: "quiet"; until: "hour" | "tomorrow" | "off" }
  | { type: "blur" }
  | { type: "collapse" };

// Global shortcuts the person can set in Settings ("" = not set)
export type Shortcuts = { main: string; ask: string; request: string; ping: string; focus: string; toggle: string };
export const DEFAULT_SHORTCUTS: Shortcuts = {
  main: "CommandOrControl+Alt+Space",
  ask: "",
  request: "",
  ping: "",
  focus: "",
  toggle: "CommandOrControl+Alt+B",
};

// The island tells the main process what to show on the tray / menu bar icon
export type IslandStatus = { attention: number; quietUntil: number | null };

export type MyDataSummary = { checkIns: number; questions: number; requests: number; pings: number };

// ---------- window.workpalz ----------

export type WorkPalzApi = {
  // island window
  setShortcuts: (shortcuts: Shortcuts) => void;
  setInteractive: (on: boolean) => void;
  reportStatus: (status: IslandStatus) => void;
  focusIsland: () => void;
  releaseFocus: () => void;
  getLayout: () => Promise<IslandLayout>;
  onIslandEvent: (cb: (ev: IslandEvent) => void) => () => void;
  onDataChanged: (cb: () => void) => () => void;
  openLink: (url: string) => void;

  // employee
  getMe: () => Promise<Employee>;
  getQuestion: () => Promise<string>;
  submitCheckIn: (input: CheckInInput) => Promise<CheckInReply>;
  ask: (question: string) => Promise<AskResult>;
  submitRequest: (input: RequestInput) => Promise<void>;
  suggestRequest: (text: string) => Promise<RequestSuggestion>;
  solvedByGuide: (tipId: string) => Promise<void>; // "That fixed it": no ticket needed
  suggestColleague: (text: string) => Promise<ColleagueSuggestion | null>;
  listMyRequests: () => Promise<SupportRequest[]>;
  listMyNotices: () => Promise<Notice[]>;
  listColleagues: () => Promise<Colleague[]>;
  sendPing: (input: PingInput) => Promise<void>;
  listMyPings: () => Promise<Ping[]>;
  markNoticeRead: (id: string) => Promise<void>;
  getMyData: () => Promise<MyDataSummary>;
  exportMyData: () => Promise<boolean>;
  deleteMyData: () => Promise<void>;

  // HR
  hrStats: (team: string) => Promise<HrStats>;
  hrImpact: (team: string) => Promise<HrImpact>;
  hrTeams: () => Promise<string[]>;
  hrCheckIns: () => Promise<HrCheckIn[]>;
  hrAsks: () => Promise<HrAsk[]>;
  hrRequests: () => Promise<HrRequest[]>;
  setRequestStatus: (id: string, status: RequestStatus) => Promise<void>;
  analyse: () => Promise<Analysis>;
  getLastAnalysis: () => Promise<Analysis | null>;
  listActions: () => Promise<Action[]>;
  addAction: (themeId: string) => Promise<void>;
  setActionStatus: (id: string, status: Action["status"]) => Promise<void>;
  draftHandbook: (questions: string[]) => Promise<HandbookDraft>;
  publishHandbook: (input: HandbookInput) => Promise<number>;
  listHandbookAdded: () => Promise<HandbookEntry[]>;
  askAssistant: (messages: AssistantMessage[], view: AssistantView) => Promise<AssistantReply>;
  resetDemo: () => Promise<void>;
};
