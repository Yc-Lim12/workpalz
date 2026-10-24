// "Ask AI": one assistant on every HR page that knows everything on the dashboard.
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { AssistantMessage, AssistantReply, AssistantView } from "../../../shared/types";
import { Button, C } from "./ui";

const api = window.workpalz;

const STARTERS: Record<AssistantView["tab"], string[]> = {
  overview: ["Which team needs help most this week?", "Summarise this week for managers", "What changed since last week?"],
  requests: ["Which requests have waited longest?", "Are IT requests blocking new hires?", "What should IT fix first?"],
  questions: ["What should we add to the company guide?", "Which questions keep coming up?", "Which team asks the most?"],
  followups: ["Which follow-ups are still open?", "Did our actions help?", "What should we follow up on next?"],
  checkins: ["What are new hires saying this week?", "Which team feels most stuck?", "Is anyone overloaded?"],
};

export default function Assistant({ view }: { view: AssistantView }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [source, setSource] = useState<AssistantReply["source"] | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, busy]);

  const close = () => {
    setOpen(false);
    toggleRef.current?.focus();
  };

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || busy) return;
    const next = [...messages, { role: "user" as const, text: q }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const r = await api.askAssistant(next, view);
      setMessages([...next, { role: "assistant", text: r.answer }]);
      setSuggestions(r.suggestions);
      setSource(r.source);
    } catch {
      setMessages([...next, { role: "assistant", text: "Sorry, something went wrong. Please try again." }]);
    } finally {
      setBusy(false);
    }
  };

  const chips = messages.length ? suggestions : STARTERS[view.tab];

  return (
    <>
      <button
        ref={toggleRef}
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        aria-expanded={open}
        aria-controls="hr-assistant"
        // Lives in the header with the other controls, so it never covers the page
        className="flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-[color:var(--hr-inverse)] px-3 text-[13px] font-semibold text-white transition hover:bg-[color:var(--hr-inverse-hover)] active:scale-[0.97]"
      >
        <span aria-hidden="true" className="text-[#8AB3FF]">✦</span>
        {open ? "Close AI" : "Ask AI"}
      </button>

      {open && (
        <section
          id="hr-assistant"
          role="dialog"
          aria-label="WorkPalz AI assistant"
          onKeyDown={(e) => e.key === "Escape" && close()}
          className="fixed bottom-6 right-6 top-[72px] z-40 flex w-[min(420px,calc(100vw-48px))] flex-col overflow-hidden rounded-2xl border border-[color:var(--hr-border)] bg-[color:var(--hr-surface)] shadow-[0_16px_48px_rgba(0,0,0,0.18)]"
        >
          <header className="flex items-center gap-2 border-b border-[color:var(--hr-line)] px-4 py-3">
            <span aria-hidden="true" className="text-[color:var(--hr-blue)]">✦</span>
            <h2 className="m-0 text-[15px] font-bold">WorkPalz AI</h2>
            <span className="ml-auto text-[12px]" style={{ color: C.muted }}>
              {source === "offline" ? "Offline mode" : source === "openai" ? "OpenAI" : `Knows the whole dashboard · ${view.team}`}
            </span>
          </header>

          <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4" aria-live="polite" aria-busy={busy}>
            {messages.length === 0 && (
              <p className="m-0 text-[14px] leading-relaxed" style={{ color: C.muted }}>
                Ask anything about your new hires: check-ins, questions, requests, themes and follow-ups. It sees what you see here, with no names.
              </p>
            )}
            {messages.map((m, i) =>
              m.role === "user" ? (
                <p key={i} className="m-0 self-end rounded-2xl rounded-br-md bg-[color:var(--hr-blue-bg)] px-3.5 py-2 text-[14px] text-white">
                  {m.text}
                </p>
              ) : (
                <p key={i} className="m-0 whitespace-pre-line rounded-2xl rounded-bl-md bg-[color:var(--hr-subtle)] px-3.5 py-2.5 text-[14px] leading-relaxed">
                  {m.text}
                </p>
              )
            )}
            {busy && (
              <p className="m-0 text-[13px]" style={{ color: C.muted }}>
                Thinking…
              </p>
            )}
            <div ref={endRef} />
          </div>

          <div className="flex flex-col gap-2 border-t border-[color:var(--hr-line)] px-4 py-3">
            {chips.length > 0 && !busy && (
              <div className="flex flex-wrap gap-1.5">
                {chips.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => send(c)}
                    className="min-h-9 cursor-pointer rounded-full border border-[color:var(--hr-border)] bg-[color:var(--hr-surface)] px-3 text-left text-[12.5px] text-[color:var(--hr-text2)] hover:bg-[color:var(--hr-subtle)]"
                  >
                    {c}
                  </button>
                ))}
              </div>
            )}
            <form
              className="flex gap-2"
              onSubmit={(e: FormEvent) => {
                e.preventDefault();
                send(input);
              }}
            >
              <label htmlFor="assistant-input" className="sr-only">
                Ask the AI
              </label>
              <input
                id="assistant-input"
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                maxLength={500}
                placeholder="e.g. Why is Engineering struggling?"
                className="min-h-11 flex-1 rounded-xl border border-[color:var(--hr-input-border)] px-3.5 text-[14px] outline-none focus:ring-2 focus:ring-[color:var(--hr-blue)]"
              />
              <Button type="submit" disabled={!input.trim() || busy}>
                Ask
              </Button>
            </form>
            <p className="m-0 text-[11.5px]" style={{ color: C.muted }}>
              AI suggests, people decide. Check the data before acting.
            </p>
          </div>
        </section>
      )}
    </>
  );
}
