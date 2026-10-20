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
  delete process.env.GEMINI_API_KEY;
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
    expect(find(a.themes, /handbook/, "Marketing").affected).toBe(2);
    expect(a.themes.some((t) => t.team === "Finance")).toBe(false);
  });

  it("the live demo check-in moves Engineering from 3 to 4 of 5", async () => {
    store.addCheckIn({ employeeId: "e5", team: "Engineering", week: 2, question: "q", mood: "frustrated", note: "Still waiting on my software licences", shareName: false });
    const a = await analyse();
    expect(find(a.themes, /tools/, "Engineering").affected).toBe(4);
  });
});

describe("Ask WorkPalz", () => {
  it("answers jargon and links from the handbook", async () => {
    expect((await answerQuestion("What is a Q4 OKR?")).entryId).toBe("okr");
    expect((await answerQuestion("expense form")).entryId).toBe("expense");
    expect((await answerQuestion("What does LGTM mean?")).entryId).toBe("lgtm");
    expect((await answerQuestion("holiday calendar")).entryId).toBe("holidays");
    expect((await answerQuestion("how do i apply for leave")).entryId).toBe("annual-leave");
  });

  it("admits when the handbook has no answer", async () => {
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

describe("Handbook gaps", () => {
  it("offline drafts leave company facts as placeholders", async () => {
    const { draftHandbookEntry } = await import("../src/main/assistant");
    const d = await draftHandbookEntry(["how do I get access to the staging server"]);
    expect(d.source).toBe("offline");
    expect(d.answer).toContain("[HR:");
    expect(d.keywords).toContain("staging");
  });

  it("publishing answers the gap, tells the askers, and Ask WorkPalz finds it", async () => {
    const gapIds = store.hrAsks().filter((a) => !a.answered && /staging/.test(a.question)).map((a) => a.id);
    expect(gapIds.length).toBe(2);
    const before = store.hrStats("All").unanswered;
    const told = store.publishHandbookEntry({
      title: "Staging server access",
      answer: "Request it in the IT portal under Access. Your lead approves it within a day.",
      keywords: ["staging", "staging server"],
      askIds: gapIds,
    });
    expect(told).toBe(2);
    expect(store.hrStats("All").unanswered).toBe(before - 2);
    expect(store.myNotices("e2")[0].title).toBe("Your question has an answer");
    const { result } = await answerQuestion("how do I get on the staging server?");
    expect(result.answered).toBe(true);
    expect(result.entry?.title).toBe("Staging server access");
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

  it("impact counts resolved requests and closed handbook gaps", () => {
    const m = store.hrImpact("Marketing");
    expect(m.requestsResolved).toBe(1);
    expect(m.avgDaysToResolve).toBeGreaterThan(0);
    expect(store.hrImpact("Engineering").oldestOpenDays).toBeGreaterThanOrEqual(5);
  });
});
