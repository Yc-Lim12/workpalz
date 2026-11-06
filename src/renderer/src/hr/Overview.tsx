// Overview: one "hero" card with the week's headline and the main actions, the numbers that
// changed (with up/down vs last week), two charts, then the AI themes to act on.
// A side panel holds the team switcher, follow-ups and impact, next to the content they change.
import type React from "react";
import { SIGNALS, type Action, type Analysis, type HrAsk, type HrImpact, type HrRequest, type HrStats, type Theme, REQUEST_CATEGORIES } from "../../../shared/types";
import { Button, C, Card, Chip, Empty, SOURCE_LABEL, ago } from "./ui";

const SEVERITY = {
  high: { label: "Needs action", bg: "var(--hr-amber-bg)", fg: "var(--hr-amber-fg)", bar: "var(--hr-amber-fg)" },
  medium: { label: "Watch", bg: "var(--hr-yellow-bg)", fg: "var(--hr-yellow-fg)", bar: "var(--hr-yellow-fg)" },
  low: { label: "Low", bg: "var(--hr-neutral-bg)", fg: "var(--hr-neutral-fg)", bar: "var(--hr-border)" },
} as const;

// Small line icons so each number is recognised at a glance (decorative: the label says it all)
const ICON: Record<string, React.ReactNode> = {
  people: <path d="M16 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6M21 19v-1a4 4 0 0 0-3-3.9M15 4.1a3 3 0 0 1 0 5.8" />,
  check: <path d="M20 6 9 17l-5-5" />,
  alert: <path d="M12 9v4m0 4h.01M10.3 3.9 2.4 17.5A2 2 0 0 0 4.1 20.5h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0" />,
  inbox: <path d="M22 12h-6l-2 3h-4l-2-3H2m3.5-6.9L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.7 4H7.3a2 2 0 0 0-1.8 1.1" />,
  bell: <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9m4.3 13a1.9 1.9 0 0 0 3.4 0" />,
  spark: <path d="M12 3v4m0 10v4M3 12h4m10 0h4M5.6 5.6l2.8 2.8m7.2 7.2 2.8 2.8m0-12.8-2.8 2.8m-7.2 7.2-2.8 2.8" />,
  help: <path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3m.1 4h.01M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20" />,
};
const Icon = ({ name }: { name: keyof typeof ICON }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {ICON[name]}
  </svg>
);

function Trend({ now, before }: { now: number; before: number }) {
  if (now === before) return <span style={{ color: C.muted }}>Same as last week</span>;
  const up = now > before;
  return (
    <span style={{ color: up ? "var(--hr-red-fg)" : "var(--hr-green-fg)" }}>
      <span aria-hidden="true">{up ? "▲" : "▼"} </span>
      {up ? "Up" : "Down"} from {before} last week
    </span>
  );
}

// "Ask AI" lives in the header; the hero's button opens the same panel
export const ASK_AI_EVENT = "workpalz:ask-ai";

