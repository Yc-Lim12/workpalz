// Requests, Questions, Follow-ups and Check-ins (with the check-in question setup) tabs.
import { useId, useState } from "react";
import {
  DRAFT_PLACEHOLDER,
  FALLBACK_QUESTION,
  GUIDE_SOURCES,
  guideLabel,
  MOODS,
  ONBOARDING_WEEKS,
  REQUEST_CATEGORIES,
  STATUS_LABEL,
  type Action,
  type CheckInQuestion,
  type HandbookDraft,
  type HandbookEntry,
  type HandbookInput,
  type GuideSource,
  type HrAsk,
  type HrCheckIn,
  type HrQuestionStats,
  type RequestStatus,
  type HrRequest,
  type SupportRequest,
} from "../../../shared/types";
import { Button, C, Card, Chip, Empty, ago } from "./ui";

const th = "px-4 py-3 text-left text-[12px] font-bold uppercase tracking-wide";
const td = "px-4 py-3.5 align-top text-[14px]";

function Title({ title, intro }: { title: string; intro: string }) {
  return (
    <div className="flex flex-col gap-1">
      <h1 className="m-0 text-[24px] font-bold tracking-tight">{title}</h1>
      <p className="m-0 text-[13px]" style={{ color: C.muted }}>
        {intro}
      </p>
    </div>
  );
}

// ---------- Requests ----------

const STATUS_STYLE: Record<RequestStatus, { bg: string; fg: string }> = {
  open: { bg: "var(--hr-amber-bg)", fg: "var(--hr-amber-fg)" },
  in_progress: { bg: "var(--hr-blue-soft)", fg: "var(--hr-blue-text)" },
  resolved: { bg: "var(--hr-green-bg)", fg: "var(--hr-green-fg)" },
};

