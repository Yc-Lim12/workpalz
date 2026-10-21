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
  createdAt: string;
};

export type CheckInInput = { mood: Mood; note: string; shareName: boolean };

// ---------- Ask WorkPalz (jargon + quick search) ----------

export type HandbookEntry = {
  id: string;
  title: string;
  kind: "jargon" | "policy" | "how-to";
  keywords: string[];
  answer: string;
  link?: string;
  linkLabel?: string;
};

// HR fills a handbook gap: the AI drafts, HR edits and publishes
export type HandbookDraft = { title: string; answer: string; keywords: string[]; source: "openai" | "offline" };
export type HandbookInput = { title: string; answer: string; keywords: string[]; askIds: string[] };
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
  entry: { title: string; link?: string; linkLabel?: string } | null;
  source: "openai" | "handbook";
};

// ---------- Quick requests (IT / HR tickets) ----------

export type RequestCategory = "software" | "hardware" | "access" | "leave" | "payroll" | "other";

export const REQUEST_CATEGORIES: { id: RequestCategory; label: string; dept: "IT" | "HR" }[] = [
  { id: "software", label: "Software or licence", dept: "IT" },
  { id: "access", label: "System access", dept: "IT" },
  { id: "hardware", label: "Laptop or hardware", dept: "IT" },
  { id: "leave", label: "Leave", dept: "HR" },
  { id: "payroll", label: "Pay or claims", dept: "HR" },
  { id: "other", label: "Something else", dept: "HR" },
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

export type HrCheckIn = Omit<CheckIn, "employeeId" | "shareName"> & { name: string | null };
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

export type MyDataSummary = { checkIns: number; questions: number; requests: number; pings: number };

// ---------- window.workpalz ----------

export type WorkPalzApi = {
  // island window
  setShortcuts: (shortcuts: Shortcuts) => void;
  setInteractive: (on: boolean) => void;
  focusIsland: () => void;
  releaseFocus: () => void;
  getLayout: () => Promise<IslandLayout>;
  onIslandEvent: (cb: (ev: IslandEvent) => void) => () => void;
  onDataChanged: (cb: () => void) => () => void;
  openLink: (url: string) => void;

  // employee
  getMe: () => Promise<Employee>;
  getQuestion: () => Promise<string>;
  submitCheckIn: (input: CheckInInput) => Promise<void>;
  ask: (question: string) => Promise<AskResult>;
  submitRequest: (input: RequestInput) => Promise<void>;
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
  hrRequests: () => Promise<SupportRequest[]>;
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