export default function Overview(p: {
  team: string;
  teams: string[];
  stats: HrStats | null;
  impact: HrImpact | null;
  manager: boolean;
  analysis: Analysis | null;
  actions: Action[];
  requests: HrRequest[];
  asks: HrAsk[];
  analysing: boolean;
  staleAnalysis: boolean;
  onAnalyse: () => void;
  onCreateAction: (t: Theme) => void;
  onSelectTeam?: (team: string) => void; // left out in manager view (one team only)
  onOpenTab: (tab: "requests" | "questions" | "followups") => void;
}) {
  const s = p.stats;
  const themes = (p.analysis?.themes ?? []).filter((t) => p.team === "All" || t.team === p.team);

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_330px]">
      <div className="flex min-w-0 flex-col gap-5">
        <h1 className="m-0 text-[26px] font-bold tracking-tight">
          {p.team === "All" ? "New hires" : `${p.team} new hires`} · this week
        </h1>

        {s && (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <Hero stats={s} impact={p.impact} analysis={p.analysis} themes={themes} analysing={p.analysing} stale={p.staleAnalysis} onAnalyse={p.onAnalyse} />
            <div className="grid gap-4">
              <Kpi
                icon="alert"
                label="Said they need help"
                value={String(s.negative)}
                sub={`of ${s.checkIns} check-ins`}
                delta={<Delta now={s.negative} before={s.lastWeek.negative} goodWhenUp={false} />}
                warn={s.negative > 0}
              />
              <Kpi
                icon="check"
                label="Checked in"
                value={`${s.checkedIn} of ${s.newHires}`}
                sub={`${Math.round((s.checkedIn / Math.max(s.newHires, 1)) * 100)}% response rate`}
                delta={p.impact && <Delta now={p.impact.checkInRate.thisWeek} before={p.impact.checkInRate.lastWeek} goodWhenUp unit="%" />}
              />
            </div>
          </div>
        )}

        {s && (
          <section aria-label="More numbers" className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Kpi icon="people" label="New hires" value={String(s.newHires)} compact />
            <Kpi icon="inbox" label="Open IT/HR requests" value={String(s.openRequests)} compact />
            <Kpi icon="help" label="Questions with no answer" value={String(s.unanswered)} sub={`of ${s.questions} asked`} warn={s.unanswered > 0} compact />
          </section>
        )}

        {s && (
          <div className="grid gap-4 lg:grid-cols-2">
            <TeamChart stats={s} />
            <Donut stats={s} />
          </div>
        )}

        <section aria-labelledby="themes-title" className="flex min-w-0 flex-col gap-3">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 id="themes-title" className="m-0 text-[17px] font-bold">
              AI themes
            </h2>
            <span className="text-[13px]" style={{ color: C.muted }}>
              {p.analysis ? `${themes.length} found${themes.filter((t) => t.severity === "high").length ? `, ${themes.filter((t) => t.severity === "high").length} need action` : ""}` : "What to act on this week"}
            </span>
          </div>
          {!p.analysis && <Empty>Press Analyse this week to group this week's feedback into themes with suggested actions.</Empty>}
          {p.analysis && themes.length === 0 && <Empty>No recurring problems for this team this week.</Empty>}
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {themes.map((t) => (
              <li key={t.id}>
                <ThemeCard t={t} manager={p.manager} action={p.actions.find((a) => a.themeId === t.id || (a.team === t.team && a.themeTitle === t.title))} onCreate={() => p.onCreateAction(t)} />
              </li>
            ))}
          </ul>
          <p className="m-0 text-[12.5px]" style={{ color: C.muted }}>
            AI suggests, people decide. Check the quotes before acting. Themes are never used for performance reviews.
          </p>
        </section>

        {!p.manager && <Recent requests={p.requests} asks={p.asks} onOpenTab={p.onOpenTab} />}
      </div>

      {/* Side panel: switch team, see follow-ups and impact without leaving the page */}
      <aside className="flex min-w-0 flex-col gap-4" aria-label="Teams, follow-ups and impact">
        {s && <Teams stats={s} team={p.team} onSelect={p.onSelectTeam} />}
        <FollowUps actions={p.actions} onOpen={() => p.onOpenTab("followups")} />
        {p.impact && <Impact impact={p.impact} manager={p.manager} />}
      </aside>
    </div>
  );
}

// ---------- Hero: the week's headline and the main actions ----------

