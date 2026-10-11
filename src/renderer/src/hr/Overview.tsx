// Overview: weekly stats + AI themes with trends, evidence and one-click follow-ups.
import { MOODS, type Action, type Analysis, type HrStats, type Theme } from "../../../shared/types";
import { Button, C, Card, Chip, Empty, SOURCE_LABEL, ago } from "./ui";

const SEVERITY = {
  high: { label: "Needs action", bg: "#FFE7CC", fg: "#6E3600" },
  medium: { label: "Watch", bg: "#FFF1C7", fg: "#5C4300" },
  low: { label: "Low", bg: "#ECEEF1", fg: "#343A45" },
} as const;

function Trend({ now, before }: { now: number; before: number }) {
  if (now === before) return <span style={{ color: C.muted }}>Same as last week</span>;
  const up = now > before;
  return (
    <span style={{ color: up ? "#8A2E00" : "#1D6B45" }}>
      <span aria-hidden="true">{up ? "▲" : "▼"} </span>
      {up ? "Up" : "Down"} from {before} last week
    </span>
  );
}

export default function Overview(p: {
  team: string;
  stats: HrStats | null;
  analysis: Analysis | null;
  actions: Action[];
  analysing: boolean;
  staleAnalysis: boolean;
  onAnalyse: () => void;
  onCreateAction: (t: Theme) => void;
}) {
  const s = p.stats;
  const themes = (p.analysis?.themes ?? []).filter((t) => p.team === "All" || t.team === p.team);
  const totalMoods = s ? Object.values(s.moodCounts).reduce((a, b) => a + b, 0) : 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="m-0 text-[28px] font-bold tracking-tight">New hires · this week</h1>
        <p className="m-0 text-[14px]" style={{ color: C.muted }}>
          Built only from voluntary check-ins, questions and requests. No activity tracking. Names hidden unless the employee chose to share.
        </p>
      </div>

      {s && (
        <section aria-label="This week in numbers" className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-4">
          <Stat label="New hires" value={String(s.newHires)} />
          <Stat
            label="Checked in"
            value={`${s.checkedIn} of ${s.newHires}`}
            sub={`${Math.round((s.checkedIn / Math.max(s.newHires, 1)) * 100)}% response rate`}
          />
          <Stat label="Said stuck, frustrated or overloaded" value={String(s.negative)} sub={`of ${s.checkIns} check-ins`} warn={s.negative > 0} />
          <Stat label="Open IT/HR requests" value={String(s.openRequests)} />
          <Stat label="Questions with no answer" value={String(s.unanswered)} sub={`of ${s.questions} asked`} warn={s.unanswered > 0} />
        </section>
      )}

      {s && totalMoods > 0 && (
        <Card as="section">
          <h2 className="m-0 mb-3 text-[15px] font-bold">How check-ins felt</h2>
          <div className="flex h-3 gap-0.5 overflow-hidden rounded" aria-hidden="true">
            {MOODS.map((m) => (s.moodCounts[m.id] ? <div key={m.id} style={{ flex: s.moodCounts[m.id], background: m.color }} /> : null))}
          </div>
          <ul className="m-0 mt-3 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 text-[13px]" style={{ color: C.muted }}>
            {MOODS.map((m) => (
              <li key={m.id} className="flex items-center gap-1.5">
                <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full" style={{ background: m.color }} />
                {m.label}: {s.moodCounts[m.id]}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <section aria-labelledby="themes-title" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <h2 id="themes-title" className="m-0 text-[20px] font-bold">
            AI themes
          </h2>
          {p.analysis && (
            <span className="text-[13px]" style={{ color: C.muted }}>
              {p.analysis.source === "gemini" ? "Gemini" : "Offline analyser"} · {ago(p.analysis.generatedAt)}
            </span>
          )}
          {p.staleAnalysis && (
            <Chip bg="#FFE7CC" fg="#6E3600">
              New feedback since last analysis
            </Chip>
          )}
          <Button variant="dark" className="ml-auto" onClick={p.onAnalyse} disabled={p.analysing} aria-busy={p.analysing}>
            {p.analysing ? "Analysing…" : p.analysis ? "Re-analyse" : "Analyse this week"}
          </Button>
        </div>

        {!p.analysis && <Empty>Run the analysis to group this week's feedback into themes with suggested actions.</Empty>}
        {p.analysis && themes.length === 0 && <Empty>No recurring problems for this team this week.</Empty>}

        <ul className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(340px,1fr))] gap-4 p-0">
          {themes.map((t) => {
            const sev = SEVERITY[t.severity] ?? SEVERITY.low;
            const action = p.actions.find((a) => a.themeId === t.id);
            const parts = [
              t.sources["check-in"] && `${t.sources["check-in"]} check-in${t.sources["check-in"] > 1 ? "s" : ""}`,
              t.sources.question && `${t.sources.question} unanswered question${t.sources.question > 1 ? "s" : ""}`,
              t.sources.request && `${t.sources.request} open request${t.sources.request > 1 ? "s" : ""}`,
            ].filter(Boolean);
            return (
              <li key={t.id}>
                <Card as="article" className="flex h-full flex-col gap-3.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Chip bg={sev.bg} fg={sev.fg}>
                      {sev.label}
                    </Chip>
                    <span className="text-[13px]" style={{ color: C.muted }}>
                      {t.team}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <h3 className="m-0 text-[18px] font-bold leading-snug">{t.title}</h3>
                    <p className="m-0 text-[14px] font-semibold" style={{ color: C.amberText }}>
                      {t.affected} of {t.teamSize} {t.team} new hires
                    </p>
                    <p className="m-0 text-[13px]">
                      <Trend now={t.affected} before={t.lastWeekAffected} />
                    </p>
                  </div>
                  <p className="m-0 text-[14px] leading-relaxed text-[#2E333C]">{t.summary}</p>

                  {t.evidence.length > 0 && (
                    <div className="flex flex-col gap-2">
                      <h4 className="m-0 text-[12px] font-bold uppercase tracking-wide" style={{ color: C.muted }}>
                        What they said
                      </h4>
                      <ul className="m-0 flex list-none flex-col gap-2 p-0">
                        {t.evidence.map((e, i) => (
                          <li key={i} className="flex items-start gap-2 text-[13.5px] text-[#2E333C]">
                            <Chip bg="#ECEEF1" fg="#343A45">
                              {SOURCE_LABEL[e.source] ?? e.source}
                            </Chip>
                            <q className="pt-0.5">{e.text}</q>
                          </li>
                        ))}
                      </ul>
                      {parts.length > 0 && (
                        <p className="m-0 text-[12.5px]" style={{ color: C.muted }}>
                          Based on {parts.join(", ")}.
                        </p>
                      )}
                    </div>
                  )}

                  <div className="mt-auto flex flex-col gap-1.5 rounded-xl bg-[#EEF3FF] p-3.5">
                    <h4 className="m-0 text-[12px] font-bold uppercase tracking-wide" style={{ color: C.blueText }}>
                      Suggested action
                    </h4>
                    <p className="m-0 text-[14px] leading-snug">{t.suggestedAction}</p>
                  </div>
                  <Button
                    variant={action ? "muted" : "primary"}
                    disabled={!!action}
                    onClick={() => p.onCreateAction(t)}
                    aria-label={action ? `Follow-up created for ${t.title}` : `Create follow-up for ${t.title}, ${t.team}`}
                  >
                    {action ? (action.status === "done" ? "Follow-up done ✓" : "Follow-up created") : "Create follow-up"}
                  </Button>
                </Card>
              </li>
            );
          })}
        </ul>
        <p className="m-0 text-[13px]" style={{ color: C.muted }}>
          AI suggests, people decide. Check the quotes before acting. Themes are never used for performance reviews.
        </p>
      </section>
    </div>
  );
}

function Stat({ label, value, sub, warn }: { label: string; value: string; sub?: string; warn?: boolean }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-2xl p-5" style={{ background: warn ? C.amberBg : "#FFFFFF" }}>
      <span className="text-[13px]" style={{ color: warn ? C.amberText : C.muted }}>
        {label}
      </span>
      <span className="mono text-[28px] font-semibold" style={{ color: warn ? C.amberText : C.text }}>
        {value}
      </span>
      {sub && (
        <span className="text-[12.5px]" style={{ color: warn ? C.amberText : C.muted }}>
          {sub}
        </span>
      )}
    </div>
  );
}
