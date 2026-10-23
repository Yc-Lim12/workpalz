import { useEffect, useState, type FormEvent } from "react";
import { MOODS, REQUEST_CATEGORIES, STATUS_LABEL, type AskResult, type Availability, type Colleague, type Ping, type PingInput, type CheckInInput, type Mood, type MyDataSummary, type Notice, type RequestCategory, type RequestInput, type Shortcuts, type SupportRequest, DEFAULT_SHORTCUTS } from "../../../shared/types";
import { AMBER, BLUE, MUTED } from "./theme";
import { Btn, Choice, Dot, Header, inputClass } from "./ui";

const drafts: Record<string, unknown> = {};
function useDraft<T>(key: string, initial: T) {
  const [value, set] = useState<T>(() => (key in drafts ? (drafts[key] as T) : initial));
  const update = (v: T) => { drafts[key] = v; set(v); };
  return [value, update] as const;
}
const clearDrafts = (prefix: string) => {
  for (const k of Object.keys(drafts)) if (k.startsWith(prefix)) delete drafts[k];
};

export function MenuView(p: { pending: boolean; focusRunning: boolean; focusLeft: string; openRequests: number; onOpen: (v: "ask" | "request" | "ping" | "checkin" | "privacy" | "settings") => void; onToggleFocus: () => void; onHide: () => void; onClose: () => void; }) {
  const tile = "flex min-h-[76px] w-full cursor-pointer flex-col items-start justify-between gap-1 rounded-2xl [background-color:var(--bg)] px-3.5 py-3 text-left transition hover:opacity-80 active:scale-[0.97] border [border-color:var(--line)]";
  return (
    <section aria-labelledby="menu-title" className="flex flex-col gap-3">
      <Header id="menu-title" color={BLUE} title="WorkPalz" right="Esc to close" />
      <ul className="m-0 grid list-none grid-cols-2 gap-2 p-0">
        <li>
          <button type="button" data-autofocus className={tile} onClick={() => p.onOpen("ask")}>
            <span className="text-[12px]" style={{ color: MUTED }}>Jargon, policies, links</span>
            <span className="text-[14px] font-semibold [color:var(--ink)]">Ask WorkPalz</span>
          </button>
        </li>
        <li>
          <button type="button" className={tile} onClick={() => p.onOpen("request")}>
            <span className="text-[12px]" style={{ color: MUTED }}>{p.openRequests ? `${p.openRequests} open` : "IT or HR"}</span>
            <span className="text-[14px] font-semibold [color:var(--ink)]">Quick request</span>
          </button>
        </li>
        <li className="col-span-2">
          <button type="button" className={`${tile} !min-h-[60px]`} onClick={() => p.onOpen("ping")}>
            <span className="text-[12px]" style={{ color: MUTED }}>Find someone who can help</span>
            <span className="text-[14px] font-semibold [color:var(--ink)]">Ping a colleague</span>
          </button>
        </li>
        <li>
          <button type="button" className={tile} onClick={() => p.onOpen("checkin")}>
            <span className="flex items-center gap-2 text-[12px]" style={{ color: MUTED }}>
              {p.pending && <Dot color={AMBER} pulse />}
              {p.pending ? "Waiting for you" : "Anytime"}
            </span>
            <span className="text-[14px] font-semibold [color:var(--ink)]">Weekly check-in</span>
          </button>
        </li>
        <li>
          <button type="button" className={tile} onClick={p.onToggleFocus} aria-pressed={p.focusRunning}>
            <span className="mono text-[12px]" style={{ color: MUTED }}>{p.focusRunning ? `${p.focusLeft} left` : "25 min"}</span>
            <span className="text-[14px] font-semibold [color:var(--ink)]">{p.focusRunning ? "Stop focus" : "Focus timer"}</span>
          </button>
        </li>
      </ul>
      <div className="flex items-center justify-between gap-2 mt-1">
        <Btn variant="ghost" className="!min-h-10 !px-2 text-[13px]" onClick={() => p.onOpen("privacy")}>Your privacy</Btn>
        <Btn variant="ghost" className="!min-h-10 !px-2 text-[13px]" onClick={() => p.onOpen("settings")}>Settings</Btn>
        <Btn variant="ghost" className="!min-h-10 !px-2 text-[13px]" onClick={p.onHide}>Hide</Btn>
        <Btn variant="ghost" className="!min-h-10 !px-2 text-[13px]" onClick={p.onClose}>Close</Btn>
      </div>
    </section>
  );
}

