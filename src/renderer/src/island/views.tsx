// The expanded island views. Each one is a labelled region with real form controls.
import { useEffect, useState, type FormEvent } from "react";
import {
  MOODS,
  REQUEST_CATEGORIES,
  STATUS_LABEL,
  type AskResult,
  type CheckInInput,
  type Mood,
  type MyDataSummary,
  type Notice,
  type RequestCategory,
  type RequestInput,
  type SupportRequest,
} from "../../../shared/types";
import { AMBER, BLUE, MUTED } from "./theme";
import { Btn, Choice, Dot, Header, inputClass } from "./ui";

// Drafts survive an accidental click-away; cleared after sending
const drafts: Record<string, unknown> = {};
function useDraft<T>(key: string, initial: T) {
  const [value, set] = useState<T>(() => (key in drafts ? (drafts[key] as T) : initial));
  const update = (v: T) => {
    drafts[key] = v;
    set(v);
  };
  return [value, update] as const;
}
const clearDrafts = (prefix: string) => {
  for (const k of Object.keys(drafts)) if (k.startsWith(prefix)) delete drafts[k];
};

// ---------- Menu ----------

export function MenuView(p: {
  pending: boolean;
  focusRunning: boolean;
  focusLeft: string;
  openRequests: number;
  onOpen: (v: "ask" | "request" | "checkin" | "privacy") => void;
  onToggleFocus: () => void;
  onClose: () => void;
}) {
  const tile =
    "flex min-h-[76px] w-full cursor-pointer flex-col items-start justify-between gap-1 rounded-2xl bg-[#1C1D21] px-3.5 py-3 text-left transition hover:bg-[#25272C] active:scale-[0.97]";
  return (
    <section aria-labelledby="menu-title" className="flex flex-col gap-3">
      <Header id="menu-title" color={BLUE} title="WorkPalz" right="Esc to close" />
      <ul className="m-0 grid list-none grid-cols-2 gap-2 p-0">
        <li>
          <button type="button" data-autofocus className={tile} onClick={() => p.onOpen("ask")}>
            <span className="text-[12px]" style={{ color: MUTED }}>
              Jargon, policies, links
            </span>
            <span className="text-[14px] font-semibold">Ask WorkPalz</span>
          </button>
        </li>
        <li>
          <button type="button" className={tile} onClick={() => p.onOpen("request")}>
            <span className="text-[12px]" style={{ color: MUTED }}>
              {p.openRequests ? `${p.openRequests} open` : "IT or HR"}
            </span>
            <span className="text-[14px] font-semibold">Quick request</span>
          </button>
        </li>
        <li>
          <button type="button" className={tile} onClick={() => p.onOpen("checkin")}>
            <span className="flex items-center gap-2 text-[12px]" style={{ color: MUTED }}>
              {p.pending && <Dot color={AMBER} pulse />}
              {p.pending ? "Waiting for you" : "Anytime"}
            </span>
            <span className="text-[14px] font-semibold">Weekly check-in</span>
          </button>
        </li>
        <li>
          <button type="button" className={tile} onClick={p.onToggleFocus} aria-pressed={p.focusRunning}>
            <span className="mono text-[12px]" style={{ color: MUTED }}>
              {p.focusRunning ? `${p.focusLeft} left` : "25 min"}
            </span>
            <span className="text-[14px] font-semibold">{p.focusRunning ? "Stop focus" : "Focus timer"}</span>
          </button>
        </li>
      </ul>
      <div className="flex items-center justify-between gap-2">
        <Btn variant="ghost" className="!min-h-10 !px-2 text-[13px]" onClick={() => p.onOpen("privacy")}>
          Your privacy
        </Btn>
        <Btn variant="ghost" className="!min-h-10 !px-2 text-[13px]" onClick={p.onClose}>
          Close
        </Btn>
      </div>
    </section>
  );
}

// ---------- Weekly check-in ----------

