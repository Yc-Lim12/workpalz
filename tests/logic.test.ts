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
