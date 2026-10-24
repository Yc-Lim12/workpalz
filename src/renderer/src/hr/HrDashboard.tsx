// HR dashboard shell: header, navigation, team filter, live data and announcements.
import { useCallback, useEffect, useRef, useState } from "react";
import { guideLabel } from "../../../shared/types";
import type { Action, Analysis, HandbookEntry, HandbookInput, HrAsk, HrImpact, HrCheckIn, HrRequest, HrStats, RequestStatus, Theme } from "../../../shared/types";
import Assistant from "./Assistant";
import Overview from "./Overview";
import { CheckInsTab, FollowUpsTab, QuestionsTab, RequestsTab } from "./Tabs";
import { Button, C } from "./ui";

const api = window.workpalz;
type Tab = "overview" | "requests" | "questions" | "followups" | "checkins";

export default function HrDashboard() {
  const [tab, setTab] = useState<Tab>("overview");
  const [teamFilter, setTeam] = useState("All");
  // "hr" or "manager:<team>". A real deployment decides this at sign-in.
  const [viewAs, setViewAs] = useState("hr");
  const managerTeam = viewAs.startsWith("manager:") ? viewAs.slice("manager:".length) : null;
  const team = managerTeam ?? teamFilter;
  const [teams, setTeams] = useState<string[]>([]);
  const [stats, setStats] = useState<HrStats | null>(null);
  const [impact, setImpact] = useState<HrImpact | null>(null);
  const [checkIns, setCheckIns] = useState<HrCheckIn[]>([]);
  const [asks, setAsks] = useState<HrAsk[]>([]);
  const [requests, setRequests] = useState<HrRequest[]>([]);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [actions, setActions] = useState<Action[]>([]);
  const [handbookAdded, setHandbookAdded] = useState<HandbookEntry[]>([]);
  const [analysing, setAnalysing] = useState(false);
  const [announce, setAnnounce] = useState("");
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    try {
      const saved = localStorage.getItem("hr-theme");
      if (saved === "light" || saved === "dark") return saved;
    } catch {}
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });
  const mainRef = useRef<HTMLElement>(null);
  const refreshCall = useRef(0);
  const firstRender = useRef(true);

  const say = (t: string) => {
    setAnnounce("");
    window.setTimeout(() => setAnnounce(t), 50);
  };

  const refresh = useCallback(async () => {
    const call = ++refreshCall.current;
    const [tm, st, im, c, a, r, an, ac, hb] = await Promise.all([
      api.hrTeams(),
      api.hrStats(team),
      api.hrImpact(team),
      api.hrCheckIns(),
      api.hrAsks(),
      api.hrRequests(),
      api.getLastAnalysis(),
      api.listActions(),
      api.listHandbookAdded(),
    ]);
    if (call !== refreshCall.current) return; // a newer refresh (e.g. another team) started: it wins
    setTeams(tm);
    setStats(st);
    setImpact(im);
    setCheckIns(c);
    setAsks(a);
    setRequests(r);
    setAnalysis(an);
    setActions(ac);
    setHandbookAdded(hb);
  }, [team]);

  useEffect(() => {
    refresh();
    return api.onDataChanged(refresh); // island activity shows up live
  }, [refresh]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem("hr-theme", theme);
    } catch {}
  }, [theme]);

  // Move focus to the new page when switching tabs (screen readers hear the new heading)
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    mainRef.current?.focus();
  }, [tab]);

  const inTeam = <T extends { team: string }>(x: T) => team === "All" || x.team === team;
  // Only the team in view: a manager mustn't see another team's activity here
  const latestFeedback = [...checkIns.filter(inTeam), ...asks.filter(inTeam), ...requests.filter(inTeam)].map((x) => x.createdAt).sort().pop();
  const stale = !!analysis && !!latestFeedback && latestFeedback > analysis.generatedAt;
  const openReq = requests.filter((r) => inTeam(r) && r.status !== "resolved").length;
  const openActions = actions.filter((a) => inTeam(a) && a.status === "open").length;

  const runAnalysis = async () => {
    setAnalysing(true);
    say("Analysing this week's feedback");
    try {
      const a = await api.analyse();
      setAnalysis(a);
      const n = a.themes.filter(inTeam).length;
      say(`Analysis complete. ${n} theme${n === 1 ? "" : "s"} found.`);
    } catch {
      say("Analysis failed. Please try again.");
    } finally {
      setAnalysing(false);
    }
  };

  const createAction = async (t: Theme) => {
    await api.addAction(t.id);
    say(`Follow-up created for ${t.title}`);
  };

  const setActionStatus = async (id: string, s: Action["status"]) => {
    await api.setActionStatus(id, s);
    const n = actions.find((a) => a.id === id)?.peopleToTell ?? 0;
    say(s === "done" ? `Follow-up marked done. WorkPalz told ${n} new hire${n === 1 ? "" : "s"}; you won't see who.` : "Follow-up reopened.");
  };

  const setRequestStatus = async (id: string, s: RequestStatus) => {
    await api.setRequestStatus(id, s);
    say(`Request marked ${s.replace("_", " ")}. The employee has been notified.`);
  };

  const publishHandbook = async (input: HandbookInput) => {
    const n = await api.publishHandbook(input);
    say(`Added to the ${guideLabel(input.place)}. ${n} new hire${n === 1 ? " was" : "s were"} told their question now has an answer.`);
  };

  const ALL_NAV: { id: Tab; label: string; badge?: number; hrOnly?: boolean }[] = [
    { id: "overview", label: "Overview" },
    { id: "requests", label: "Requests", badge: openReq, hrOnly: true },
    { id: "questions", label: "Questions" },
    { id: "followups", label: "Follow-ups", badge: openActions },
    { id: "checkins", label: "Check-ins", hrOnly: true },
  ];
  const NAV = ALL_NAV.filter((n) => !managerTeam || !n.hrOnly);

  const changeViewAs = (v: string) => {
    setViewAs(v);
    const m = v.startsWith("manager:") ? v.slice("manager:".length) : null;
    if (m && ALL_NAV.find((n) => n.id === tab)?.hrOnly) setTab("overview");
    say(m ? `Manager view for ${m}. Showing team patterns only.` : "HR view");
  };

  return (
    <div className="min-h-full text-[color:var(--hr-text)]">
      <a
        href="#main"
        className="sr-only z-50 rounded-lg bg-[color:var(--hr-inverse)] px-4 py-3 font-semibold text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to content
      </a>

      {/* One compact row that stays visible: where you are (tabs) and whose view (View as / Team) */}
      <header className="sticky top-0 z-30 border-b border-[color:var(--hr-line)] bg-[color:var(--hr-surface)]">
        <div className="mx-auto flex max-w-[1320px] flex-wrap items-center gap-x-4 gap-y-2 px-6 py-2.5">
          <div className="flex items-center gap-2">
            <span aria-hidden="true" className="flex h-7 w-7 items-center justify-center rounded-[9px] bg-[color:var(--hr-inverse)]">
              <span className="h-2 w-2 rounded-full bg-[#4C8DFF]" />
            </span>
            <span className="text-[16px] font-bold">WorkPalz</span>
            <span className="rounded-full bg-[color:var(--hr-chip)] px-2 py-0.5 text-[11.5px] font-semibold text-[color:var(--hr-text3)]">
              {managerTeam ? "Manager" : "HR"}
            </span>
          </div>

          <nav aria-label="Dashboard sections" className="order-3 w-full lg:order-none lg:w-auto">
            <ul className="m-0 flex list-none flex-wrap gap-0.5 rounded-xl bg-[color:var(--hr-bg)] p-1">
              {NAV.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    aria-current={tab === n.id ? "page" : undefined}
                    onClick={() => setTab(n.id)}
                    className="flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg px-2.5 text-[13.5px] font-semibold transition"
                    style={{
                      background: tab === n.id ? "var(--hr-surface)" : "transparent",
                      color: tab === n.id ? C.blueText : "var(--hr-text3)",
                      boxShadow: tab === n.id ? "0 1px 2px rgba(16,24,40,0.08)" : undefined,
                    }}
                  >
                    {n.label}
                    {!!n.badge && (
                      <span className="rounded-full bg-[color:var(--hr-amber-bg)] px-1.5 text-[11.5px] text-[color:var(--hr-amber-fg)]">
                        {n.badge}
                        <span className="sr-only"> open</span>
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            {/* key: a new chat when switching between HR and a manager, so nothing carries over */}
            <Assistant key={viewAs} view={{ tab, team, role: managerTeam ? "manager" : "hr" }} />
            <label className="flex items-center gap-1.5 text-[12.5px]" style={{ color: C.muted }}>
              View as
              <select
                id="view-as"
                value={viewAs}
                onChange={(e) => changeViewAs(e.target.value)}
                className="min-h-9 rounded-lg border border-[color:var(--hr-input-border)] bg-[color:var(--hr-surface)] px-2.5 text-[13px] text-[color:var(--hr-text)]"
              >
                <option value="hr">HR</option>
                {teams.map((t) => (
                  <option key={t} value={`manager:${t}`}>
                    {t} manager
                  </option>
                ))}
              </select>
            </label>
            {!managerTeam && (
              <label className="flex items-center gap-1.5 text-[12.5px]" style={{ color: C.muted }}>
                Team
                <select
                  id="team"
                  value={teamFilter}
                  onChange={(e) => setTeam(e.target.value)}
                  className="min-h-9 rounded-lg border border-[color:var(--hr-input-border)] bg-[color:var(--hr-surface)] px-2.5 text-[13px] text-[color:var(--hr-text)]"
                >
                  {["All", ...teams].map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </label>
            )}
            <Button
              variant="ghost"
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              title={theme === "dark" ? "Light mode" : "Dark mode"}
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="!min-h-9 !px-2.5"
            >
              <span aria-hidden="true">{theme === "dark" ? "☀" : "☾"}</span>
            </Button>
            <Button variant="ghost" className="!min-h-9 !px-2 text-[13px]" title="Put the demo data back to the start" onClick={() => api.resetDemo().then(() => say("Demo data reset"))}>
              Reset demo
            </Button>
          </div>
        </div>
      </header>

      <main id="main" ref={mainRef} tabIndex={-1} className="mx-auto max-w-[1320px] px-6 pb-12 pt-6 outline-none">
        {managerTeam && (
          <p className="m-0 mb-5 rounded-xl bg-[color:var(--hr-blue-soft)] px-4 py-2.5 text-[13.5px]" style={{ color: C.blueText }}>
            <strong>Manager view for {managerTeam}.</strong> You see patterns for your team, never individuals: check-in notes, quotes and
            single requests stay with HR.
          </p>
        )}
        {tab === "overview" && (
          <Overview
            team={team}
            stats={stats}
            impact={impact}
            manager={!!managerTeam}
            analysis={analysis}
            actions={actions}
            analysing={analysing}
            staleAnalysis={stale}
            onAnalyse={runAnalysis}
            onCreateAction={createAction}
          />
        )}
        {tab === "requests" && <RequestsTab requests={requests.filter(inTeam)} onStatus={setRequestStatus} />}
        {tab === "questions" && (
          <QuestionsTab
            asks={asks.filter(inTeam)}
            added={handbookAdded}
            onDraft={managerTeam ? undefined : api.draftHandbook}
            onPublish={managerTeam ? undefined : publishHandbook}
          />
        )}
        {tab === "followups" && <FollowUpsTab actions={actions.filter(inTeam)} onStatus={setActionStatus} />}
        {tab === "checkins" && <CheckInsTab checkIns={checkIns.filter(inTeam)} />}
      </main>


      <div role="status" aria-live="polite" className="sr-only">
        {announce}
      </div>
    </div>
  );
}
