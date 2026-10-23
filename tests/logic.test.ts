// Run with: npm test
import { beforeEach, describe, expect, it, vi } from "vitest";
import os from "node:os";
import fs from "node:fs";
import path from "node:path";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "workpalz-"));
vi.mock("electron", () => ({ app: { getPath: () => dir } }));

const { loadStore, resetStore, store } = await import("../src/main/store");
const { analyse } = await import("../src/main/ai");
const { answerQuestion } = await import("../src/main/ask");

const find = (themes: { title: string; team: string }[], title: RegExp, team: string) =>
  themes.find((t) => title.test(t.title) && t.team === team) as any;

beforeEach(() => {
  process.env.WORKPALZ_OFFLINE = "1"; // tests never call OpenAI, even with a key in .env
  loadStore();
  resetStore();
});

describe("AI themes (offline analyser)", () => {
  it("finds the seeded demo themes with trends", async () => {
    const a = await analyse();
    const tools = find(a.themes, /tools/, "Engineering");
    expect(tools.affected).toBe(3);
    expect(tools.teamSize).toBe(5);
    expect(tools.lastWeekAffected).toBe(1);
    expect(tools.severity).toBe("high");
    expect(tools.sources.request).toBeGreaterThan(0);
    expect(tools.sources.question).toBeGreaterThan(0);

    expect(find(a.themes, /priorities/, "Marketing").affected).toBe(2);
    expect(find(a.themes, /company guide/, "Marketing").affected).toBe(2);
    expect(a.themes.some((t) => t.team === "Finance")).toBe(false);
  });

  it("the live demo check-in moves Engineering from 3 to 4 of 5", async () => {
    store.addCheckIn({ employeeId: "e5", team: "Engineering", week: 2, question: "q", mood: "frustrated", note: "Still waiting on my software licences", shareName: false });
    const a = await analyse();
    expect(find(a.themes, /tools/, "Engineering").affected).toBe(4);
  });
});

describe("Ask WorkPalz", () => {
  it("answers from the company guide and says which part", async () => {
    expect((await answerQuestion("What is a Q4 OKR?")).entryId).toBe("okr");
    expect((await answerQuestion("expense form")).entryId).toBe("expense");
    const aurora = await answerQuestion("What is Project Aurora?");
    expect(aurora.entryId).toBe("aurora");
    expect(aurora.result.entry?.from).toBe("Team Glossary");
    expect((await answerQuestion("vpn setup")).result.entry?.from).toBe("IT Help Centre");
    expect((await answerQuestion("what is the notice period if I resign")).result.entry?.from).toBe("Employee Handbook");
    expect((await answerQuestion("holiday calendar")).entryId).toBe("holidays");
    expect((await answerQuestion("how do i apply for leave")).entryId).toBe("annual-leave");
  });

  it("admits when the company guide has no answer", async () => {
    const r = await answerQuestion("how do I get staging server access");
    expect(r.result.answered).toBe(false);
    expect((await answerQuestion("who approves the campaign budget")).result.answered).toBe(false);
  });
});

describe("Privacy", () => {
  it("HR views never include employee IDs or contributor IDs", async () => {
    store.setAnalysis(await analyse());
    for (const c of store.hrCheckIns()) expect(c).not.toHaveProperty("employeeId");
    for (const a of store.hrAsks()) expect(a).not.toHaveProperty("employeeId");
    for (const t of store.hrAnalysis()!.themes) expect(t).not.toHaveProperty("contributorIds");
  });

  it("names only appear when the employee opted in", () => {
    const named = store.hrCheckIns().filter((c) => c.name);
    expect(named.map((c) => c.name).sort()).toEqual(["Jun Hao Tan", "Sarah Lee", "Wei Jie Ong"]);
  });

  it("delete my data removes check-ins and questions", () => {
    store.deleteMyData("e1");
    expect(store.checkIns().some((c) => c.employeeId === "e1")).toBe(false);
    expect(store.asks().some((a) => a.employeeId === "e1")).toBe(false);
  });
});

