// HR dashboard shell: header, navigation, team filter, live data and announcements.
import { useCallback, useEffect, useRef, useState } from "react";
import type { Action, Analysis, HrAsk, HrCheckIn, HrStats, RequestStatus, SupportRequest, Theme } from "../../../shared/types";
import Overview from "./Overview";
import { CheckInsTab, FollowUpsTab, QuestionsTab, RequestsTab } from "./Tabs";
import { Button, C } from "./ui";

const api = window.workpalz;
type Tab = "overview" | "requests" | "questions" | "followups" | "checkins";

export default function HrDashboard() {
  const [tab, setTab] = useState<Tab>("overview");
  const [team, setTeam] = useState("All");
  const [teams, setTeams] = useState<string[]>([]);
  const [stats, setStats] = useState<HrStats | null>(null);
  const [checkIns, setCheckIns] = useState<HrCheckIn[]>([]);
  const [asks, setAsks] = useState<HrAsk[]>([]);
  const [requests, setRequests] = useState<SupportRequest[]>([]);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [actions, setActions] = useState<Action[]>([]);
  const [analysing, setAnalysing] = useState(false);
  const [announce, setAnnounce] = useState("");
  const mainRef = useRef<HTMLElement>(null);
  const firstRender = useRef(true);

  const say = (t: string) => {
    setAnnounce("");
    window.setTimeout(() => setAnnounce(t), 50);
  };

  const refresh = useCallback(async () => {
    const [tm, st, c, a, r, an, ac] = await Promise.all([
      api.hrTeams(),
      api.hrStats(team),
      api.hrCheckIns(),
      api.hrAsks(),
      api.hrRequests(),
      api.getLastAnalysis(),
      api.listActions(),
    ]);
    setTeams(tm);
    setStats(st);
    setCheckIns(c);
    setAsks(a);
    setRequests(r);
    setAnalysis(an);
    setActions(ac);
  }, [team]);

  useEffect(() => {
    refresh();
    return api.onDataChanged(refresh); // island activity shows up live
  }, [refresh]);

  // Move focus to the new page when switching tabs (screen readers hear the new heading)
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    mainRef.current?.focus();
  }, [tab]);

  const inTeam = <T extends { team: string }>(x: T) => team === "All" || x.team === team;
  const latestFeedback = [...checkIns.map((c) => c.createdAt), ...asks.map((a) => a.createdAt), ...requests.map((r) => r.createdAt)].sort().pop();
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
    say(s === "done" ? "Follow-up marked done. The employees who raised it have been notified." : "Follow-up reopened.");
  };

  const setRequestStatus = async (id: string, s: RequestStatus) => {
    await api.setRequestStatus(id, s);
    say(`Request marked ${s.replace("_", " ")}. The employee has been notified.`);
  };

  const NAV: { id: Tab; label: string; badge?: number }[] = [
    { id: "overview", label: "Overview" },
    { id: "requests", label: "Requests", badge: openReq },
    { id: "questions", label: "Questions" },
    { id: "followups", label: "Follow-ups", badge: openActions },
    { id: "checkins", label: "Check-ins" },
  ];

  return (
    <div className="min-h-full text-[#14161A]">
      <a
        href="#main"
        className="sr-only z-50 rounded-lg bg-[#14161A] px-4 py-3 font-semibold text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to content
      </a>

      <header className="border-b border-[#E3E6EA] bg-white">
        <div className="mx-auto flex max-w-[1240px] flex-wrap items-center gap-x-6 gap-y-3 px-6 py-3">
          <div className="flex items-center gap-2.5">
            <span aria-hidden="true" className="flex h-7 w-7 items-center justify-center rounded-[9px] bg-[#14161A]">
              <span className="h-2 w-2 rounded-full bg-[#4C8DFF]" />
            </span>
            <span className="text-[18px] font-bold">WorkPalz</span>
            <span className="rounded-full bg-[#E6E8EC] px-2.5 py-0.5 text-[12px] font-semibold text-[#3A404B]">HR</span>
          </div>

          <nav aria-label="Dashboard sections" className="order-3 w-full sm:order-none sm:w-auto">
            <ul className="m-0 flex list-none flex-wrap gap-1 p-0">
              {NAV.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    aria-current={tab === n.id ? "page" : undefined}
                    onClick={() => setTab(n.id)}
                    className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-3 text-[14px] font-semibold"
                    style={{ background: tab === n.id ? "#EEF3FF" : "transparent", color: tab === n.id ? C.blueText : "#3A404B" }}
                  >
                    {n.label}
                    {!!n.badge && (
                      <span className="rounded-full bg-[#FFE7CC] px-1.5 text-[12px] text-[#6E3600]">
                        {n.badge}
                        <span className="sr-only"> open</span>
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <label htmlFor="team" className="text-[13px]" style={{ color: C.muted }}>
              Team
            </label>
            <select
              id="team"
              value={team}
              onChange={(e) => setTeam(e.target.value)}
              className="min-h-11 rounded-lg border border-[#7F8794] bg-white px-3 text-[14px]"
            >
              {["All", ...teams].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
            <Button variant="ghost" onClick={() => api.resetDemo().then(() => say("Demo data reset"))}>
              Reset demo
            </Button>
          </div>
        </div>
      </header>

      <main id="main" ref={mainRef} tabIndex={-1} className="mx-auto max-w-[1240px] px-6 pb-14 pt-7 outline-none">
        {tab === "overview" && (
          <Overview
            team={team}
            stats={stats}
            analysis={analysis}
            actions={actions}
            analysing={analysing}
            staleAnalysis={stale}
            onAnalyse={runAnalysis}
            onCreateAction={createAction}
          />
        )}
        {tab === "requests" && <RequestsTab requests={requests.filter(inTeam)} onStatus={setRequestStatus} />}
        {tab === "questions" && <QuestionsTab asks={asks.filter(inTeam)} />}
        {tab === "followups" && <FollowUpsTab actions={actions.filter(inTeam)} onStatus={setActionStatus} />}
        {tab === "checkins" && <CheckInsTab checkIns={checkIns.filter(inTeam)} />}
      </main>

      <div role="status" aria-live="polite" className="sr-only">
        {announce}
      </div>
    </div>
  );
}