export function CheckInView(p: {
  question: string;
  onSubmit: (i: CheckInInput) => Promise<void>;
  onClose: () => void;
  onBack: () => void;
}) {
  const [mood, setMood] = useDraft<Mood | null>("ci.mood", null);
  const [note, setNote] = useDraft("ci.note", "");
  const [shareName, setShareName] = useDraft("ci.share", false);
  const [sending, setSending] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!mood || sending) return;
    setSending(true);
    await p.onSubmit({ mood, note: note.trim(), shareName });
    clearDrafts("ci.");
  };

  return (
    <form onSubmit={submit} aria-labelledby="ci-title" className="flex flex-col gap-3.5">
      <Header id="ci-title" color={AMBER} title="Weekly check-in" right="About 10 seconds" onBack={p.onBack} />
      <fieldset className="m-0 flex flex-col gap-3 border-0 p-0">
        <legend className="mb-3 p-0 text-[17px] font-semibold leading-snug">{p.question}</legend>
        <div className="grid grid-cols-5 gap-1.5">
          {MOODS.map((m) => (
            <Choice
              key={m.id}
              type="radio"
              name="mood"
              checked={mood === m.id}
              onChange={() => setMood(m.id)}
              activeBg={m.color}
              className="min-h-[60px] flex-col gap-1.5 text-[12px]"
            >
              <span
                aria-hidden="true"
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: mood === m.id ? "#0B0C0E" : m.color }}
              />
              {m.label}
            </Choice>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="ci-note" className="text-[13px] font-semibold text-[#E4E6EA]">
          Anything blocking you? <span style={{ color: MUTED }}>(optional)</span>
        </label>
        <input
          id="ci-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={280}
          placeholder="e.g. still waiting on my software licence"
          className={`${inputClass} min-h-11`}
        />
      </div>

      <label className="flex cursor-pointer items-center gap-2.5 text-[13px] text-[#C3C7CF]">
        <input
          type="checkbox"
          checked={shareName}
          onChange={(e) => setShareName(e.target.checked)}
          className="h-5 w-5 accent-[#FFA94D]"
        />
        Share my name with HR. If unticked, HR only sees your team.
      </label>

      <div className="flex gap-2">
        <Btn type="submit" variant="primary" className="flex-[2]" disabled={!mood || sending}>
          {sending ? "Sending…" : "Send"}
        </Btn>
        <Btn className="flex-1" onClick={p.onClose}>
          Not now
        </Btn>
      </div>
      {!mood && (
        <p className="m-0 text-[12px]" style={{ color: MUTED }}>
          Pick one option to send.
        </p>
      )}
    </form>
  );
}

// ---------- Ask WorkPalz ----------

const EXAMPLES = ["What is a Q4 OKR?", "Expense form", "Holiday calendar", "What does LGTM mean?"];

export function AskView(p: { onAsk: (q: string) => Promise<AskResult>; onOpenLink: (url: string) => void; onBack: () => void }) {
  const [q, setQ] = useDraft("ask.q", "");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useDraft<AskResult | null>("ask.result", null);
  const [asked, setAsked] = useDraft("ask.asked", "");

  const run = async (question: string) => {
    const text = question.trim();
    if (!text || busy) return;
    setBusy(true);
    setAsked(text);
    setResult(null);
    try {
      setResult(await p.onAsk(text));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="ask-title" className="flex flex-col gap-3">
      <Header id="ask-title" color={BLUE} title="Ask WorkPalz" right="Answers from the company handbook" onBack={p.onBack} />
      <form
        role="search"
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          run(q);
        }}
      >
        <label htmlFor="ask-input" className="sr-only">
          Ask about jargon, policies or where to find something
        </label>
        <input
          id="ask-input"
          data-autofocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          maxLength={200}
          placeholder="e.g. What's a Q4 OKR?"
          className={`${inputClass} min-h-11 flex-1`}
        />
        <Btn type="submit" variant="primary" disabled={!q.trim() || busy}>
          Ask
        </Btn>
      </form>

      {!result && !busy && (
        <div className="flex flex-wrap gap-1.5" aria-label="Example questions">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => {
                setQ(ex);
                run(ex);
              }}
              className="min-h-9 cursor-pointer rounded-full bg-[#1C1D21] px-3 text-[12.5px] text-[#E4E6EA] hover:bg-[#25272C]"
            >
              {ex}
            </button>
          ))}
        </div>
      )}

      <div aria-live="polite" aria-busy={busy}>
        {busy && (
          <p className="m-0 text-[14px]" style={{ color: MUTED }}>
            Looking that up…
          </p>
        )}
        {result && (
          <div className="flex flex-col gap-2.5 rounded-2xl bg-[#1C1D21] p-4">
            <p className="m-0 text-[12px]" style={{ color: MUTED }}>
              You asked: {asked}
            </p>
            {result.entry && <h3 className="m-0 text-[15px] font-semibold">{result.entry.title}</h3>}
            <p className="m-0 text-[14px] leading-relaxed" style={{ color: result.answered ? "#E4E6EA" : "#FFC98A" }}>
              {result.answer}
            </p>
            {result.entry?.link && (
              <Btn variant="secondary" className="self-start" onClick={() => p.onOpenLink(result.entry!.link!)}>
                {result.entry.linkLabel ?? "Open link"} <span aria-hidden="true">↗</span>
                <span className="sr-only">(opens in your browser)</span>
              </Btn>
            )}
            <p className="m-0 text-[11.5px]" style={{ color: MUTED }}>
              {result.source === "gemini" ? "Written by AI from the handbook." : "From the handbook."} Your question is shared with HR
              anonymously, by team only.
            </p>
          </div>
        )}
      </div>

    </section>
  );
}

