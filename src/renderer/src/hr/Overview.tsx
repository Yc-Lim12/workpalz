// Overview: what needs attention first, then this week in numbers and the impact so far.
// Layout follows the order HR scans in: the main action top right, a slim number strip,
// the AI themes (what to act on) in the main column, mood and impact in a side column.
import type React from "react";
import { MOODS, type Action, type Analysis, type HrImpact, type HrStats, type Theme } from "../../../shared/types";
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

export default function Overview(p: {
  team: string;
  stats: HrStats | null;
  impact: HrImpact | null;
  manager: boolean;
  analysis: Analysis | null;
  actions: Action[];
  analysing: boolean;
  staleAnalysis: boolean;
  onAnalyse: () => void;
  onCreateAction: (t: Theme) => void;
}) {
  const s = p.stats;
  const themes = (p.analysis?.themes ?? []).filter((t) => p.team === "All" || t.team === p.team);
  const needAction = themes.filter((t) => t.severity === "high").length;

  return (
    <div className="flex flex-col gap-5">
      {/* Page header: where am I, and the one main action, top right */}
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h1 className="m-0 text-[24px] font-bold tracking-tight">New hires · this week</h1>
          <p className="m-0 text-[13px]" style={{ color: C.muted }}>
            Only voluntary check-ins, questions and requests. No activity tracking. Names hidden unless shared.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {p.staleAnalysis && (
            <Chip bg="var(--hr-amber-bg)" fg="var(--hr-amber-fg)">
              New feedback since last analysis
            </Chip>
          )}
          {p.analysis && (
            <span className="text-[12.5px]" style={{ color: C.muted }}>
              {p.analysis.source === "openai" ? "OpenAI" : "Offline analyser"} · {ago(p.analysis.generatedAt)}
            </span>
          )}
          <Button onClick={p.onAnalyse} disabled={p.analysing} aria-busy={p.analysing} className="!min-h-10">
            <span aria-hidden="true">✦ </span>
            {p.analysing ? "Analysing…" : p.analysis ? "Re-analyse" : "Analyse this week"}
          </Button>
        </div>
      </div>

      {/* This week in numbers: one slim strip */}
      {s && (
        <section aria-label="This week in numbers" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Stat icon="people" label="New hires" value={String(s.newHires)} />
          <Stat
            icon="check"
            label="Checked in"
            value={`${s.checkedIn} of ${s.newHires}`}
            sub={`${Math.round((s.checkedIn / Math.max(s.newHires, 1)) * 100)}% response rate`}
          />
          <Stat icon="alert" label="Said stuck, frustrated or overloaded" value={String(s.negative)} sub={`of ${s.checkIns} check-ins`} warn={s.negative > 0} />
          <Stat icon="inbox" label="Open IT/HR requests" value={String(s.openRequests)} />
          <Stat icon="help" label="Questions with no answer" value={String(s.unanswered)} sub={`of ${s.questions} asked`} warn={s.unanswered > 0} />
        </section>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* Main column: what needs attention */}
        <section aria-labelledby="themes-title" className="flex min-w-0 flex-col gap-3">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 id="themes-title" className="m-0 text-[17px] font-bold">
              AI themes
            </h2>
            <span className="text-[13px]" style={{ color: C.muted }}>
              {p.analysis ? `${themes.length} found${needAction ? `, ${needAction} need action` : ""}` : "What to act on this week"}
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

        {/* Side column: how it felt, and what has changed */}
        <aside className="flex min-w-0 flex-col gap-5" aria-label="Mood and impact">
          {s && <Mood stats={s} />}
          {p.impact && <Impact impact={p.impact} manager={p.manager} />}
        </aside>
      </div>
    </div>
  );
}

function Stat({ icon, label, value, sub, warn }: { icon: keyof typeof ICON; label: string; value: string; sub?: string; warn?: boolean }) {
  const fg = warn ? C.amberText : C.muted;
  return (
    <div
      className="flex flex-col gap-1 rounded-2xl border border-[color:var(--hr-line)] p-3.5"
      style={{ background: warn ? C.amberBg : "var(--hr-surface)", borderColor: warn ? "transparent" : undefined }}
    >
      <span className="flex items-center gap-1.5 text-[12.5px] leading-tight" style={{ color: fg }}>
        <Icon name={icon} />
        {label}
      </span>
      <span className="mono text-[22px] font-semibold leading-tight" style={{ color: warn ? C.amberText : C.text }}>
        {value}
      </span>
      {sub && (
        <span className="text-[12px]" style={{ color: fg }}>
          {sub}
        </span>
      )}
    </div>
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
  const actionLabel = action ? (action.status === "done" ? "Follow-up done" : "Follow-up created") : "Create follow-up";

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
          {action ? (action.status === "done" ? "Follow-up done ✓" : "Follow-up created") : "Create follow-up"}
        </Button>
      </div>
    </Card>
  );
}

function Mood({ stats: s }: { stats: HrStats }) {
  const total = Object.values(s.moodCounts).reduce((a, b) => a + b, 0);
  if (!total) return null;
  return (
    <Card as="section" className="flex flex-col gap-3">
      <h2 className="m-0 text-[15px] font-bold">How check-ins felt</h2>
      <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full" aria-hidden="true">
        {MOODS.map((m) => (s.moodCounts[m.id] ? <div key={m.id} style={{ flex: s.moodCounts[m.id], background: m.color }} /> : null))}
      </div>
      <ul className="m-0 grid list-none grid-cols-2 gap-x-3 gap-y-1 p-0 text-[12.5px]" style={{ color: C.muted }}>
        {MOODS.map((m) => (
          <li key={m.id} className="flex items-center gap-1.5">
            <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full" style={{ background: m.color }} />
            {m.label}: <span className="font-semibold text-[color:var(--hr-text)]">{s.moodCounts[m.id]}</span>
          </li>
        ))}
      </ul>
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