export function RequestsTab({ requests, onStatus }: { requests: HrRequest[]; onStatus: (id: string, s: RequestStatus) => void }) {
  const sorted = [...requests].sort((a, b) => (a.status === "resolved" ? 1 : 0) - (b.status === "resolved" ? 1 : 0) || b.createdAt.localeCompare(a.createdAt));
  return (
    <div className="flex flex-col gap-5">
      <Title title="IT & HR requests" intro="Sent from the island. Changing the status notifies the employee straight away." />
      {sorted.length === 0 ? (
        <Empty>No requests yet.</Empty>
      ) : (
        <Card className="overflow-x-auto !p-0">
          <table className="w-full min-w-[760px] border-collapse">
            <caption className="sr-only">IT and HR requests from new hires</caption>
            <thead style={{ color: C.muted }}>
              <tr className="border-b border-[color:var(--hr-line-soft)]">
                <th scope="col" className={th}>Requester</th>
                <th scope="col" className={th}>Type</th>
                <th scope="col" className={th}>Details</th>
                <th scope="col" className={th}>Opened</th>
                <th scope="col" className={th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <RequestRow key={r.id} r={r} onStatus={onStatus} />
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

function RequestRow({ r, onStatus }: { r: HrRequest; onStatus: (id: string, s: RequestStatus) => void }) {
  const id = useId();
  const cat = REQUEST_CATEGORIES.find((c) => c.id === r.category);
  return (
    <tr className="border-b border-[color:var(--hr-line-soft)] last:border-0">
      <th scope="row" className={`${td} text-left font-semibold`}>
        {r.name}
        <div className="text-[12.5px] font-normal" style={{ color: C.muted }}>
          {r.team}
        </div>
      </th>
      <td className={td}>
        {cat?.label}
        <div className="text-[12.5px]" style={{ color: C.muted }}>
          {cat?.dept}
        </div>
      </td>
      <td className={`${td} max-w-[340px]`}>{r.description}</td>
      <td className={`${td} whitespace-nowrap`} style={{ color: C.muted }}>
        {ago(r.createdAt)}
      </td>
      <td className={td}>
        <label htmlFor={id} className="sr-only">
          Status for {r.name}'s request
        </label>
        <select
          id={id}
          value={r.status}
          onChange={(e) => onStatus(r.id, e.target.value as RequestStatus)}
          className="min-h-10 rounded-lg border-0 px-2.5 text-[13px] font-semibold"
          style={{ background: STATUS_STYLE[r.status].bg, color: STATUS_STYLE[r.status].fg }}
        >
          {(Object.keys(STATUS_LABEL) as RequestStatus[]).map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </td>
    </tr>
  );
}

// ---------- Questions ----------

// Group questions that use the same key words ("staging server access" ≈ "how do I get access to the staging server")
const STOP = new Set("a an the is are do does i me my to of for in on at and or how what who where when which can get please".split(" "));
const words = (s: string) => new Set(s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((w) => w && !STOP.has(w)));
const similar = (a: Set<string>, b: Set<string>, ta: string, tb: string) => {
  // No usable words (e.g. "How do I?", or not written in English letters): group exact repeats only
  if (!a.size || !b.size) return ta.trim().toLowerCase() === tb.trim().toLowerCase();
  const shared = [...a].filter((w) => b.has(w)).length;
  return shared / Math.max(1, new Set([...a, ...b]).size) >= 0.5;
};

// After a panel closes, put keyboard focus somewhere sensible instead of the top of the page
const focusSoon = (id: string) => window.setTimeout(() => document.getElementById(id)?.focus(), 0);

type Gap = { text: string; key: Set<string>; count: number; teams: Set<string>; last: string; ids: string[]; questions: Set<string> };

export function QuestionsTab({
  asks,
  added,
  onDraft,
  onPublish,
}: {
  asks: HrAsk[];
  added: HandbookEntry[];
  onDraft?: (questions: string[]) => Promise<HandbookDraft>;
  onPublish?: (input: HandbookInput) => Promise<void>; // left out = read only (manager view)
}) {
  const [editing, setEditing] = useState<string | null>(null);

  // Unanswered questions grouped by wording: each group is a possible gap in onboarding docs
  const groups: Gap[] = [];
  for (const a of [...asks].filter((x) => !x.answered).sort((x, y) => x.createdAt.localeCompare(y.createdAt))) {
    const key = words(a.question);
    let g = groups.find((x) => similar(x.key, key, x.text, a.question));
    if (!g) {
      g = { text: a.question, key, count: 0, teams: new Set<string>(), last: a.createdAt, ids: [], questions: new Set<string>() };
      groups.push(g);
    }
    g.count++;
    g.ids.push(a.id);
    g.questions.add(a.question);
    g.teams.add(a.team);
    if (a.createdAt > g.last) g.last = a.createdAt;
  }
  const gapList = groups.sort((a, b) => b.count - a.count);

  const topics = new Map<string, number>();
  for (const a of asks) if (a.topic) topics.set(a.topic, (topics.get(a.topic) ?? 0) + 1);
  const topicList = [...topics.entries()].sort((a, b) => b[1] - a[1]);

  return (
    <div className="flex flex-col gap-5">
      <Title
        title="Questions new hires ask"
        intro="From Ask WorkPalz. Anonymous, by team only. Questions the company guide (Employee Handbook, IT Help Centre, Team Glossary) can't answer show where onboarding is missing something. Let the AI draft an answer, check it, and publish it to the right place."
      />
      <div className="flex flex-wrap gap-4">
        <Card as="section" className="flex min-w-0 flex-[2_1_420px] flex-col gap-3">
          <h2 id="gaps-title" tabIndex={-1} className="m-0 text-[16px] font-bold outline-none">Not in the company guide</h2>
          {gapList.length === 0 ? (
            <p className="m-0 text-[14px]" style={{ color: C.muted }}>
              Every question was answered.
            </p>
          ) : (
            <ul className="m-0 flex list-none flex-col p-0">
              {gapList.map((g) => (
                <li key={g.ids[0]} className="flex flex-col gap-3 border-t border-[color:var(--hr-line-soft)] py-3 first:border-0 first:pt-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="flex-1 text-[14px] font-semibold">{g.text}</span>
                    <span className="text-[13px]" style={{ color: C.muted }}>
                      {[...g.teams].join(", ")} · {ago(g.last)}
                    </span>
                    <Chip bg={g.count > 1 ? "var(--hr-amber-bg)" : "var(--hr-neutral-bg)"} fg={g.count > 1 ? "var(--hr-amber-fg)" : "var(--hr-neutral-fg)"}>
                      Asked {g.count}×
                    </Chip>
                    {onDraft && editing !== g.ids[0] && (
                      <Button id={`draft-${g.ids[0]}`} variant="muted" className="!min-h-9 !px-3 text-[13px]" onClick={() => setEditing(g.ids[0])}>
                        <span aria-hidden="true">✦ </span>Draft answer with AI
                      </Button>
                    )}
                  </div>
                  {onDraft && onPublish && editing === g.ids[0] && (
                    <GapEditor
                      gap={g}
                      onDraft={onDraft}
                      onCancel={() => {
                        setEditing(null);
                        focusSoon(`draft-${g.ids[0]}`); // back to the button that opened it
                      }}
                      onPublish={async (input) => {
                        await onPublish(input);
                        setEditing(null);
                        focusSoon("gaps-title"); // the row is gone (answered): go to the list heading
                      }}
                    />
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card as="section" className="flex min-w-0 flex-[1_1_280px] flex-col gap-3">
          <h2 className="m-0 text-[16px] font-bold">Most looked-up topics</h2>
          <ol className="m-0 flex flex-col gap-2 pl-5 text-[14px]">
            {topicList.map(([topic, n]) => (
              <li key={topic}>
                {topic} <span style={{ color: C.muted }}>({n})</span>
              </li>
            ))}
          </ol>
          {added.length > 0 && (
            <>
              <h2 className="m-0 mt-3 text-[16px] font-bold">Added by HR</h2>
              <ul className="m-0 flex flex-col gap-2 pl-5 text-[14px]">
                {added.map((h) => (
                  <li key={h.id}>
                    {h.title} <span style={{ color: C.muted }}>({guideLabel(h.source)})</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

// AI drafts, HR checks and fills in the [HR: ...] parts, then publishes
function GapEditor({
  gap,
  onDraft,
  onCancel,
  onPublish,
}: {
  gap: Gap;
  onDraft: (questions: string[]) => Promise<HandbookDraft>;
  onCancel: () => void;
  onPublish: (input: HandbookInput) => Promise<void>;
}) {
  const id = useId();
  const [draft, setDraft] = useState<HandbookDraft | null>(null);
  const [title, setTitle] = useState("");
  const [answer, setAnswer] = useState("");
  const [keywords, setKeywords] = useState("");
  const [place, setPlace] = useState<GuideSource>("handbook");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const run = async () => {
    setBusy(true);
    setError("");
    try {
      const d = await onDraft([...gap.questions]);
      setDraft(d);
      setTitle(d.title);
      setAnswer(d.answer);
      setKeywords(d.keywords.join(", "));
      setPlace(d.place);
    } catch {
      setError("Couldn't draft an answer. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const unfilled = title.includes(DRAFT_PLACEHOLDER) || answer.includes(DRAFT_PLACEHOLDER);
  const canPublish = !!title.trim() && !!answer.trim() && !unfilled && !busy;

  const publish = async () => {
    if (!canPublish) return;
    setBusy(true);
    setError("");
    try {
      await onPublish({
        title: title.trim(),
        answer: answer.trim(),
        keywords: keywords.split(",").map((k) => k.trim()).filter(Boolean),
        place,
        askIds: gap.ids,
      });
    } catch {
      setError("Couldn't publish. Please try again.");
      setBusy(false);
    }
  };

  const field = "w-full rounded-xl border border-[color:var(--hr-input-border)] bg-[color:var(--hr-surface)] px-3.5 text-[14px] outline-none focus:ring-2 focus:ring-[color:var(--hr-blue)]";

  if (!draft) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-xl bg-[color:var(--hr-blue-soft)] p-3.5">
        <p className="m-0 flex-1 text-[13.5px]" style={{ color: C.blueText }}>
          The AI writes a first draft from {gap.questions.size === 1 ? "this question" : `these ${gap.questions.size} questions`}. It never makes up company facts: those are left as [HR: …] for you to fill in.
        </p>
        <Button autoFocus onClick={run} disabled={busy}>
          {busy ? "Drafting…" : "Draft it"}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        {error && (
          <p role="alert" className="m-0 w-full text-[13px]" style={{ color: "var(--hr-red-fg)" }}>
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl bg-[color:var(--hr-subtle)] p-4">
      <p className="m-0 text-[12.5px]" style={{ color: C.muted }}>
        Draft by {draft.source === "openai" ? "OpenAI" : "the offline helper (add an OpenAI key for a full draft)"}. Check every word before publishing.
      </p>
      <fieldset className="m-0 flex flex-col gap-1.5 border-0 p-0">
        <legend className="mb-1.5 p-0 text-[13px] font-semibold">Where does this belong?</legend>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-2">
          {GUIDE_SOURCES.map((g) => (
            <label
              key={g.id}
              className="flex cursor-pointer items-start gap-2 rounded-xl border border-[color:var(--hr-border)] bg-[color:var(--hr-surface)] p-3"
              style={{ outline: place === g.id ? "2px solid var(--hr-blue)" : undefined }}
            >
              <input type="radio" name={`${id}-place`} checked={place === g.id} onChange={() => setPlace(g.id)} className="mt-0.5 h-4 w-4 shrink-0 accent-[color:var(--hr-blue)]" />
              <span className="flex flex-col gap-0.5">
                <span className="text-[13.5px] font-semibold">{g.label}</span>
                <span className="text-[12px]" style={{ color: C.muted }}>
                  {g.holds}
                </span>
              </span>
            </label>
          ))}
        </div>
        {place === "handbook" && (
          <p className="m-0 text-[12.5px]" style={{ color: C.muted }}>
            The Employee Handbook is formal policy: check the wording with whoever owns the policy before publishing.
          </p>
        )}
      </fieldset>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${id}-title`} className="text-[13px] font-semibold">
          Title
        </label>
        <input id={`${id}-title`} autoFocus value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} className={`${field} min-h-11`} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${id}-answer`} className="text-[13px] font-semibold">
          Answer new hires will see
        </label>
        <textarea
          id={`${id}-answer`}
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          maxLength={1000}
          rows={4}
          aria-describedby={unfilled ? `${id}-unfilled` : undefined}
          className={`${field} resize-y py-2.5 leading-relaxed`}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${id}-kw`} className="text-[13px] font-semibold">
          Search words <span style={{ color: C.muted }}>(comma separated)</span>
        </label>
        <input id={`${id}-kw`} value={keywords} onChange={(e) => setKeywords(e.target.value)} className={`${field} min-h-11`} />
      </div>
      {unfilled && (
        <p id={`${id}-unfilled`} className="m-0 text-[13px] font-semibold" style={{ color: "var(--hr-amber-fg)" }}>
          Replace the [HR: …] parts with the real details before publishing.
        </p>
      )}
      {error && (
        <p role="alert" className="m-0 text-[13px]" style={{ color: "var(--hr-red-fg)" }}>
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button onClick={publish} disabled={!canPublish}>
          {busy ? "Publishing…" : `Publish to ${guideLabel(place)}`}
        </Button>
        <Button variant="ghost" onClick={run} disabled={busy}>
          Redraft
        </Button>
        <Button variant="ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
      </div>
      <p className="m-0 text-[12.5px]" style={{ color: C.muted }}>
        Publishing adds it to Ask WorkPalz straight away and lets the {gap.count === 1 ? "new hire who asked" : `${gap.count} new hires who asked`} know.
      </p>
    </div>
  );
}

// ---------- Follow-ups ----------

export function FollowUpsTab({ actions, onStatus }: { actions: Action[]; onStatus: (id: string, s: Action["status"]) => void }) {
  return (
    <div className="flex flex-col gap-5">
      <Title
        title="Follow-ups"
        intro="Marking a follow-up done tells the new hires who raised it, and asked to hear back, that action was taken. WorkPalz delivers it: you see how many are told, never who."
      />
      {actions.length === 0 ? (
        <Empty>No follow-ups yet. Create one from an AI theme on the Overview.</Empty>
      ) : (
        <Card>
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {actions.map((a) => (
              <li key={a.id}>
                <label className="flex cursor-pointer items-start gap-3 rounded-xl p-3 hover:bg-[color:var(--hr-bg)]">
                  <input
                    type="checkbox"
                    checked={a.status === "done"}
                    onChange={(e) => onStatus(a.id, e.target.checked ? "done" : "open")}
                    className="mt-0.5 h-5 w-5 shrink-0 accent-[color:var(--hr-blue)]"
                  />
                  <span className="flex flex-col gap-1">
                    <span className={`text-[14.5px] ${a.status === "done" ? "line-through" : ""}`} style={{ color: a.status === "done" ? "var(--hr-muted)" : C.text }}>
                      {a.action}
                    </span>
                    <span className="text-[12.5px]" style={{ color: C.muted }}>
                      {a.themeTitle} · {a.owner} · created {ago(a.createdAt)} ·{" "}
                      {a.status === "done"
                        ? `${a.peopleToTell ?? 0} new hire${a.peopleToTell === 1 ? " was" : "s were"} told`
                        : `will tell ${a.peopleToTell ?? 0} new hire${a.peopleToTell === 1 ? "" : "s"}, you won't see who`}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

// ---------- Check-ins ----------

// [3, 8, 9, 10, 11, 12] → "Weeks 3, 8–12"
function weeksLabel(weeks: number[]) {
  if (!weeks.length) return "Not scheduled";
  const parts: string[] = [];
  for (let i = 0; i < weeks.length; i++) {
    let j = i;
    while (j + 1 < weeks.length && weeks[j + 1] === weeks[j] + 1) j++;
    parts.push(j > i ? `${weeks[i]}–${weeks[j]}` : `${weeks[i]}`);
    i = j;
  }
  return `${weeks.length === 1 ? "Week" : "Weeks"} ${parts.join(", ")}`;
}

const ALL_WEEKS = Array.from({ length: ONBOARDING_WEEKS }, (_, i) => i + 1);
const field = "w-full rounded-xl border border-[color:var(--hr-input-border)] bg-[color:var(--hr-surface)] px-3.5 text-[14px] outline-none focus:ring-2 focus:ring-[color:var(--hr-blue)]";
const share = (q: HrQuestionStats) => (q.answers ? q.struggling / q.answers : 0);
// Plain copies of the questions, the shape the main process saves
const plain = (qs: HrQuestionStats[]): CheckInQuestion[] => qs.map((q) => ({ id: q.id, text: q.text, weeks: [...q.weeks] }));

type SaveQuestions = (questions: CheckInQuestion[], done: string) => Promise<void>;

// "Q1", "Q2"…: a short name so the weekly schedule stays readable when the wording is cut off
const qNum = (questions: HrQuestionStats[], id: string) => `Q${questions.findIndex((q) => q.id === id) + 1}`;

function QTag({ children }: { children: string }) {
  return (
    <span className="shrink-0 rounded-md bg-[color:var(--hr-blue-soft)] px-1.5 py-0.5 text-[12px] font-bold" style={{ color: C.blueText }}>
      {children}
    </span>
  );
}

function MoodBar({ q, className = "" }: { q: HrQuestionStats; className?: string }) {
  return (
    <div className={`flex h-2 gap-0.5 overflow-hidden rounded-full bg-[color:var(--hr-neutral-bg)] ${className}`} aria-hidden="true">
      {MOODS.map((m) => (q.moodCounts[m.id] ? <div key={m.id} style={{ flex: q.moodCounts[m.id], background: m.color }} /> : null))}
    </div>
  );
}

function StrugglingChip({ q }: { q: HrQuestionStats }) {
  const worrying = q.answers >= 2 && share(q) >= 0.4;
  return (
    <Chip bg={worrying ? "var(--hr-amber-bg)" : "var(--hr-neutral-bg)"} fg={worrying ? "var(--hr-amber-fg)" : "var(--hr-neutral-fg)"}>
      {Math.round(share(q) * 100)}% struggling
    </Chip>
  );
}

// The full breakdown, shown when a question row is opened
function QuestionDetails({ q }: { q: HrQuestionStats }) {
  return (
    <div className="flex flex-col gap-2 rounded-xl bg-[color:var(--hr-subtle)] p-3.5 text-[13px]" style={{ color: C.muted }}>
      <p className="m-0">
        <span className="font-semibold text-[color:var(--hr-text)]">{q.answers}</span> answer{q.answers === 1 ? "" : "s"} from {q.people}{" "}
        {q.people === 1 ? "person" : "people"} · {q.thisWeek} this week · {q.struggling} stuck, frustrated or overloaded
        {q.hardestTeam && (
          <>
            {" "}
            · Hardest for <span className="font-semibold text-[color:var(--hr-text)]">{q.hardestTeam.team}</span> ({q.hardestTeam.struggling} of {q.hardestTeam.answers})
          </>
        )}
      </p>
      <ul className="m-0 flex list-none flex-wrap gap-x-3 gap-y-1 p-0 text-[12.5px]">
        {MOODS.map((m) => (
          <li key={m.id} className="flex items-center gap-1.5">
            <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full" style={{ background: m.color }} />
            {m.label}: <span className="font-semibold text-[color:var(--hr-text)]">{q.moodCounts[m.id]}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// One place to see and change what each of the 12 weeks asks. Same size however many questions there are.
function WeekSchedule({ questions, onSave, busy }: { questions: HrQuestionStats[]; onSave: SaveQuestions; busy: boolean }) {
  const id = useId();
  const owner = (w: number) => questions.find((q) => q.weeks.includes(w));
  const missing = ALL_WEEKS.filter((w) => !owner(w));

  const assign = (w: number, questionId: string) => {
    const next = plain(questions).map((q) => ({
      ...q,
      weeks: q.id === questionId ? [...q.weeks.filter((x) => x !== w), w].sort((a, b) => a - b) : q.weeks.filter((x) => x !== w),
    }));
    const q = questions.find((x) => x.id === questionId);
    onSave(next, q ? `Week ${w} now asks "${q.text}"` : `Week ${w} now asks the general question`);
  };

  return (
    <Card as="section" aria-labelledby={`${id}-title`} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 id={`${id}-title`} className="m-0 text-[16px] font-bold">
          Weekly schedule
        </h2>
        <p className="m-0 text-[13px]" style={{ color: C.muted }}>
          Each onboarding week asks one question. Changes reach new hires at their next check-in.
        </p>
      </div>
      <ol className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2 p-0">
        {ALL_WEEKS.map((w) => {
          const q = owner(w);
          return (
            <li
              key={w}
              className="flex flex-col gap-1 rounded-xl border p-2.5"
              style={{ borderColor: q ? "var(--hr-line)" : "var(--hr-amber-fg)", background: q ? "var(--hr-surface)" : C.amberBg }}
            >
              <label htmlFor={`${id}-w${w}`} className="text-[12px] font-bold uppercase tracking-wide" style={{ color: q ? C.muted : C.amberText }}>
                Week {w}
              </label>
              <select
                id={`${id}-w${w}`}
                value={q?.id ?? FALLBACK_QUESTION.id}
                disabled={busy}
                onChange={(e) => assign(w, e.target.value)}
                title={q ? `${qNum(questions, q.id)} · ${q.text}` : FALLBACK_QUESTION.text}
                className="min-h-10 w-full truncate rounded-lg border border-[color:var(--hr-input-border)] bg-[color:var(--hr-surface)] px-2 text-[13px] text-[color:var(--hr-text)]"
              >
                {questions.map((x) => (
                  <option key={x.id} value={x.id}>
                    {qNum(questions, x.id)} · {x.text}
                  </option>
                ))}
                <option value={FALLBACK_QUESTION.id}>General: {FALLBACK_QUESTION.text}</option>
              </select>
            </li>
          );
        })}
      </ol>
      {missing.length > 0 && (
        <p className="m-0 text-[13px] font-semibold" style={{ color: C.amberText }}>
          {weeksLabel(missing)} {missing.length === 1 ? "asks" : "ask"} the general question "{FALLBACK_QUESTION.text}"
        </p>
      )}
    </Card>
  );
}

// Inline editor for one question's wording (used for new and existing questions)
function QuestionEditor({ label, initial, busy, onSave, onCancel }: { label: string; initial: string; busy: boolean; onSave: (text: string) => void; onCancel: () => void }) {
  const id = useId();
  const [text, setText] = useState(initial);
  const ok = !!text.trim() && !busy;
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (ok) onSave(text.trim());
      }}
    >
      <div className="flex min-w-[240px] flex-1 flex-col gap-1.5">
        <label htmlFor={id} className="text-[13px] font-semibold">
          {label}
        </label>
        <input
          id={id}
          autoFocus
          value={text}
          maxLength={140}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.stopPropagation();
              onCancel();
            }
          }}
          className={`${field} min-h-11`}
        />
      </div>
      <Button type="submit" disabled={!ok}>
        {busy ? "Saving…" : "Save"}
      </Button>
      <Button variant="ghost" disabled={busy} onClick={onCancel}>
        Cancel
      </Button>
    </form>
  );
}

type Sort = "schedule" | "struggling" | "answers";

function QuestionList({ questions, fallback, onSave, busy }: { questions: HrQuestionStats[]; fallback?: HrQuestionStats; onSave: SaveQuestions; busy: boolean }) {
  const id = useId();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<Sort>("schedule");

  const firstWeek = (q: HrQuestionStats) => q.weeks[0] ?? ONBOARDING_WEEKS + 1; // not scheduled: last
  const shown = questions
    .filter((q) => q.text.toLowerCase().includes(search.trim().toLowerCase()))
    .sort((a, b) =>
      sort === "struggling" ? share(b) - share(a) || b.answers - a.answers : sort === "answers" ? b.answers - a.answers : firstWeek(a) - firstWeek(b)
    );

  // A failed save keeps the editor open (the error shows above the list)
  const tried = (p: Promise<void>) => p.then(() => true, () => false);
  const add = async (text: string) => {
    if (!(await tried(onSave([...plain(questions), { id: `q-${Date.now()}`, text, weeks: [] }], `Question added. Pick its weeks in the weekly schedule.`)))) return;
    setAdding(false);
    focusSoon(`${id}-add`);
  };
  const rename = async (qid: string, text: string) => {
    if (!(await tried(onSave(plain(questions).map((q) => (q.id === qid ? { ...q, text } : q)), "Question saved")))) return;
    setEditing(null);
    focusSoon(`${id}-edit-${qid}`);
  };
  const remove = async (qid: string) => {
    if (!(await tried(onSave(plain(questions).filter((q) => q.id !== qid), "Question removed")))) return;
    setRemoving(null);
    focusSoon(`${id}-add`);
  };
  const toggle = (qid: string) =>
    setOpen((s) => {
      const next = new Set(s);
      if (next.has(qid)) next.delete(qid);
      else next.add(qid);
      return next;
    });

  return (
    <Card as="section" aria-labelledby={`${id}-title`} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 id={`${id}-title`} className="m-0 mr-auto text-[16px] font-bold">
          Questions <span className="font-semibold" style={{ color: C.muted }}>({questions.length})</span>
        </h2>
        {questions.length > 8 && (
          <>
            <label htmlFor={`${id}-search`} className="sr-only">
              Search questions
            </label>
            <input
              id={`${id}-search`}
              type="search"
              placeholder="Search questions"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`${field} min-h-10 !w-[220px]`}
            />
          </>
        )}
        <label className="flex items-center gap-1.5 text-[12.5px]" style={{ color: C.muted }}>
          Sort
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            className="min-h-10 rounded-lg border border-[color:var(--hr-input-border)] bg-[color:var(--hr-surface)] px-2.5 text-[13px] text-[color:var(--hr-text)]"
          >
            <option value="schedule">By week</option>
            <option value="struggling">Most struggling</option>
            <option value="answers">Most answers</option>
          </select>
        </label>
        {!adding && (
          <Button id={`${id}-add`} className="!min-h-10 text-[13.5px]" onClick={() => setAdding(true)} disabled={busy}>
            + Add question
          </Button>
        )}
      </div>

      {adding && (
        <div className="rounded-xl bg-[color:var(--hr-subtle)] p-3.5">
          <QuestionEditor
            label="New question"
            initial=""
            busy={busy}
            onSave={add}
            onCancel={() => {
              setAdding(false);
              focusSoon(`${id}-add`);
            }}
          />
        </div>
      )}

      {shown.length === 0 ? (
        <p className="m-0 text-[14px]" style={{ color: C.muted }}>
          {questions.length ? "No questions match your search." : "No questions yet. Every week asks the general question."}
        </p>
      ) : (
        <ul className="m-0 flex list-none flex-col p-0">
          {shown.map((q) => (
            <li key={q.id} className="flex flex-col gap-2.5 border-t border-[color:var(--hr-line-soft)] py-3 first:border-0 first:pt-0">
              {editing === q.id ? (
                <QuestionEditor
                  label="Question"
                  initial={q.text}
                  busy={busy}
                  onSave={(t) => rename(q.id, t)}
                  onCancel={() => {
                    setEditing(null);
                    focusSoon(`${id}-edit-${q.id}`);
                  }}
                />
              ) : (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <button
                    type="button"
                    aria-expanded={open.has(q.id)}
                    onClick={() => toggle(q.id)}
                    className="flex min-h-11 min-w-0 flex-[1_1_320px] cursor-pointer items-center gap-2 rounded-lg bg-transparent px-1 text-left"
                  >
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 16 16"
                      className="h-4 w-4 shrink-0 transition-transform motion-reduce:transition-none"
                      style={{ color: C.muted, transform: open.has(q.id) ? "rotate(90deg)" : undefined }}
                    >
                      <path d="M6 3.5 10.5 8 6 12.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <QTag>{qNum(questions, q.id)}</QTag>
                    <span className="flex min-w-0 flex-col">
                      <span className="text-[14.5px] font-semibold">{q.text}</span>
                      <span className="text-[12.5px]" style={{ color: q.weeks.length ? C.muted : C.amberText }}>
                        {weeksLabel(q.weeks)}
                      </span>
                    </span>
                  </button>
                  <span className="w-[88px] text-[13px]" style={{ color: C.muted }}>
                    {q.answers} answer{q.answers === 1 ? "" : "s"}
                  </span>
                  {q.answers ? <StrugglingChip q={q} /> : <span className="text-[13px]" style={{ color: C.muted }}>No answers yet</span>}
                  <MoodBar q={q} className="w-[120px]" />
                  <span className="flex gap-1">
                    <Button id={`${id}-edit-${q.id}`} variant="ghost" className="!min-h-10 !px-3 text-[13px]" aria-label={`Edit "${q.text}"`} disabled={busy} onClick={() => setEditing(q.id)}>
                      Edit
                    </Button>
                    <Button variant="ghost" className="!min-h-10 !px-3 text-[13px]" aria-label={`Remove "${q.text}"`} disabled={busy} onClick={() => setRemoving(q.id)}>
                      Remove
                    </Button>
                  </span>
                </div>
              )}
              {removing === q.id && (
                <div role="alert" className="flex flex-wrap items-center gap-2 rounded-xl p-3" style={{ background: C.amberBg }}>
                  <span className="flex-1 text-[13px]" style={{ color: C.amberText }}>
                    Remove this question?{" "}
                    {q.weeks.length ? `${weeksLabel(q.weeks)} will ask the general question instead.` : ""} Past answers stay in All check-ins.
                  </span>
                  <Button variant="dark" className="!min-h-10 text-[13px]" autoFocus disabled={busy} onClick={() => remove(q.id)}>
                    Remove
                  </Button>
                  <Button variant="ghost" className="!min-h-10 text-[13px]" disabled={busy} onClick={() => setRemoving(null)}>
                    Keep it
                  </Button>
                </div>
              )}
              {open.has(q.id) && editing !== q.id && <QuestionDetails q={q} />}
            </li>
          ))}
        </ul>
      )}

      {fallback && (
        <div className="flex flex-col gap-2 border-t border-[color:var(--hr-line-soft)] pt-3">
          <p className="m-0 text-[14px] font-semibold">
            General: {FALLBACK_QUESTION.text} <span className="text-[12.5px] font-normal" style={{ color: C.muted }}>asked in weeks without a question</span>
          </p>
          <QuestionDetails q={fallback} />
        </div>
      )}
    </Card>
  );
}

function CheckInHistory({ checkIns }: { checkIns: HrCheckIn[] }) {
  const sorted = [...checkIns].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (sorted.length === 0) return <Empty>No check-ins yet.</Empty>;
  return (
    <Card className="overflow-x-auto !p-0">
      <table className="w-full min-w-[760px] border-collapse">
        <caption className="sr-only">Weekly check-ins from new hires</caption>
        <thead style={{ color: C.muted }}>
          <tr className="border-b border-[color:var(--hr-line-soft)]">
            <th scope="col" className={th}>From</th>
            <th scope="col" className={th}>Question</th>
            <th scope="col" className={th}>Answer</th>
            <th scope="col" className={th}>Comment</th>
            <th scope="col" className={th}>When</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((c) => {
            const m = MOODS.find((x) => x.id === c.mood)!;
            return (
              <tr key={c.id} className="border-b border-[color:var(--hr-line-soft)] last:border-0">
                <th scope="row" className={`${td} text-left font-semibold`}>
                  {c.name ?? `${c.team} new hire`}
                  <div className="text-[12.5px] font-normal" style={{ color: C.muted }}>
                    Week {c.week}
                    {c.name ? ` · ${c.team}` : ""}
                  </div>
                </th>
                <td className={`${td} max-w-[220px]`} style={{ color: C.muted }}>
                  {c.question}
                </td>
                <td className={td}>
                  <Chip bg="var(--hr-neutral-bg)" fg="var(--hr-text2)">
                    <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full" style={{ background: m.color }} />
                    {m.label}
                  </Chip>
                </td>
                <td className={`${td} max-w-[320px]`}>{c.note || <span style={{ color: C.muted }}>No comment</span>}</td>
                <td className={`${td} whitespace-nowrap`} style={{ color: C.muted }}>
                  {ago(c.createdAt)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}

export function CheckInsTab({ checkIns, questions, onSaveQuestions }: { checkIns: HrCheckIn[]; questions: HrQuestionStats[]; onSaveQuestions: SaveQuestions }) {
  const [view, setView] = useState<"questions" | "all">("questions");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const asked = questions.filter((q) => q.id !== FALLBACK_QUESTION.id);
  const fallback = questions.find((q) => q.id === FALLBACK_QUESTION.id);

  // Every change saves straight away; a failure keeps the editor open (the caller awaits)
  const save: SaveQuestions = async (next, done) => {
    setBusy(true);
    setError("");
    try {
      await onSaveQuestions(next, done);
    } catch (e) {
      setError("Couldn't save. Please try again.");
      throw e;
    } finally {
      setBusy(false);
    }
  };
  const quiet: SaveQuestions = (next, done) => save(next, done).catch(() => {}); // the error is shown above

  return (
    <div className="flex flex-col gap-5">
      <Title title="Check-ins" intro="Every voluntary weekly check-in. Names only appear when the employee chose to share them. Question results are counts only." />
      <div role="group" aria-label="Show" className="flex w-fit gap-0.5 rounded-xl bg-[color:var(--hr-chip)] p-1">
        {(
          [
            ["questions", "Questions & results"],
            ["all", `All check-ins (${checkIns.length})`],
          ] as const
        ).map(([v, label]) => (
          <button
            key={v}
            type="button"
            aria-pressed={view === v}
            onClick={() => setView(v)}
            className="min-h-10 cursor-pointer rounded-lg px-3.5 text-[13.5px] font-semibold"
            style={{
              background: view === v ? "var(--hr-surface)" : "transparent",
              color: view === v ? C.blueText : "var(--hr-text3)",
              boxShadow: view === v ? "0 1px 2px rgba(16,24,40,0.08)" : undefined,
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {error && (
        <p role="alert" className="m-0 text-[13px] font-semibold" style={{ color: "var(--hr-red-fg)" }}>
          {error}
        </p>
      )}
      {view === "questions" ? (
        <>
          <WeekSchedule questions={asked} onSave={quiet} busy={busy} />
          <QuestionList questions={asked} fallback={fallback} onSave={save} busy={busy} />
        </>
      ) : (
        <CheckInHistory checkIns={checkIns} />
      )}
    </div>
  );
}