function Hero(p: {
  stats: HrStats;
  impact: HrImpact | null;
  analysis: Analysis | null;
  themes: Theme[];
  analysing: boolean;
  stale: boolean;
  onAnalyse: () => void;
}) {
  const urgent = p.themes.filter((t) => t.severity === "high");
  const top = urgent[0] ?? p.themes[0];
  const rate = Math.round((p.stats.checkedIn / Math.max(p.stats.newHires, 1)) * 100);
  return (
    <section
      aria-labelledby="hero-title"
      className="flex flex-col gap-4 rounded-3xl p-5"
      style={{ background: "linear-gradient(135deg, var(--hr-hero-from), var(--hr-hero-to))", color: "var(--hr-hero-text)" }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="hero-title" className="m-0 text-[14px] font-semibold" style={{ color: "var(--hr-hero-muted)" }}>
          Needs your attention
        </h2>
        {p.stale && (
          <span className="rounded-full bg-[color:var(--hr-surface)] px-2.5 py-0.5 text-[12px] font-semibold text-[color:var(--hr-amber-fg)]">
            New feedback since last analysis
          </span>
        )}
      </div>

      {p.analysis ? (
        <div className="flex flex-col gap-1">
          <p className="m-0 flex items-baseline gap-2">
            <span className="mono text-[46px] font-semibold leading-none">{urgent.length}</span>
            <span className="text-[16px] font-semibold">{urgent.length === 1 ? "problem needs action" : "problems need action"}</span>
          </p>
          {top && (
            <p className="m-0 text-[14px]" style={{ color: "var(--hr-hero-muted)" }}>
              Biggest: <strong style={{ color: "var(--hr-hero-text)" }}>{top.title}</strong>, {top.affected} of {top.teamSize} in {top.team}
            </p>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          <p className="m-0 text-[22px] font-bold leading-snug">Find what's blocking new hires this week</p>
          <p className="m-0 text-[14px]" style={{ color: "var(--hr-hero-muted)" }}>
            {p.stats.checkIns} check-ins, {p.stats.questions} questions and {p.stats.openRequests} open requests ready to analyse.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-[13px]" style={{ color: "var(--hr-hero-muted)" }}>
          <span>{rate}% checked in this week</span>
          {p.impact && <Delta now={p.impact.checkInRate.thisWeek} before={p.impact.checkInRate.lastWeek} goodWhenUp unit="%" plain />}
        </div>
        <span aria-hidden="true" className="h-2 overflow-hidden rounded-full" style={{ background: "var(--hr-hero-track)" }}>
          <span className="block h-full rounded-full" style={{ width: `${rate}%`, background: "var(--hr-hero-text)" }} />
        </span>
      </div>

      <div className="mt-auto flex flex-wrap items-center gap-2.5">
        <Button variant="dark" onClick={p.onAnalyse} disabled={p.analysing} aria-busy={p.analysing} className="!min-h-10 rounded-full">
          <span aria-hidden="true">✦ </span>
          {p.analysing ? "Analysing…" : p.analysis ? "Re-analyse" : "Analyse this week"}
        </Button>
        <button
          type="button"
          onClick={() => window.dispatchEvent(new Event(ASK_AI_EVENT))}
          className="min-h-10 cursor-pointer rounded-full border border-[color:var(--hr-hero-muted)] bg-transparent px-4 text-[14px] font-semibold transition hover:bg-[color:var(--hr-hero-track)]"
          style={{ color: "var(--hr-hero-text)" }}
        >
          Ask AI about it
        </button>
        {p.analysis && (
          <span className="text-[12.5px]" style={{ color: "var(--hr-hero-muted)" }}>
            {p.analysis.source === "openai" ? "OpenAI" : "Offline analyser"} · {ago(p.analysis.generatedAt)}
          </span>
        )}
      </div>
    </section>
  );
}

// ---------- Numbers with up/down vs last week ----------

// Colour and arrow both say it; the words say it too ("up 3 vs last week")
function Delta({ now, before, goodWhenUp, unit = "", plain }: { now: number; before: number; goodWhenUp: boolean; unit?: string; plain?: boolean }) {
  const diff = now - before;
  if (diff === 0)
    return (
      <span className="text-[12px] font-semibold" style={{ color: plain ? "var(--hr-hero-muted)" : C.muted }}>
        Same as last week
      </span>
    );
  const good = diff > 0 === goodWhenUp;
  const text = `${diff > 0 ? "Up" : "Down"} ${Math.abs(diff)}${unit} vs last week`;
  if (plain)
    return (
      <span className="text-[12.5px] font-semibold">
        <span aria-hidden="true">{diff > 0 ? "▲" : "▼"} </span>
        {text}
      </span>
    );
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-semibold"
      style={{ background: good ? "var(--hr-green-bg)" : "var(--hr-red-bg)", color: good ? "var(--hr-green-fg)" : "var(--hr-red-fg)" }}
    >
      <span aria-hidden="true">{diff > 0 ? "▲" : "▼"}</span>
      {text}
    </span>
  );
}

function Kpi(p: { icon: keyof typeof ICON; label: string; value: string; sub?: string; delta?: React.ReactNode; warn?: boolean; compact?: boolean }) {
  const fg = p.warn ? C.amberText : C.muted;
  return (
    <div
      className={`flex flex-col gap-1 rounded-2xl border p-4 ${p.compact ? "" : "justify-between"}`}
      style={{ background: p.warn ? C.amberBg : "var(--hr-surface)", borderColor: p.warn ? "transparent" : "var(--hr-line)" }}
    >
      <span className="flex items-center gap-1.5 text-[12.5px] leading-tight" style={{ color: fg }}>
        <Icon name={p.icon} />
        {p.label}
      </span>
      <span className="flex flex-wrap items-end justify-between gap-2">
        <span className={`mono font-semibold leading-tight ${p.compact ? "text-[22px]" : "text-[28px]"}`} style={{ color: p.warn ? C.amberText : C.text }}>
          {p.value}
        </span>
        {p.delta}
      </span>
      {p.sub && (
        <span className="text-[12px]" style={{ color: fg }}>
          {p.sub}
        </span>
      )}
    </div>
  );
}

// ---------- Charts (each with the numbers in words, not only shapes) ----------

function TeamChart({ stats: s }: { stats: HrStats }) {
  const rows = [...s.byTeam].sort((a, b) => b.needHelp / Math.max(b.newHires, 1) - a.needHelp / Math.max(a.newHires, 1));
  return (
    <Card as="section" className="flex flex-col gap-3" aria-labelledby="teamchart-title">
      <h2 id="teamchart-title" className="m-0 text-[15px] font-bold">
        Needs help, by team
      </h2>
      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {rows.map((r) => {
          const share = Math.round((r.needHelp / Math.max(r.newHires, 1)) * 100);
          return (
            <li key={r.team} className="flex flex-col gap-1">
              <span className="flex items-baseline justify-between text-[13px]">
                <span className="font-semibold">{r.team}</span>
                <span style={{ color: C.muted }}>
                  <span className="font-semibold text-[color:var(--hr-text)]">{r.needHelp}</span> of {r.newHires} need help
                </span>
              </span>
              <span aria-hidden="true" className="h-2.5 overflow-hidden rounded-full bg-[color:var(--hr-chip)]">
                <span
                  className="block h-full rounded-full"
                  style={{ width: `${Math.max(share, r.needHelp ? 4 : 0)}%`, background: share >= 50 ? "var(--hr-amber-fg)" : share > 0 ? "var(--hr-yellow-fg)" : "var(--hr-green-fg)" }}
                />
              </span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function Donut({ stats: s }: { stats: HrStats }) {
  const total = Object.values(s.signalCounts).reduce((a, b) => a + b, 0);
  const R = 42;
  const L = 2 * Math.PI * R;
  let offset = 0;
  return (
    <Card as="section" className="flex flex-col gap-3" aria-labelledby="donut-title">
      <h2 id="donut-title" className="m-0 text-[15px] font-bold">
        How check-ins felt
      </h2>
      {total === 0 ? (
        <p className="m-0 text-[13px]" style={{ color: C.muted }}>
          No check-ins yet this week.
        </p>
      ) : (
        <div className="flex items-center gap-5">
          <svg width="112" height="112" viewBox="0 0 112 112" aria-hidden="true" className="shrink-0 -rotate-90">
            <circle cx="56" cy="56" r={R} fill="none" stroke="var(--hr-chip)" strokeWidth="14" />
            {SIGNALS.map((m) => {
              const len = (s.signalCounts[m.id] / total) * L;
              const seg = (
                <circle key={m.id} cx="56" cy="56" r={R} fill="none" stroke={m.color} strokeWidth="14" strokeDasharray={`${len} ${L - len}`} strokeDashoffset={-offset} />
              );
              offset += len;
              return len ? seg : null;
            })}
          </svg>
          <div className="flex flex-col gap-2">
            <p className="m-0 text-[13px]" style={{ color: C.muted }}>
              <span className="mono text-[22px] font-semibold text-[color:var(--hr-text)]">{total}</span> check-ins
            </p>
            <ul className="m-0 flex list-none flex-col gap-1 p-0 text-[13px]">
              {SIGNALS.map((m) => (
                <li key={m.id} className="flex items-center gap-2">
                  <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full" style={{ background: m.color }} />
                  <span style={{ color: C.muted }}>{m.label}</span>
                  <span className="font-semibold">
                    {s.signalCounts[m.id]} ({Math.round((s.signalCounts[m.id] / total) * 100)}%)
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </Card>
  );
}

// ---------- Side panel ----------

// The team switcher sits next to the content it changes (like a project switcher)
function Teams({ stats: s, team, onSelect }: { stats: HrStats; team: string; onSelect?: (team: string) => void }) {
  const card = (key: string, label: string, sub: string, needHelp: number, active: boolean) => {
    const body = (
      <>
        <span className="flex items-center justify-between gap-2">
          <span className="text-[14px] font-bold">{label}</span>
          {needHelp > 0 && (
            <span className="rounded-full bg-[color:var(--hr-amber-bg)] px-2 py-0.5 text-[11.5px] font-semibold text-[color:var(--hr-amber-fg)]">{needHelp} need help</span>
          )}
        </span>
        <span className="text-[12px]" style={{ color: C.muted }}>
          {sub}
        </span>
      </>
    );
    const cls = "flex w-full flex-col gap-1 rounded-xl border px-3.5 py-2.5 text-left transition";
    const style = { background: active ? "var(--hr-blue-soft)" : "var(--hr-bg)", borderColor: active ? "var(--hr-blue)" : "var(--hr-line)" };
    return onSelect ? (
      <li key={key}>
        <button type="button" aria-pressed={active} onClick={() => onSelect(key)} className={`${cls} cursor-pointer hover:border-[color:var(--hr-blue)]`} style={style}>
          {body}
        </button>
      </li>
    ) : (
      <li key={key} className={cls} style={style}>
        {body}
      </li>
    );
  };
  const all = s.byTeam.reduce((n, r) => ({ hires: n.hires + r.newHires, help: n.help + r.needHelp }), { hires: 0, help: 0 });
  return (
    <Card as="section" className="flex flex-col gap-3" aria-labelledby="teams-title">
      <h2 id="teams-title" className="m-0 text-[15px] font-bold">
        {onSelect ? "Teams" : "Your team"}
      </h2>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {onSelect && card("All", "All teams", `${all.hires} new hires`, team === "All" ? all.help : 0, team === "All")}
        {s.byTeam.map((r) => card(r.team, r.team, `${r.newHires} new hires · ${r.checkedIn} checked in`, r.needHelp, team === r.team || !onSelect))}
      </ul>
    </Card>
  );
}

const ACTION_STATUS: Record<string, { label: string; bg: string; fg: string }> = {
  open: { label: "Open", bg: "var(--hr-blue-soft)", fg: "var(--hr-blue-text)" },
  done: { label: "Done", bg: "var(--hr-green-bg)", fg: "var(--hr-green-fg)" },
  retry: { label: "Needs another try", bg: "var(--hr-amber-bg)", fg: "var(--hr-amber-fg)" },
  stuck: { label: "Still not fixed", bg: "var(--hr-red-bg)", fg: "var(--hr-red-fg)" },
};

function FollowUps({ actions, onOpen }: { actions: Action[]; onOpen: () => void }) {
  const list = [...actions].sort((a, b) => (a.status === "done" ? 1 : 0) - (b.status === "done" ? 1 : 0)).slice(0, 4);
  return (
    <Card as="section" className="flex flex-col gap-2" aria-labelledby="fu-title">
      <div className="flex items-center justify-between">
        <h2 id="fu-title" className="m-0 text-[15px] font-bold">
          Follow-ups
        </h2>
        <button type="button" onClick={onOpen} className="min-h-9 cursor-pointer rounded-lg px-2 text-[12.5px] font-semibold text-[color:var(--hr-blue)] hover:bg-[color:var(--hr-bg)]">
          See all ›
        </button>
      </div>
      {list.length === 0 ? (
        <p className="m-0 text-[12.5px]" style={{ color: C.muted }}>
          None yet. Create one from an AI theme.
        </p>
      ) : (
        <ul className="m-0 flex list-none flex-col p-0">
          {list.map((a) => {
            const st = ACTION_STATUS[a.status] ?? ACTION_STATUS.open;
            return (
              <li key={a.id} className="flex flex-col gap-1 border-t border-[color:var(--hr-line-soft)] py-2.5 first:border-0 first:pt-0">
                <span className="text-[13px] font-semibold leading-snug">{a.themeTitle}</span>
                <span className="flex items-center gap-2 text-[12px]" style={{ color: C.muted }}>
                  <span className="rounded-full px-2 py-0.5 text-[11.5px] font-semibold" style={{ background: st.bg, color: st.fg }}>
                    {st.label}
                  </span>
                  {a.team}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

// ---------- Recent activity (HR only; no names here, details stay in their tabs) ----------

function Recent({ requests, asks, onOpenTab }: { requests: HrRequest[]; asks: HrAsk[]; onOpenTab: (tab: "requests" | "questions") => void }) {
  const rows = [
    ...requests.map((r) => ({
      id: `r-${r.id}`,
      at: r.createdAt,
      kind: "Request" as const,
      what: REQUEST_CATEGORIES.find((c) => c.id === r.category)?.label ?? r.category,
      team: r.team,
      status: r.status === "resolved" ? "Resolved" : r.status === "in_progress" ? "In progress" : "Open",
      tab: "requests" as const,
    })),
    ...asks
      .filter((a) => !a.answered)
      .map((a) => ({ id: `a-${a.id}`, at: a.createdAt, kind: "Question" as const, what: a.question, team: a.team, status: "Not in the guide", tab: "questions" as const })),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 6);
  if (!rows.length) return null;
  return (
    <Card as="section" className="flex flex-col gap-2" aria-labelledby="recent-title">
      <h2 id="recent-title" className="m-0 text-[15px] font-bold">
        Recent activity
      </h2>
      <ul className="m-0 flex list-none flex-col p-0">
        {rows.map((r) => (
          <li key={r.id} className="border-t border-[color:var(--hr-line-soft)] first:border-0">
            <button type="button" onClick={() => onOpenTab(r.tab)} className="grid w-full cursor-pointer grid-cols-[90px_minmax(0,1fr)_auto] items-center gap-3 rounded-lg px-1 py-2.5 text-left hover:bg-[color:var(--hr-bg)] sm:grid-cols-[90px_minmax(0,1fr)_110px_120px_80px]">
              <Chip bg="var(--hr-neutral-bg)" fg="var(--hr-neutral-fg)">
                {r.kind}
              </Chip>
              <span className="truncate text-[13px] font-semibold">{r.what}</span>
              <span className="hidden text-[12.5px] sm:block" style={{ color: C.muted }}>
                {r.team}
              </span>
              <span className="hidden text-[12.5px] sm:block" style={{ color: C.muted }}>
                {r.status}
              </span>
              <span className="text-right text-[12px]" style={{ color: C.muted }}>
                {ago(r.at)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function ThemeCard({ t, manager, action, onCreate }: { t: Theme; manager: boolean; action?: Action; onCreate: () => void }) {
  const sev = SEVERITY[t.severity] ?? SEVERITY.low;
  const parts = [
    t.sources["check-in"] && `${t.sources["check-in"]} check-in${t.sources["check-in"] > 1 ? "s" : ""}`,
    t.sources.question && `${t.sources.question} unanswered question${t.sources.question > 1 ? "s" : ""}`,
    t.sources.request && `${t.sources.request} open request${t.sources.request > 1 ? "s" : ""}`,
  ].filter(Boolean);
  const share = Math.round((t.affected / Math.max(t.teamSize, 1)) * 100);
  const actionLabel = !action
    ? "Create follow-up"
    : action.status === "done"
      ? "Follow-up done"
      : action.status === "retry"
        ? "Needs another try"
        : action.status === "stuck"
          ? "Still not fixed"
          : "Follow-up created";

  return (
    <Card as="article" className="relative flex flex-col gap-3 overflow-hidden !pl-5">
      {/* Severity also shown as a colour edge; the chip says it in words */}
      <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1" style={{ background: sev.bar }} />
      <div className="flex flex-wrap items-center gap-2">
        <Chip bg={sev.bg} fg={sev.fg}>
          {sev.label}
        </Chip>
        <span className="text-[13px] font-semibold" style={{ color: C.muted }}>
          {t.team}
        </span>
        <span className="ml-auto text-[12.5px]">
          <Trend now={t.affected} before={t.lastWeekAffected} />
        </span>
      </div>

      <div className="flex flex-col gap-1.5">
        <h3 className="m-0 text-[16px] font-bold leading-snug">{t.title}</h3>
        <div className="flex items-center gap-3">
          <p className="m-0 shrink-0 text-[13.5px] font-semibold" style={{ color: C.amberText }}>
            {t.affected} of {t.teamSize} {t.team} new hires
          </p>
          <span aria-hidden="true" className="h-1.5 max-w-[200px] flex-1 overflow-hidden rounded-full bg-[color:var(--hr-chip)]">
            <span className="block h-full rounded-full" style={{ width: `${share}%`, background: sev.bar }} />
          </span>
        </div>
      </div>
      <p className="m-0 text-[13.5px] leading-relaxed text-[color:var(--hr-text2)]">{t.summary}</p>

      <div className="flex flex-col gap-1 rounded-xl bg-[color:var(--hr-blue-soft)] px-3.5 py-3">
        <h4 className="m-0 text-[11.5px] font-bold uppercase tracking-wide" style={{ color: C.blueText }}>
          Suggested action
        </h4>
        <p className="m-0 text-[13.5px] leading-snug">{t.suggestedAction}</p>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {manager ? (
          parts.length > 0 && (
            <p className="m-0 min-w-0 flex-1 text-[12.5px]" style={{ color: C.muted }}>
              Based on {parts.join(", ")}. Quotes stay with HR so no one can be identified.
            </p>
          )
        ) : (
          t.evidence.length > 0 && (
            // Quotes on request: the card stays short, the evidence is one click away
            <details className="group min-w-0 flex-1">
              <summary className="flex min-h-9 cursor-pointer list-none items-center gap-1.5 rounded-lg text-[13px] font-semibold text-[color:var(--hr-blue)] [&::-webkit-details-marker]:hidden">
                <span aria-hidden="true" className="inline-block transition group-open:rotate-90">
                  ›
                </span>
                What they said ({t.evidence.length})
              </summary>
              <ul className="m-0 mt-2 flex list-none flex-col gap-2 p-0">
                {t.evidence.map((e, i) => (
                  <li key={i} className="flex items-start gap-2 text-[13px] text-[color:var(--hr-text2)]">
                    <Chip bg="var(--hr-neutral-bg)" fg="var(--hr-neutral-fg)">
                      {SOURCE_LABEL[e.source] ?? e.source}
                    </Chip>
                    <q className="pt-0.5">{e.text}</q>
                  </li>
                ))}
              </ul>
              {parts.length > 0 && (
                <p className="m-0 mt-2 text-[12px]" style={{ color: C.muted }}>
                  Based on {parts.join(", ")}.
                </p>
              )}
            </details>
          )
        )}
        <Button
          variant={action ? "muted" : "primary"}
          disabled={!!action}
          onClick={onCreate}
          aria-label={`${actionLabel} for ${t.title}, ${t.team}`}
          className="ml-auto !min-h-10"
        >
          {actionLabel}
          {action?.status === "done" && <span aria-hidden="true"> ✓</span>}
        </Button>
      </div>
    </Card>
  );
}

// ---------- Impact: what has changed because of WorkPalz ----------

function Change({ now, before, goodWhenUp, unit = "" }: { now: number; before: number; goodWhenUp: boolean; unit?: string }) {
  if (now === before) return <span style={{ color: C.muted }}>Same as last week</span>;
  const up = now > before;
  const good = up === goodWhenUp;
  return (
    <span style={{ color: good ? "var(--hr-green-fg)" : "var(--hr-red-fg)" }}>
      <span aria-hidden="true">{up ? "▲" : "▼"} </span>
      {up ? "Up" : "Down"} from {before}
      {unit} last week
    </span>
  );
}

function Impact({ impact: m, manager }: { impact: HrImpact; manager: boolean }) {
  const rows: { label: string; value: string; sub: React.ReactNode }[] = [
    {
      label: "Check-in response rate",
      value: `${m.checkInRate.thisWeek}%`,
      sub: <Change now={m.checkInRate.thisWeek} before={m.checkInRate.lastWeek} goodWhenUp unit="%" />,
    },
    {
      label: "Requests resolved",
      value: String(m.requestsResolved),
      sub: m.avgDaysToResolve === null ? "None resolved yet" : `${m.avgDaysToResolve} days on average`,
    },
    {
      label: "Oldest open request",
      value: m.oldestOpenDays === null ? "None" : `${m.oldestOpenDays} days`,
      sub: m.oldestOpenDays !== null && m.oldestOpenDays >= 5 ? (manager ? "Blocking a new hire. HR and IT are on it" : "Blocking a new hire. See Requests") : "Waiting time",
    },
    {
      label: "Follow-ups done",
      value: `${m.followUpsDone} of ${m.followUpsDone + m.followUpsOpen}`,
      sub: `${m.peopleTold} new hire${m.peopleTold === 1 ? "" : "s"} told what changed`,
    },
    {
      label: "Fixes that worked",
      value: m.fixesWorked.checked ? `${m.fixesWorked.worked} of ${m.fixesWorked.checked}` : "None yet",
      sub: m.fixesWorked.checked ? "New hires said the follow-up helped" : "Asked at the check-in after a follow-up",
    },
    {
      label: "Fixed without a ticket",
      value: String(m.solvedByGuide),
      sub: "Quick request tips that solved it",
    },
    {
      label: "Company guide gaps closed",
      value: String(m.handbookAdded),
      sub: `${m.questionsNowAnswered} question${m.questionsNowAnswered === 1 ? "" : "s"} now answered`,
    },
  ];
  return (
    <Card as="section" className="flex flex-col gap-1" aria-labelledby="impact-title">
      <h2 id="impact-title" className="m-0 text-[15px] font-bold">
        Impact
      </h2>
      <p className="m-0 mb-1 text-[12.5px]" style={{ color: C.muted }}>
        What changed because you acted on the feedback
      </p>
      <ul className="m-0 flex list-none flex-col p-0">
        {rows.map((r) => (
          <li key={r.label} className="flex items-start gap-3 border-t border-[color:var(--hr-line-soft)] py-2.5 first:border-0">
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-[13px] font-semibold">{r.label}</span>
              <span className="text-[12px]" style={{ color: C.muted }}>
                {r.sub}
              </span>
            </span>
            <span className="mono shrink-0 text-[17px] font-semibold">{r.value}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
