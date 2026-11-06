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

// Answers as the island would save them
const NOT_YET = { answer: "not-yet", answerLabel: "Not yet", signal: "struggling" } as const;
const YES = { answer: "yes", answerLabel: "Yes", signal: "good" } as const;

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
    store.addCheckIn({ employeeId: "e5", team: "Engineering", week: 2, question: "q", ...NOT_YET, note: "Still waiting on my software licences", shareName: false });
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
    store.addCheckIn({ employeeId: "e5", team: "Engineering", week: 2, question: "q", ...NOT_YET, note: "waiting on licence", shareName: false });
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
    store.addCheckIn({ employeeId: "e2", team: "Engineering", week: 2, question: "q", ...NOT_YET, note: "Blocked on staging", shareName: true });
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
    store.addCheckIn({ employeeId: "e1", team: "Engineering", week: 2, question: "q", ...NOT_YET, note: "Still no licence", shareName: false, notifyMe: false });
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
    // Inside Quick request: no "use Quick request" tip, just where it goes
    const broken = await suggestRequest("the laptop broken", { selfHelpOnly: true });
    expect(broken.category).toBe("hardware");
    expect(broken.tip).toBeNull();
    expect((await suggestRequest("I need an IDE licence", { selfHelpOnly: true })).tip).toBeNull();
    expect((await suggestRequest("vpn not working", { selfHelpOnly: true })).tip?.id).toBe("vpn");
    // "IT ticket" with no problem: goes to IT, and asks what's wrong
    const vague = await suggestRequest("I want to submit IT ticket", { selfHelpOnly: true });
    expect(vague.category).toBe("it-other");
    expect(vague.askMore).toMatch(/What isn't working/);
    expect((await suggestRequest("my outlook keeps crashing", { selfHelpOnly: true })).askMore).toBeNull();
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
    expect(r.openRequest?.days).toBeGreaterThanOrEqual(3); // seeded "4 days ago at 10 am": 3 full days before 10 am
    expect(await checkInReply("e1", "Great week", false)).toEqual({ tip: null, openRequest: null });
  });

  it("'That fixed it' counts as fixed without a ticket", () => {
    store.addSolvedByGuide("Engineering", "vpn");
    expect(store.hrImpact("Engineering").solvedByGuide).toBe(1);
    expect(store.hrImpact("Marketing").solvedByGuide).toBe(0);
  });
});

describe("Fixes from the code review", () => {
  it("HR never gets employee IDs or the 'tell me' choice", () => {
    expect(JSON.stringify(store.hrRequests())).not.toMatch(/employeeId/);
    store.addCheckIn({ employeeId: "e2", team: "Engineering", week: 2, question: "q", ...NOT_YET, note: "x", shareName: true, notifyMe: false });
    expect(JSON.stringify(store.hrCheckIns())).not.toMatch(/notifyMe|employeeId/);
  });

  it("Re-analyse can't create the same follow-up twice", async () => {
    store.setAnalysis(await analyse());
    const t = store.hrAnalysis()!.themes[0];
    store.addAction(t.id);
    store.setAnalysis(await analyse()); // HR presses Re-analyse
    const again = store.hrAnalysis()!.themes.find((x) => x.title === t.title && x.team === t.team)!;
    expect(again.id).toBe(t.id); // same theme, same id
    store.addAction(again.id);
    expect(store.hrActions()).toHaveLength(1);
  });

  it("who gets told is fixed when the follow-up is created", async () => {
    const a = await analyse();
    store.setAnalysis(a);
    const tools = find(a.themes, /tools/, "Engineering");
    store.addAction(tools.id);
    const before = store.hrActions()[0].peopleToTell;
    // e2 later says "no updates" on an unrelated check-in: this follow-up still tells them
    store.addCheckIn({ employeeId: "e2", team: "Engineering", week: 2, question: "q", ...YES, note: "", shareName: false, notifyMe: false });
    expect(store.hrActions()[0].peopleToTell).toBe(before);
  });

  it("reopening a request says 'open', not 'in progress'", () => {
    const r = store.requests().find((x) => x.employeeId === "e2")!;
    store.setRequestStatus(r.id, "open");
    expect(store.myNotices("e2")[0].body).toMatch(/is now open\./);
  });

  it("'Delete my data' removes AI themes that could quote them", async () => {
    store.setAnalysis(await analyse());
    store.deleteMyData("e1"); // e1 contributed to the Engineering theme
    expect(store.hrAnalysis()).toBeNull();
  });

  it("a manager view can never fall back to full HR data", async () => {
    const { askAssistant } = await import("../src/main/assistant");
    const r = await askAssistant([{ role: "user", text: "Which requests have waited longest?" }], { tab: "overview", team: "Marketing", role: "boss" as never });
    expect(r.answer).not.toMatch(/Engineering|IDE|staging/i);
    const all = await askAssistant([{ role: "user", text: "Summarise this week" }], { tab: "overview", team: "All", role: "manager" });
    expect(all.answer).toMatch(/no data for this team/);
  });
});