describe("Closing the loop", () => {
  it("finishing a follow-up notifies the people who raised it", async () => {
    store.addCheckIn({ employeeId: "e5", team: "Engineering", week: 2, question: "q", mood: "frustrated", note: "waiting on licence", shareName: false });
    store.setAnalysis(await analyse());
    const theme = find(store.hrAnalysis()!.themes, /tools/, "Engineering");
    store.addAction(theme.id);
    const action = store.hrActions()[0];
    expect(store.myNotices("e5")).toHaveLength(0);
    store.setActionStatus(action.id, "done");
    expect(store.myNotices("e5")).toHaveLength(1);
    expect(store.myNotices("e4")).toHaveLength(0); // e4 never raised it
  });

  it("resolving a request notifies the requester", () => {
    store.addRequest({ employeeId: "e5", name: "Mei Ling Chew", team: "Engineering", category: "hardware", description: "Broken keyboard" });
    const r = store.myRequests("e5")[0];
    store.setRequestStatus(r.id, "resolved");
    expect(store.myNotices("e5")[0].body).toContain("Broken keyboard");
  });
});

describe("Ping a colleague", () => {
  it("a reply reaches the sender as a notice from that colleague", () => {
    const ping = store.addPing({ fromId: "e5", toId: "p1", toName: "Ahmad Zaki", message: "Got 5 minutes?" });
    store.replyToPing(ping.id, "Ahmad Zaki", "Sure, come over");
    expect(store.myPings("e5")[0].reply).toBe("Sure, come over");
    const n = store.myNotices("e5")[0];
    expect(n.from).toBe("Ahmad Zaki");
    expect(n.title).toBe("Ahmad replied");
  });

  it("pings never show up in any HR view, and are erased with my data", () => {
    store.addPing({ fromId: "e5", toId: "p3", toName: "Ravi Kumar", message: "VPN secret-ping-text" });
    const hr = JSON.stringify([store.hrCheckIns(), store.hrAsks(), store.hrRequests(), store.hrStats("All"), store.hrActions()]);
    expect(hr).not.toContain("secret-ping-text");
    store.deleteMyData("e5");
    expect(store.myPings("e5")).toHaveLength(0);
  });
});

describe("HR assistant", () => {
  it("answers offline from the dashboard data and never leaks names", async () => {
    const { askAssistant } = await import("../src/main/assistant");
    store.addCheckIn({ employeeId: "e2", team: "Engineering", week: 2, question: "q", mood: "stuck", note: "Blocked on staging", shareName: true });
    const r = await askAssistant([{ role: "user", text: "Which requests have waited longest in Engineering?" }], { tab: "requests", team: "All", role: "hr" });
    expect(r.source).toBe("offline");
    expect(r.answer).toMatch(/open request/);
    const all = await askAssistant([{ role: "user", text: "What are new hires saying this week?" }], { tab: "checkins", team: "Engineering", role: "hr" });
    for (const e of store.employees()) {
      expect(r.answer).not.toContain(e.name);
      expect(all.answer).not.toContain(e.name);
    }
  });
});

describe("Company guide gaps", () => {
  it("offline drafts leave company facts as placeholders", async () => {
    const { draftHandbookEntry } = await import("../src/main/assistant");
    const d = await draftHandbookEntry(["how do I get access to the staging server"]);
    expect(d.source).toBe("offline");
    expect(d.answer).toContain("[HR:");
    expect(d.keywords).toContain("staging");
    expect(d.place).toBe("it"); // server access is IT, not formal HR policy
    expect((await draftHandbookEntry(["what does BU mean"])).place).toBe("glossary");
  });

  it("publishing answers the gap, tells the askers, and Ask WorkPalz finds it", async () => {
    const gapIds = store.hrAsks().filter((a) => !a.answered && /staging/.test(a.question)).map((a) => a.id);
    expect(gapIds.length).toBe(2);
    const before = store.hrStats("All").unanswered;
    const told = store.publishHandbookEntry({
      title: "Staging server access",
      answer: "Request it in the IT portal under Access. Your lead approves it within a day.",
      keywords: ["staging", "staging server"],
      place: "it",
      askIds: gapIds,
    });
    expect(told).toBe(2);
    expect(store.hrStats("All").unanswered).toBe(before - 2);
    expect(store.myNotices("e2")[0].title).toBe("Your question has an answer");
    const { result } = await answerQuestion("how do I get on the staging server?");
    expect(result.answered).toBe(true);
    expect(result.entry?.title).toBe("Staging server access");
    expect(result.entry?.from).toBe("IT Help Centre");
  });
});