// ---------- Quick request ----------

export function RequestView(p: {
  mine: SupportRequest[];
  onSubmit: (i: RequestInput) => Promise<void>;
  onClose: () => void;
  onBack: () => void;
}) {
  const [category, setCategory] = useDraft<RequestCategory | null>("rq.cat", null);
  const [desc, setDesc] = useDraft("rq.desc", "");
  const [sending, setSending] = useState(false);
  const recent = p.mine.slice(0, 3);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!category || !desc.trim() || sending) return;
    setSending(true);
    await p.onSubmit({ category, description: desc.trim() });
    clearDrafts("rq.");
  };

  return (
    <form onSubmit={submit} aria-labelledby="rq-title" className="flex flex-col gap-3">
      <Header id="rq-title" color={BLUE} title="Quick request" right="Goes to IT or HR" onBack={p.onBack} />
      <fieldset className="m-0 border-0 p-0">
        <legend className="mb-2 p-0 text-[15px] font-semibold">What do you need help with?</legend>
        <div className="grid grid-cols-3 gap-1.5">
          {REQUEST_CATEGORIES.map((c) => (
            <Choice
              key={c.id}
              type="radio"
              name="category"
              checked={category === c.id}
              onChange={() => setCategory(c.id)}
              activeBg="#8AB3FF"
              className="min-h-12 px-2 text-[12.5px] leading-tight"
            >
              {c.label}
            </Choice>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="rq-desc" className="text-[13px] font-semibold text-[#E4E6EA]">
          Details
        </label>
        <textarea
          id="rq-desc"
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          maxLength={280}
          rows={2}
          placeholder="e.g. IDE licence for the payments project"
          className={`${inputClass} resize-none py-2.5 leading-snug`}
        />
      </div>

      <p className="m-0 text-[12px]" style={{ color: MUTED }}>
        Requests include your name so the right person can help you.
      </p>

      <div className="flex gap-2">
        <Btn type="submit" variant="primary" className="flex-[2]" disabled={!category || !desc.trim() || sending}>
          {sending ? "Sending…" : "Send request"}
        </Btn>
        <Btn className="flex-1" onClick={p.onClose}>
          Cancel
        </Btn>
      </div>

      {recent.length > 0 && (
        <div className="flex flex-col gap-1.5 border-t border-[#2A2D33] pt-3">
          <h3 className="m-0 text-[12.5px] font-semibold" style={{ color: MUTED }}>
            Your requests
          </h3>
          <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
            {recent.map((r) => (
              <li key={r.id} className="flex items-center gap-2 text-[13px]">
                <StatusChip status={r.status} />
                <span className="truncate">{r.description}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </form>
  );
}

function StatusChip({ status }: { status: SupportRequest["status"] }) {
  const style = {
    open: { bg: "#3A2A14", fg: "#FFC98A" },
    in_progress: { bg: "#1A2A4A", fg: "#B5CEFF" },
    resolved: { bg: "#183A2A", fg: "#9BE3BF" },
  }[status];
  return (
    <span className="shrink-0 rounded-full px-2 py-0.5 text-[11.5px] font-semibold" style={{ background: style.bg, color: style.fg }}>
      {STATUS_LABEL[status]}
    </span>
  );
}

// ---------- Update from HR ----------

export function NoticeView(p: { notice: Notice; more: number; onDone: () => void }) {
  return (
    <section aria-labelledby="nt-title" className="flex flex-col gap-3">
      <Header id="nt-title" color={BLUE} title={p.notice.title} right={p.more ? `${p.more} more` : "just now"} />
      <p className="m-0 whitespace-pre-line text-[15px] leading-relaxed text-[#E4E6EA]">{p.notice.body}</p>
      <p className="m-0 text-[12px]" style={{ color: MUTED }}>
        Thanks for speaking up. Your feedback led to this.
      </p>
      <Btn variant="primary" data-autofocus onClick={p.onDone}>
        {p.more ? "Next" : "Got it"}
      </Btn>
    </section>
  );
}

// ---------- Privacy ----------

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export function PrivacyView(p: {
  getData: () => Promise<MyDataSummary>;
  onExport: () => Promise<boolean>;
  onDelete: () => Promise<void>;
  onBack: () => void;
}) {
  const [data, setData] = useState<MyDataSummary | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    p.getData().then(setData);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section aria-labelledby="pv-title" className="flex flex-col gap-3">
      <Header id="pv-title" color={BLUE} title="Your privacy" onBack={p.onBack} />
      <div className="grid grid-cols-2 gap-2 text-[13px] leading-snug">
        <div className="rounded-xl bg-[#1C1D21] p-3">
          <h3 className="m-0 mb-1.5 text-[13px] font-semibold text-[#B5CEFF]">What WorkPalz keeps</h3>
          <ul className="m-0 flex list-disc flex-col gap-1 pl-4 text-[#E4E6EA]">
            <li>Check-ins you send</li>
            <li>Questions you ask</li>
            <li>Requests you make</li>
          </ul>
        </div>
        <div className="rounded-xl bg-[#1C1D21] p-3">
          <h3 className="m-0 mb-1.5 text-[13px] font-semibold text-[#E4E6EA]">Never collected</h3>
          <ul className="m-0 flex list-disc flex-col gap-1 pl-4 text-[#E4E6EA]">
            <li>Apps, screens or websites</li>
            <li>Keystrokes or camera</li>
            <li>Mood guesses by AI</li>
          </ul>
        </div>
      </div>
      <p className="m-0 text-[12.5px] leading-snug text-[#C3C7CF]">
        HR sees check-ins and questions by team only, unless you share your name. Names are never sent to the AI. Nothing here is used
        for performance reviews.
      </p>
      {data && (
        <p className="m-0 text-[13px]" style={{ color: MUTED }}>
          Stored now: {plural(data.checkIns, "check-in")}, {plural(data.questions, "question")}, {plural(data.requests, "request")}.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Btn
          data-autofocus
          onClick={async () => setMsg((await p.onExport()) ? "Your data was saved." : "Download cancelled.")}
        >
          Download my data
        </Btn>
        {!confirm ? (
          <Btn variant="danger" onClick={() => setConfirm(true)}>
            Delete my data
          </Btn>
        ) : (
          <Btn
            variant="danger"
            onClick={async () => {
              await p.onDelete();
              setConfirm(false);
              setMsg("Your check-ins and questions were deleted. Open requests were anonymised.");
              setData(await p.getData());
            }}
          >
            Yes, delete permanently
          </Btn>
        )}
      </div>
      <p role="status" className="m-0 min-h-[1em] text-[13px] text-[#9BE3BF]">
        {msg}
      </p>
    </section>
  );
}