describe("Weekly check-in", () => {
  it("checking in again the same week changes the answer instead of adding one", () => {
    const base = { employeeId: "e5", team: "Engineering", week: 2, question: "q", note: "", shareName: false, notifyMe: true };
    const before = store.checkIns().length;
    expect(store.saveMyCheckIn({ ...base, ...NOT_YET }).updated).toBe(false);
    expect(store.saveMyCheckIn({ ...base, ...YES, note: "Sorted now" }).updated).toBe(true);
    expect(store.checkIns().length).toBe(before + 1);
    expect(store.myCheckInThisWeek("e5")?.answer).toBe("yes");
  });
});

describe("Check-in questions HR sets", () => {
  it("asks about belonging from week 3, not only at the end", () => {
    expect(store.questionFor(3).id).toBe("belonging");
    expect(store.questionFor(2).id).toBe("tools");
  });

  it("saves clean questions only: one question per week, real weeks, real text", () => {
    store.setQuestions([
      { id: "a", text: "  First   question ", weeks: [2, 1, 1, 13, 0, 2.5] },
      { id: "a", text: "Second", weeks: [2, 3] }, // week 2 is already taken; duplicate id gets a new one
    ]);
    const [a, b] = store.questions();
    expect(a).toEqual({ id: "a", text: "First question", weeks: [1, 2], answerSetId: "mood" }); // unknown choices: the first set
    expect(b.weeks).toEqual([3]);
    expect(b.id).not.toBe("a");
    expect(() => store.setQuestions([{ id: "x", text: "   ", weeks: [1] }])).toThrow();
    expect(() => store.setQuestions("nope")).toThrow();
  });

  it("a week without a question gets the general one", () => {
    store.setQuestions([{ id: "tools", text: "Tools?", weeks: [1] }]);
    expect(store.questionFor(5).text).toBe("How is your week going?");
  });

  it("stats count answers per question, by team, with no IDs or notes", () => {
    store.setQuestions([{ id: "belonging", text: "Do you feel part of the team?", weeks: [2] }]);
    const q = store.questionFor(2);
    const before = store.hrQuestionStats("All").find((s) => s.id === "belonging")!;
    store.saveMyCheckIn({ employeeId: "e5", team: "Engineering", week: 2, question: q.text, questionId: q.id, ...NOT_YET, note: "Don't know anyone yet", shareName: false, notifyMe: true });
    const all = store.hrQuestionStats("All").find((s) => s.id === "belonging")!;
    expect(all.answers).toBe(before.answers + 1);
    expect(all.thisWeek).toBe(before.thisWeek + 1);
    expect(all.struggling).toBe(before.struggling + 1);
    expect(all.hardestTeam?.team).toBe("Engineering");
    expect(JSON.stringify(store.hrQuestionStats("All"))).not.toMatch(/e5|Don't know anyone/);
    expect(store.hrQuestionStats("Finance").find((s) => s.id === "belonging")!.thisWeek).toBe(0);
  });
});

describe("Answer choices HR sets", () => {
  it("each default question has choices that fit it", () => {
    expect(store.prompt(2).choices.map((c) => c.label)).toEqual(["Yes", "Somewhat", "Not yet"]);
    expect(store.prompt(4).choices).toHaveLength(5); // priorities: 1 to 5
  });

  it("saves clean sets only: a name, 2 to 6 worded choices, each with a meaning", () => {
    const sets = store.answerSets();
    store.setAnswerSets([...sets, { id: "x", name: " Team  feel ", choices: [{ id: "a", label: "Close", signal: "good" }, { id: "a", label: "Distant", signal: "bogus" }] }]);
    const x = store.answerSets().find((a) => a.id === "x")!;
    expect(x.name).toBe("Team feel");
    expect(x.choices[1].signal).toBe("okay"); // unknown meaning: Okay
    expect(x.choices[1].id).not.toBe("a"); // duplicate choice id gets a new one
    const one = [{ id: "c", label: "Only", signal: "good" }];
    expect(() => store.setAnswerSets([...sets, { id: "y", name: "Too few", choices: one }])).toThrow();
    expect(() => store.setAnswerSets([...sets, { id: "y", name: "", choices: x.choices }])).toThrow();
    expect(() => store.setAnswerSets([])).toThrow();
  });

  it("a set a question uses can't be removed", () => {
    expect(() => store.setAnswerSets(store.answerSets().filter((a) => a.id !== "yes-somewhat"))).toThrow(/still uses/);
    store.setAnswerSets(store.answerSets().filter((a) => a.id !== "mood")); // no default question uses Mood
    expect(store.answerSets().some((a) => a.id === "mood")).toBe(false);
  });

  it("what a choice means drives the themes, whatever it's called", async () => {
    // HR renames "Not yet" to "Nope": a struggling answer still counts as one
    store.setAnswerSets(store.answerSets().map((a) => (a.id === "yes-somewhat" ? { ...a, choices: a.choices.map((c) => (c.id === "not-yet" ? { ...c, label: "Nope" } : c)) } : a)));
    store.saveMyCheckIn({ employeeId: "e5", team: "Engineering", week: 2, question: "q", questionId: "tools", answer: "not-yet", answerLabel: "Nope", signal: "struggling", note: "Still waiting on my software licences", shareName: false, notifyMe: true });
    const tools = find((await analyse()).themes, /tools/, "Engineering");
    expect(tools.affected).toBe(4);
    expect(store.hrStats("Engineering").negative).toBe(4);
  });

  it("past answers keep the wording they had after HR edits the choices", () => {
    store.setAnswerSets(store.answerSets().map((a) => (a.id === "yes-somewhat" ? { ...a, choices: a.choices.filter((c) => c.id !== "somewhat") } : a)));
    const tools = store.hrQuestionStats("All").find((q) => q.id === "tools")!;
    const earlier = tools.choiceCounts.find((c) => !c.current);
    expect(earlier).toMatchObject({ label: "Somewhat", signal: "okay", count: 1 });
    expect(tools.choiceCounts.find((c) => c.id === "not-yet")!.count).toBe(4);
  });
});

describe("Saved data from before answer choices", () => {
  it("turns old mood check-ins into answers and gives old questions their choices", () => {
    const file = path.join(dir, "workpalz-data.json");
    const old = JSON.parse(fs.readFileSync(file, "utf8"));
    delete old.answerSets;
    for (const q of old.questions) delete q.answerSetId;
    old.checkIns = [{ id: "old", employeeId: "e5", team: "Engineering", week: 2, question: "q", mood: "overloaded", note: "", shareName: false, createdAt: new Date().toISOString() }];
    fs.writeFileSync(file, JSON.stringify(old));
    loadStore();
    expect(store.checkIns()[0]).toMatchObject({ answer: "overloaded", answerLabel: "Overloaded", signal: "struggling" });
    expect("mood" in store.checkIns()[0]).toBe(false);
    expect(store.questions().find((q) => q.id === "belonging")!.answerSetId).toBe("yes-somewhat");
    expect(store.answerSets().length).toBe(3);
  });
});

describe('"Did this help?" after a follow-up', () => {
  // The Engineering tools follow-up, marked done: who was told is who gets asked
  const doneFollowUp = async () => {
    store.setAnalysis(await analyse());
    const t = store.internalAnalysis()!.themes.find((x) => /tools/.test(x.title) && x.team === "Engineering")!;
    store.addAction(t.id);
    const id = store.hrActions()[0].id;
    store.setActionStatus(id, "done");
    return { id, told: t.contributorIds };
  };

  it("asks only the people who were told, and only once the fix is done", async () => {
    store.setAnalysis(await analyse());
    const t = store.internalAnalysis()!.themes.find((x) => /tools/.test(x.title) && x.team === "Engineering")!;
    store.addAction(t.id);
    expect(store.myFixCheck(t.contributorIds[0])).toBeNull(); // not done yet
    store.setActionStatus(store.hrActions()[0].id, "done");
    expect(store.myFixCheck(t.contributorIds[0])?.attempt).toBe(1);
    expect(store.myFixCheck("f1")).toBeNull(); // Finance wasn't told
  });

  it("half or more saying it didn't help puts it back on HR's list, with anonymous reasons", async () => {
    const { id, told } = await doneFollowUp();
    store.answerFix(told[0], { actionId: id, helped: true });
    expect(store.hrActions()[0].status).toBe("done");
    store.answerFix(told[1], { actionId: id, helped: false, reason: "still", note: "Licence still pending" });
    const a = store.hrActions()[0];
    expect(a.status).toBe("retry");
    expect(a.results).toMatchObject({ helped: 1, notReally: 1, waiting: told.length - 2, reasons: [{ reason: "still", note: "Licence still pending" }] });
    expect(store.myFixCheck(told[2])).toBeNull(); // nobody is asked about a fix that's back on the list
    expect(() => store.answerFix(told[0], { actionId: id, helped: true })).toThrow(); // and nobody answers twice
    expect(JSON.stringify(store.hrActions())).not.toMatch(/employeeId|answers|notifyIds|contributorIds/);
  });

  it("the second try asks again; if it still didn't help, WorkPalz stops and offers a person", async () => {
    const { id, told } = await doneFollowUp();
    store.answerFix(told[0], { actionId: id, helped: false, reason: "not-reached" });
    store.setActionStatus(id, "done", "IT lead approves licences the same day"); // HR tries something different
    expect(store.hrActions()[0]).toMatchObject({ attempt: 2, action: "IT lead approves licences the same day" });
    expect(store.myNotices(told[0]).some((n) => n.title === "HR tried again" && n.body.includes("IT lead approves licences"))).toBe(true);
    expect(store.myFixCheck(told[0])?.attempt).toBe(2);
    store.answerFix(told[0], { actionId: id, helped: false, reason: "still" });
    expect(store.hrActions()[0].status).toBe("stuck");
    expect(store.myNotices(told[1]).some((n) => /talk to someone/.test(n.title))).toBe(true);
    expect(store.myFixCheck(told[1])).toBeNull(); // no more asking
  });

  it("Impact counts the fixes new hires said helped", async () => {
    const { id, told } = await doneFollowUp();
    expect(store.hrImpact("All").fixesWorked).toEqual({ worked: 0, checked: 0 });
    store.answerFix(told[0], { actionId: id, helped: true });
    expect(store.hrImpact("All").fixesWorked).toEqual({ worked: 1, checked: 1 });
    store.answerFix(told[1], { actionId: id, helped: false });
    expect(store.hrImpact("All").fixesWorked).toEqual({ worked: 0, checked: 1 });
  });

  it('"Delete my data" removes their answers too', async () => {
    const { id, told } = await doneFollowUp();
    store.answerFix(told[0], { actionId: id, helped: false, reason: "other", note: "mine" });
    store.deleteMyData(told[0]);
    expect(store.hrActions()[0].results?.notReally).toBe(0);
  });
});

describe("AI theme text", () => {
  it("never shows the private person codes", async () => {
    const { noCodes } = await import("../src/main/ai");
    expect(noCodes("Document the priority, then review them with P4 and P5 this week.")).toBe("Document the priority, then review them this week.");
    expect(noCodes("Three people (P1, P2, P3) are blocked.")).toBe("Three people are blocked.");
    expect(noCodes("P2 has no laptop")).toBe("a new hire has no laptop");
    expect(noCodes("Waiting on tools, licences or access")).toBe("Waiting on tools, licences or access");
  });
});