describe("Manager view", () => {
  it("a manager's assistant sees only their team, with no notes or request details", async () => {
    const { askAssistant } = await import("../src/main/assistant");
    const r = await askAssistant([{ role: "user", text: "Which requests have waited longest?" }], { tab: "overview", team: "Marketing", role: "manager" });
    expect(r.answer).not.toMatch(/Engineering|IDE|staging|licence/i);
    const c = await askAssistant([{ role: "user", text: "What are new hires saying this week?" }], { tab: "overview", team: "Engineering", role: "manager" });
    expect(c.answer).not.toContain("Still waiting on my IDE");
    expect(c.answer).not.toContain("staging server");
  });

  it("impact counts resolved requests and closed company guide gaps", () => {
    const m = store.hrImpact("Marketing");
    expect(m.requestsResolved).toBe(1);
    expect(m.avgDaysToResolve).toBeGreaterThan(0);
    expect(store.hrImpact("Engineering").oldestOpenDays).toBeGreaterThanOrEqual(5);
  });
});

describe("Anonymous, but you can still hear back", () => {
  it("only people who ticked 'Tell me' get the update, and HR only sees how many", async () => {
    const a = await analyse();
    store.setAnalysis(a);
    const tools = find(a.themes, /tools/, "Engineering");
    // e1 changes their mind in their latest check-in: no updates please
    store.addCheckIn({ employeeId: "e1", team: "Engineering", week: 2, question: "q", mood: "stuck", note: "Still no licence", shareName: false, notifyMe: false });
    store.addAction(tools.id);
    const action = store.hrActions()[0];
    expect(action.peopleToTell).toBe(2); // e2 and e3, not e1
    expect(JSON.stringify(store.hrActions())).not.toMatch(/"e[0-9]"/); // never who
    expect(store.setActionStatus(action.id, "done")).toBe(2);
    expect(store.myNotices("e1")).toHaveLength(0);
    expect(store.myNotices("e2")[0].title).toBe("Update on something you raised");
  });
});

describe("AI helpers on the island (offline versions)", () => {
  it("Smart Quick request picks the category and offers a guide answer first", async () => {
    const { suggestRequest } = await import("../src/main/helper");
    const vpn = await suggestRequest("my laptop won't connect to the vpn from home");
    expect(vpn.source).toBe("offline");
    expect(vpn.tip?.id).toBe("vpn");
    expect(vpn.tip?.from).toBe("IT Help Centre");
    expect(vpn.category).toBe("access");
    expect((await suggestRequest("laptop keyboard keys sticking")).category).toBe("hardware");
    expect((await suggestRequest("I need a licence for the IDE")).category).toBe("software");
    expect((await suggestRequest("half day leave on Friday")).category).toBe("leave");
  });

  it("'Who can help?' suggests the right colleague", async () => {
    const { suggestColleague } = await import("../src/main/helper");
    expect((await suggestColleague("I can't get the staging server running"))?.colleagueId).toBe("p1");
    expect((await suggestColleague("my expense claim was rejected"))?.colleagueId).toBe("p6");
    expect(await suggestColleague("zzz qqq")).toBeNull();
  });

  it("a stuck check-in gets a tip and the status of the related open request", async () => {
    const { checkInReply } = await import("../src/main/helper");
    const r = await checkInReply("e1", "Still waiting on my IDE licence", true);
    expect(r.tip?.id).toBe("software-licence");
    expect(r.openRequest?.dept).toBe("IT");
    expect(r.openRequest?.days).toBeGreaterThanOrEqual(4);
    expect(await checkInReply("e1", "Great week", false)).toEqual({ tip: null, openRequest: null });
  });

  it("'That fixed it' counts as fixed without a ticket", () => {
    store.addSolvedByGuide("Engineering", "vpn");
    expect(store.hrImpact("Engineering").solvedByGuide).toBe(1);
    expect(store.hrImpact("Marketing").solvedByGuide).toBe(0);
  });
});