export function CheckInView(p: { question: string; onSubmit: (i: CheckInInput) => Promise<void>; onClose: () => void; onBack: () => void; }) {
  const [mood, setMood] = useDraft<Mood | null>("ci.mood", null);
  const [note, setNote] = useDraft("ci.note", "");
  const [shareName, setShareName] = useDraft("ci.share", false);
  const [notifyMe, setNotifyMe] = useDraft("ci.notify", true);
  const [sending, setSending] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!mood || sending) return;
    setSending(true);
    await p.onSubmit({ mood, note: note.trim(), shareName, notifyMe });
    clearDrafts("ci.");
  };

  return (
    <form onSubmit={submit} aria-labelledby="ci-title" className="flex flex-col gap-3.5">
      <Header id="ci-title" color={AMBER} title="Weekly check-in" right="About 10 seconds" onBack={p.onBack} />
      <fieldset className="m-0 flex flex-col gap-3 border-0 p-0">
        <legend className="mb-3 p-0 text-[17px] font-semibold leading-snug [color:var(--ink)]">{p.question}</legend>
        <div className="grid grid-cols-5 gap-1.5">
          {MOODS.map((m) => (
            <Choice key={m.id} type="radio" name="mood" checked={mood === m.id} onChange={() => setMood(m.id)} activeBg={m.color} className="min-h-[60px] flex-col gap-1.5 text-[12px] [background-color:var(--bg)] [color:var(--ink)]">
              <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full" style={{ background: mood === m.id ? "var(--surface)" : m.color }} />
              {m.label}
            </Choice>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="ci-note" className="text-[13px] font-semibold [color:var(--ink)]">
          Anything blocking you? <span style={{ color: MUTED }}>(optional)</span>
        </label>
        <input id="ci-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={280} placeholder="e.g. still waiting on my software licence" className={`${inputClass} min-h-11`} />
      </div>

      <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
        <legend className="sr-only">Privacy choices</legend>
        <label className="flex cursor-pointer items-center gap-2.5 text-[13px] [color:var(--muted)]">
          <input type="checkbox" checked={shareName} onChange={(e) => setShareName(e.target.checked)} className="h-5 w-5 shrink-0 accent-[var(--amber)]" />
          Share my name with HR. If unticked, HR only sees your team.
        </label>
        <label className="flex cursor-pointer items-center gap-2.5 text-[13px] [color:var(--muted)]">
          <input type="checkbox" checked={notifyMe} onChange={(e) => setNotifyMe(e.target.checked)} className="h-5 w-5 shrink-0 accent-[var(--amber)]" />
          Tell me if HR acts on this. WorkPalz delivers it, so HR still won't know it was you.
        </label>
      </fieldset>

      <div className="flex gap-2">
        <Btn type="submit" variant="primary" className="flex-[2]" disabled={!mood || sending}>{sending ? "Sending…" : "Send"}</Btn>
        <Btn className="flex-1" onClick={p.onClose}>Not now</Btn>
      </div>
    </form>
  );
}

// One example from each part of the company guide
const EXAMPLES = ["What is Project Aurora?", "Medical leave", "VPN setup", "Expense form"];

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
    try { setResult(await p.onAsk(text)); } finally { setBusy(false); }
  };

  return (
    <section aria-labelledby="ask-title" className="flex flex-col gap-3">
      <Header id="ask-title" color={BLUE} title="Ask WorkPalz" right="Answers from the company guide" onBack={p.onBack} />
      <form role="search" className="flex gap-2" onSubmit={(e) => { e.preventDefault(); run(q); }}>
        <input id="ask-input" data-autofocus value={q} onChange={(e) => setQ(e.target.value)} maxLength={200} placeholder="e.g. What's a Q4 OKR?" className={`${inputClass} min-h-11 flex-1`} />
        <Btn type="submit" variant="primary" disabled={!q.trim() || busy}>Ask</Btn>
      </form>

      {!result && !busy && (
        <div className="flex flex-wrap gap-1.5">
          {EXAMPLES.map((ex) => (
            <button key={ex} type="button" onClick={() => { setQ(ex); run(ex); }} className="min-h-9 cursor-pointer rounded-full [background-color:var(--bg)] px-3 text-[12.5px] [color:var(--ink)] hover:opacity-80 border [border-color:var(--line)]">
              {ex}
            </button>
          ))}
        </div>
      )}

      <div aria-live="polite" aria-busy={busy}>
        {busy && <p className="m-0 text-[14px]" style={{ color: MUTED }}>Looking that up…</p>}
        {result && (
          <div className="flex flex-col gap-2.5 rounded-2xl [background-color:var(--bg)] p-4 border [border-color:var(--line)]">
            <p className="m-0 text-[12px]" style={{ color: MUTED }}>You asked: {asked}</p>
            {result.entry && (
              <div className="flex flex-col gap-0.5">
                <p className="m-0 text-[12px] font-semibold" style={{ color: BLUE }}>From the {result.entry.from}</p>
                <h3 className="m-0 text-[15px] font-semibold [color:var(--ink)]">{result.entry.title}</h3>
              </div>
            )}
            <p className="m-0 text-[14px] leading-relaxed [color:var(--ink)]">{result.answer}</p>
            {result.entry?.link && (
              <Btn variant="secondary" className="self-start" onClick={() => p.onOpenLink(result.entry!.link!)}>
                {result.entry.linkLabel ?? "Open link"} ↗
              </Btn>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

export function RequestView(p: { mine: SupportRequest[]; onSubmit: (i: RequestInput) => Promise<void>; onClose: () => void; onBack: () => void; }) {
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
        <legend className="mb-2 p-0 text-[15px] font-semibold [color:var(--ink)]">What do you need help with?</legend>
        <div className="grid grid-cols-3 gap-1.5">
          {REQUEST_CATEGORIES.map((c) => (
            <Choice key={c.id} type="radio" name="category" checked={category === c.id} onChange={() => setCategory(c.id)} activeBg="var(--blue)" className="min-h-12 px-2 text-[12.5px] leading-tight [background-color:var(--bg)] [color:var(--ink)]">
              {c.label}
            </Choice>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="rq-desc" className="text-[13px] font-semibold [color:var(--ink)]">Details</label>
        <textarea id="rq-desc" value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={280} rows={2} placeholder="e.g. IDE licence for the payments project" className={`${inputClass} resize-none py-2.5 leading-snug`} />
      </div>

      <div className="flex gap-2 mt-2">
        <Btn type="submit" variant="primary" className="flex-[2]" disabled={!category || !desc.trim() || sending}>{sending ? "Sending…" : "Send request"}</Btn>
        <Btn className="flex-1" onClick={p.onClose}>Cancel</Btn>
      </div>

      {recent.length > 0 && (
        <div className="flex flex-col gap-1.5 border-t [border-color:var(--line)] pt-3 mt-1">
          <h3 className="m-0 text-[12.5px] font-semibold" style={{ color: MUTED }}>Your requests</h3>
          <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
            {recent.map((r) => (
              <li key={r.id} className="flex items-center gap-2 text-[13px] [color:var(--ink)]">
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
    open: { bg: "var(--amber-soft)", fg: "var(--amber)" },
    in_progress: { bg: "var(--bg)", fg: "var(--blue)" },
    resolved: { bg: "var(--good-soft)", fg: "var(--good)" },
  }[status];
  return (
    <span className="shrink-0 rounded-full px-2 py-0.5 text-[11.5px] font-semibold border [border-color:var(--line)]" style={{ background: style.bg, color: style.fg }}>
      {STATUS_LABEL[status]}
    </span>
  );
}

export function NoticeView(p: { notice: Notice; more: number; onDone: () => void }) {
  return (
    <section aria-labelledby="nt-title" className="flex flex-col gap-3">
      <Header id="nt-title" color={BLUE} title={p.notice.title} right={p.more ? `${p.more} more` : "just now"} />
      <p className="m-0 whitespace-pre-line text-[15px] leading-relaxed [color:var(--ink)]">{p.notice.body}</p>
      <p className="m-0 text-[12px]" style={{ color: MUTED }}>
        {p.notice.from
          ? `${p.notice.from} replied to your ping.`
          : "Thanks for speaking up. WorkPalz sent this to you; HR doesn't know who received it."}
      </p>
      <Btn variant="primary" data-autofocus onClick={p.onDone}>{p.more ? "Next" : "Got it"}</Btn>
    </section>
  );
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export function PrivacyView(p: { getData: () => Promise<MyDataSummary>; onExport: () => Promise<boolean>; onDelete: () => Promise<void>; onBack: () => void; }) {
  const [data, setData] = useState<MyDataSummary | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => { p.getData().then(setData); }, []);

  return (
    <section aria-labelledby="pv-title" className="flex flex-col gap-3">
      <Header id="pv-title" color={BLUE} title="Your privacy" onBack={p.onBack} />
      <div className="grid grid-cols-2 gap-2 text-[13px] leading-snug">
        <div className="rounded-xl [background-color:var(--bg)] p-3 border [border-color:var(--line)]">
          <h3 className="m-0 mb-1.5 text-[13px] font-semibold [color:var(--blue)]">What WorkPalz keeps</h3>
          <ul className="m-0 flex list-disc flex-col gap-1 pl-4 [color:var(--ink)]">
            <li>Check-ins you send</li>
            <li>Questions you ask</li>
            <li>Requests you make</li>
            <li>Pings you send</li>
          </ul>
        </div>
        <div className="rounded-xl [background-color:var(--bg)] p-3 border [border-color:var(--line)]">
          <h3 className="m-0 mb-1.5 text-[13px] font-semibold [color:var(--ink)]">Never collected</h3>
          <ul className="m-0 flex list-disc flex-col gap-1 pl-4 [color:var(--ink)]">
            <li>Apps, screens or websites</li>
            <li>Keystrokes or camera</li>
            <li>Mood guesses by AI</li>
          </ul>
        </div>
      </div>
      <p className="m-0 text-[12.5px] leading-snug [color:var(--muted)]">
        HR sees check-ins and questions by team only, unless you share your name. Pings go only to the person you pick, never to HR. Names are never sent to the AI. Nothing here is used for performance reviews.
      </p>
      <p className="m-0 text-[12.5px] leading-snug [color:var(--muted)]">
        <strong className="[color:var(--ink)]">How can I hear back if I'm anonymous?</strong> WorkPalz, not HR, keeps a private note of what you raised. When HR fixes it, WorkPalz tells you. HR only sees how many people were told, never who. Untick "Tell me if HR acts on this" in your next check-in to stop updates.
      </p>
      {data && <p className="m-0 text-[13px]" style={{ color: MUTED }}>Stored now: {plural(data.checkIns, "check-in")}, {plural(data.questions, "question")}, {plural(data.requests, "request")}, {plural(data.pings, "ping")}.</p>}
      
      <div className="flex flex-wrap gap-2">
        <Btn data-autofocus onClick={async () => setMsg((await p.onExport()) ? "Your data was saved." : "Download cancelled.")}>Download my data</Btn>
        {!confirm ? (
          <Btn variant="danger" onClick={() => setConfirm(true)}>Delete my data</Btn>
        ) : (
          <Btn variant="danger" onClick={async () => { await p.onDelete(); setConfirm(false); setMsg("Check-ins deleted. Open requests anonymised."); setData(await p.getData()); }}>Yes, delete permanently</Btn>
        )}
      </div>
      <p role="status" className="m-0 min-h-[1em] text-[13px] text-[var(--good)]">{msg}</p>
    </section>
  );
}

// ---------- Ping a colleague ----------

const AVAILABILITY: Record<Availability, { label: string; color: string }> = {
  available: { label: "Available", color: "var(--good)" },
  busy: { label: "In a meeting", color: "var(--amber)" },
  away: { label: "Away", color: "var(--muted)" },
};

const QUICK_MESSAGES = ["Got 5 minutes to help me?", "Can you look at something with me?", "Who should I ask about this?"];

const initials = (name: string) => name.split(" ").map((w) => w[0]).slice(0, 2).join("");
const firstName = (name: string) => name.split(" ")[0];

export function PingView(p: { colleagues: Colleague[]; mine: Ping[]; onSubmit: (i: PingInput) => Promise<void>; onBack: () => void }) {
  const [q, setQ] = useDraft("ping.q", "");
  const [pickedId, setPickedId] = useDraft<string | null>("ping.who", null);
  const [message, setMessage] = useDraft("ping.msg", "");
  const [sending, setSending] = useState(false);
  const picked = p.colleagues.find((c) => c.id === pickedId);

  // Search by name, role, team or topic ("VPN", "staging server")
  const needle = q.trim().toLowerCase();
  const matches = p.colleagues.filter((c) =>
    !needle || [c.name, c.role, c.team, ...c.helpsWith].some((s) => s.toLowerCase().includes(needle))
  );

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!picked || !message.trim() || sending) return;
    setSending(true);
    await p.onSubmit({ colleagueId: picked.id, message: message.trim() });
    clearDrafts("ping.");
  };

  if (picked) {
    const a = AVAILABILITY[picked.availability];
    return (
      <form onSubmit={submit} aria-labelledby="ping-title" className="flex flex-col gap-3">
        <Header id="ping-title" color={BLUE} title={`Ping ${firstName(picked.name)}`} right={a.label} onBack={() => setPickedId(null)} />
        <PersonRow c={picked} />
        {picked.availability === "away" && (
          <p className="m-0 text-[12.5px]" style={{ color: MUTED }}>{firstName(picked.name)} is away. They'll see your ping when they're back.</p>
        )}
        <div className="flex flex-wrap gap-1.5">
          {QUICK_MESSAGES.map((m) => (
            <button key={m} type="button" onClick={() => setMessage(m)} className="min-h-9 cursor-pointer rounded-full [background-color:var(--bg)] px-3 text-[12.5px] [color:var(--ink)] hover:opacity-80 border [border-color:var(--line)]">
              {m}
            </button>
          ))}
        </div>
        <label htmlFor="ping-msg" className="sr-only">Message</label>
        <textarea id="ping-msg" data-autofocus value={message} onChange={(e) => setMessage(e.target.value)} maxLength={200} rows={2} placeholder="e.g. Can you help me get the staging server running?" className={`${inputClass} resize-none py-2.5 leading-snug`} />
        <div className="flex gap-2">
          <Btn type="submit" variant="primary" className="flex-[2]" disabled={!message.trim() || sending}>{sending ? "Sending…" : `Ping ${firstName(picked.name)}`}</Btn>
          <Btn className="flex-1" onClick={() => setPickedId(null)}>Someone else</Btn>
        </div>
      </form>
    );
  }

  const recent = p.mine.slice(0, 2);
  return (
    <section aria-labelledby="ping-title" className="flex flex-col gap-3">
      <Header id="ping-title" color={BLUE} title="Ping a colleague" right="Only they see it" onBack={p.onBack} />
      <form role="search" onSubmit={(e) => e.preventDefault()}>
        <label htmlFor="ping-search" className="sr-only">Search by name or topic</label>
        <input id="ping-search" data-autofocus value={q} onChange={(e) => setQ(e.target.value)} maxLength={60} placeholder="Name or topic, e.g. VPN, staging server" className={`${inputClass} min-h-11`} />
      </form>

      <ul aria-label="Colleagues" className="m-0 flex max-h-[250px] list-none flex-col gap-1.5 overflow-y-auto p-0 pr-1">
        {matches.map((c) => (
          <li key={c.id}>
            <button type="button" onClick={() => setPickedId(c.id)} className="w-full cursor-pointer rounded-2xl text-left transition hover:opacity-80 active:scale-[0.98]">
              <PersonRow c={c} />
            </button>
          </li>
        ))}
      </ul>
      {matches.length === 0 && (
        <p className="m-0 text-[13px]" style={{ color: MUTED }}>No one found for "{q.trim()}". Try Ask WorkPalz or a Quick request.</p>
      )}

      {recent.length > 0 && (
        <div className="flex flex-col gap-1.5 border-t [border-color:var(--line)] pt-3">
          <h3 className="m-0 text-[12.5px] font-semibold" style={{ color: MUTED }}>Your pings</h3>
          <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
            {recent.map((pg) => (
              <li key={pg.id} className="text-[13px] leading-snug [color:var(--ink)]">
                <span className="font-semibold">{firstName(pg.toName)}:</span>{" "}
                {pg.reply ? <span>"{pg.reply}"</span> : <span style={{ color: MUTED }}>waiting for a reply</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function PersonRow({ c }: { c: Colleague }) {
  const a = AVAILABILITY[c.availability];
  return (
    <div className="flex items-start gap-3 rounded-2xl [background-color:var(--bg)] border [border-color:var(--line)] px-3 py-2.5">
      <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[12px] font-bold [background-color:var(--surface)] [color:var(--ink)] border [border-color:var(--line)]">
        {initials(c.name)}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-center gap-2 text-[14px] font-semibold [color:var(--ink)]">
          {c.name}
          <span className="flex items-center gap-1 text-[11.5px] font-medium" style={{ color: MUTED }}>
            <Dot color={a.color} />
            {a.label}
          </span>
        </span>
        <span className="truncate text-[12px]" style={{ color: MUTED }}>{c.role} · {c.team}</span>
        <span className="text-[12px] [color:var(--ink)]">Helps with: {c.helpsWith.join(", ")}</span>
      </span>
    </div>
  );
}

// ---------- Settings ----------

function ShortcutRow({ label, value, onChange }: { label: string, value: string, onChange: (val: string) => void }) {
  const [isRecording, setIsRecording] = useState(false);

  useEffect(() => {
    if (!isRecording) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const keys: string[] = [];
      if (e.ctrlKey) keys.push('Ctrl');
      if (e.altKey) keys.push('Alt');
      if (e.shiftKey) keys.push('Shift');
      if (e.metaKey) keys.push('Cmd');

      if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return;

      // Use the physical key: on a Mac, Option changes e.key (Option+A gives "å")
      let finalKey = e.key;
      if (/^Key[A-Z]$/.test(e.code)) finalKey = e.code.slice(3);
      else if (/^Digit[0-9]$/.test(e.code)) finalKey = e.code.slice(5);
      else if (e.code === 'Space') finalKey = 'Space';
      else if (finalKey.length === 1) finalKey = finalKey.toUpperCase();

      keys.push(finalKey);
      onChange(keys.join('+'));
      setIsRecording(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isRecording, onChange]);

  return (
    <div className="flex flex-col gap-1.5 p-3 [background-color:var(--bg)] border [border-color:var(--line)] rounded-xl">
      <span className="text-[13px] font-semibold [color:var(--ink)]">{label}</span>
      <div className="flex gap-2 mt-1">
        <button 
          type="button"
          onClick={() => setIsRecording(true)}
          className={`flex-1 min-h-9 px-3 rounded-lg font-mono text-[13px] transition border cursor-pointer flex items-center justify-center ${
            isRecording 
              ? 'bg-blue-600 border-blue-600 text-white animate-pulse' 
              : '[background-color:var(--surface)] [border-color:var(--line)] [color:var(--ink)] hover:opacity-80'
          }`}
        >
          {isRecording ? "Listening... Press keys" : (value ? displayShortcut(value) : "None")}
        </button>
        {value && (
          <button 
            type="button" 
            onClick={() => onChange("")} 
            className="px-3 rounded-lg border [border-color:var(--line)] [background-color:var(--surface)] [color:var(--muted)] hover:opacity-80 text-[12px] font-semibold cursor-pointer"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}

export const isMac = navigator.platform.toUpperCase().includes("MAC");

// "CommandOrControl" is Electron's name for Cmd on Mac and Ctrl elsewhere
export function displayShortcut(s: string) {
  return s.replace("CommandOrControl", isMac ? "Cmd" : "Ctrl");
}

export function loadShortcuts(): Shortcuts {
  try {
    return { ...DEFAULT_SHORTCUTS, ...JSON.parse(localStorage.getItem('app-shortcuts') || '{}') };
  } catch {
    return { ...DEFAULT_SHORTCUTS };
  }
}

export function SettingsView(p: { onBack: () => void; onReplayTour: () => void }) {
  const [theme, setTheme] = useState(localStorage.getItem('app-theme') || 'dark');
  const [shortcuts, setShortcuts] = useState(loadShortcuts);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('app-theme', theme);
  }, [theme]);

  const updateShortcut = (key: keyof Shortcuts, value: string) => {
    const newShortcuts = { ...shortcuts, [key]: value };
    setShortcuts(newShortcuts);
    localStorage.setItem('app-shortcuts', JSON.stringify(newShortcuts));
    window.workpalz.setShortcuts(newShortcuts);
  };

  return (
    <section aria-labelledby="settings-title" className="flex flex-col gap-3">
      <Header id="settings-title" color={BLUE} title="Settings" onBack={p.onBack} />
      
      <div className="flex flex-col gap-1.5 p-3 [background-color:var(--bg)] border [border-color:var(--line)] rounded-xl">
        <span className="text-[13px] font-semibold [color:var(--ink)]">Appearance</span>
        <button 
          type="button"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} 
          className="p-2 mt-1 rounded-lg [background-color:var(--surface)] border [border-color:var(--line)] [color:var(--ink)] hover:opacity-80 text-[13px] transition font-medium cursor-pointer"
        >
          {theme === 'dark' ? 'Switch to Light ☀️' : 'Switch to Dark 🌙'}
        </button>
        <button
          type="button"
          onClick={p.onReplayTour}
          className="p-2 rounded-lg [background-color:var(--surface)] border [border-color:var(--line)] [color:var(--ink)] hover:opacity-80 text-[13px] transition font-medium cursor-pointer"
        >
          Show the welcome tour again
        </button>
      </div>

      <div className="flex flex-col gap-2 max-h-[260px] overflow-y-auto pr-1 pb-1">
        <ShortcutRow label="Open Main Menu" value={shortcuts.main} onChange={(v) => updateShortcut('main', v)} />
        <ShortcutRow label="Quick Request (IT/HR)" value={shortcuts.request} onChange={(v) => updateShortcut('request', v)} />
        <ShortcutRow label="Ping a Colleague" value={shortcuts.ping} onChange={(v) => updateShortcut('ping', v)} />
        <ShortcutRow label="Ask WorkPalz" value={shortcuts.ask} onChange={(v) => updateShortcut('ask', v)} />
        <ShortcutRow label="Toggle Focus Timer" value={shortcuts.focus} onChange={(v) => updateShortcut('focus', v)} />
        <ShortcutRow label="Show / Hide Island" value={shortcuts.toggle} onChange={(v) => updateShortcut('toggle', v)} />
      </div>
    </section>
  );
}
// ---------- Step back: hide for now, or Quiet (do not disturb) ----------

export function StepBackView(p: { onBack: () => void; onHide: () => void; onQuietHour: () => void; onQuietTomorrow: () => void }) {
  const option = "flex w-full cursor-pointer flex-col items-start gap-0.5 rounded-2xl [background-color:var(--bg)] border [border-color:var(--line)] px-3.5 py-3 text-left transition hover:opacity-80 active:scale-[0.98]";
  return (
    <section aria-labelledby="away-title" className="flex flex-col gap-3">
      <Header id="away-title" color={BLUE} title="Step back" right="In a meeting?" onBack={p.onBack} />
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        <li>
          <button type="button" data-autofocus className={option} onClick={p.onQuietHour}>
            <span className="text-[14px] font-semibold [color:var(--ink)]">Quiet for 1 hour</span>
            <span className="text-[12px]" style={{ color: MUTED }}>Nothing pops up. Anything new waits as a number by the clock.</span>
          </button>
        </li>
        <li>
          <button type="button" className={option} onClick={p.onQuietTomorrow}>
            <span className="text-[14px] font-semibold [color:var(--ink)]">Quiet until tomorrow</span>
            <span className="text-[12px]" style={{ color: MUTED }}>Back at 9 am. Good for a day of meetings.</span>
          </button>
        </li>
        <li>
          <button type="button" className={option} onClick={p.onHide}>
            <span className="text-[14px] font-semibold [color:var(--ink)]">Hide for now</span>
            <span className="text-[12px]" style={{ color: MUTED }}>Leaves a small bar at the top. Updates still pop up.</span>
          </button>
        </li>
      </ul>
      <p className="m-0 text-[12px] leading-snug" style={{ color: MUTED }}>
        Full-screen apps like slides and video calls get the whole screen automatically.
      </p>
    </section>
  );
}

// ---------- First-day welcome tour ----------

export function TourView(p: { name: string; shortcut: string; where: string; onDone: () => void }) {
  const [step, setStep] = useState(0);
  const steps = [
    {
      title: p.name ? `Hi ${p.name}, I'm WorkPalz` : "Hi, I'm WorkPalz",
      body: "Your helper for your first 90 days. Ask about jargon or policies, send IT a request, or ping a colleague who can help.",
    },
    {
      title: "Open me from anywhere",
      body: `Press ${p.shortcut} in any app, or just click me up here.`,
      key: p.shortcut,
    },
    {
      title: "I'll stay out of your way",
      body: `When you're busy I shrink to a small dot. In full-screen apps, or when you choose Quiet, I step back completely. Anything waiting shows as a number on my icon in the ${p.where}.`,
    },
    {
      title: "You stay anonymous",
      body: "Check-ins show HR your team, not your name. If HR fixes something you raised, I'll tell you, and HR still won't know it was you.",
    },
  ];
  const s = steps[step];
  const last = step === steps.length - 1;
  return (
    <section aria-labelledby="tour-title" aria-describedby="tour-body" className="flex flex-col gap-3">
      <Header id="tour-title" color={BLUE} title={s.title} right={`${step + 1} of ${steps.length}`} />
      <p id="tour-body" aria-live="polite" className="m-0 text-[15px] leading-relaxed [color:var(--ink)]">{s.body}</p>
      {s.key && (
        <p className="m-0 self-start rounded-xl [background-color:var(--bg)] border [border-color:var(--line)] px-3 py-1.5 mono text-[14px] [color:var(--ink)]">
          {s.key}
        </p>
      )}
      <div className="flex gap-2">
        <Btn variant="primary" data-autofocus className="flex-[2]" onClick={() => (last ? p.onDone() : setStep(step + 1))}>
          {last ? "Got it" : "Next"}
        </Btn>
        {!last && (
          <Btn className="flex-1" onClick={p.onDone}>
            Skip tour
          </Btn>
        )}
      </div>
    </section>
  );
}
