// End-to-end test: drives the real Electron app through every feature,
// takes screenshots and runs an axe-core WCAG 2.2 AA scan on each screen.
//
// Run:  npm run build && npm run test:e2e
// Output: tests/e2e/shots/*.png and a pass/fail summary.
import { _electron as electron } from "playwright-core";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const AXE = fs.readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.."); // handles spaces in the folder name
const shots = path.join(root, "tests/e2e/shots");
fs.rmSync(shots, { recursive: true, force: true });
fs.mkdirSync(shots, { recursive: true });

const results = [];
const a11y = [];
const errors = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
};

// Terminals inside VS Code set ELECTRON_RUN_AS_NODE, which would start Electron as plain Node
const { ELECTRON_RUN_AS_NODE: _runAsNode, ...env } = process.env;
const app = await electron.launch({
  args: [path.join(root, "out/main/index.js"), "--no-sandbox"],
  env: { ...env, WORKPALZ_E2E: "1", WORKPALZ_DATA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), "wp-e2e-")), WORKPALZ_OFFLINE: "1" }, // offline AI, even with a key in .env
});

const island = await app.firstWindow();
island.setDefaultTimeout(15000); // a missing button fails the run instead of hanging it
island.on("console", (m) => m.type() === "error" && errors.push(`island: ${m.text()}`));
island.on("pageerror", (e) => errors.push(`island: ${e.message}`));
await island.waitForSelector(".island-shell");
await island.waitForTimeout(800);

const hook = (fn, arg) => app.evaluate(({}, [fnName, a]) => globalThis.__workpalz[fnName](a), [fn, arg]);
const settle = (ms = 650) => island.waitForTimeout(ms);
let n = 0;
const shot = async (page, name, sel = ".island-shell") => {
  const file = `${String(++n).padStart(2, "0")}-${name}.png`;
  if (sel) await page.locator(sel).first().screenshot({ path: path.join(shots, file) });
  else await page.screenshot({ path: path.join(shots, file), fullPage: true });
  return file;
};
const axe = async (page, label) => {
  if (!(await page.evaluate(() => !!window.axe))) await page.evaluate(AXE);
  const v = await page.evaluate(async () => {
    const r = await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] } });
    return r.violations.map((x) => ({ id: x.id, impact: x.impact, help: x.help, nodes: x.nodes.length, target: x.nodes[0]?.target?.join(" ") }));
  });
  a11y.push({ screen: label, violations: v });
  check(`WCAG scan: ${label}`, v.length === 0, v.map((x) => `${x.id} ×${x.nodes}`).join(", "));
};
const openMenu = async () => {
  await island.getByRole("button", { name: /Open menu|Open WorkPalz/ }).click();
  await settle();
};

// ---------- Island ----------

// First day: the island opens itself once with a short welcome tour
await island.getByText("I'm WorkPalz").waitFor({ timeout: 5000 });
await settle(400);
await shot(island, "tour-welcome");
await axe(island, "island welcome tour");
check("First launch shows the welcome tour", true);
await island.getByRole("button", { name: "Next" }).click();
await settle(200);
check("Tour shows the open shortcut", /(Cmd|Ctrl)\+Alt\+Space/.test(await island.locator(".island-shell").innerText()));
await island.getByRole("button", { name: "Next" }).click();
await island.getByRole("button", { name: "Next" }).click();
await settle(200);
check("Tour explains anonymity and updates", (await island.locator(".island-shell").innerText()).includes("HR still won't know it was you"));
await island.getByRole("button", { name: "Got it" }).click();
await settle();

await shot(island, "pill");
check("Pill shows onboarding week", (await island.locator(".island-shell").innerText()).includes("Wk 2"));

await openMenu();
await shot(island, "menu");
await axe(island, "island menu");
check("Menu has 5 features", (await island.locator("section[aria-labelledby=menu-title] li").count()) === 5);

// Ask WorkPalz: jargon
await island.getByRole("button", { name: /Ask WorkPalz/ }).click();
await settle();
await axe(island, "island ask (empty)");
await island.locator("#ask-input").fill("What is a Q4 OKR?");
await island.keyboard.press("Enter");
await island.getByText("OKR (Objectives and Key Results)").waitFor();
await settle(300);
await shot(island, "ask-jargon");
await axe(island, "island ask (answer)");
check("Ask answers company jargon and says it's from the Team Glossary", (await island.locator(".island-shell").innerText()).includes("From the Team Glossary"));

// Ask: link
await island.locator("#ask-input").fill("expense form");
await island.keyboard.press("Enter");
await island.getByRole("button", { name: /Expense form/ }).waitFor();
await shot(island, "ask-link");
check("Ask returns a link button", true);

// Ask: not in the company guide
await island.locator("#ask-input").fill("how do I get staging server access");
await island.keyboard.press("Enter");
await island.getByText(/couldn't find that in the company guide/).waitFor();
await shot(island, "ask-not-found");
check("Ask admits when the company guide has no answer", true);

// Back button returns to the menu
await island.getByRole("button", { name: "Back to menu" }).click();
await settle();
check("Back button returns to the menu", (await island.locator("#menu-title").count()) === 1);

// Draft survives an accidental click-away
await island.getByRole("button", { name: /Ask WorkPalz/ }).click();
await settle();
await island.locator("#ask-input").fill("half-typed question");
await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find((w) => w.getTitle() === "WorkPalz").emit("blur"));
await settle();
check("Clicking into another app collapses the island", (await island.locator("#ask-input").count()) === 0);
await openMenu();
await island.getByRole("button", { name: /Ask WorkPalz/ }).click();
await settle();
check("Typed text is kept after click-away", (await island.locator("#ask-input").inputValue()) === "half-typed question");
await island.keyboard.press("Escape");
await settle();

// Quick request
await openMenu();
await island.getByRole("button", { name: /Quick request/ }).click();
await settle();
await island.getByText("Laptop or hardware").click();
await island.locator("#rq-desc").fill("Laptop keyboard keys sticking");
await shot(island, "request-form");
await axe(island, "island request");
await island.getByRole("button", { name: "Send request" }).click();
await settle(400);
await shot(island, "request-sent");
check("Request sent flash", (await island.locator(".island-shell").innerText()).includes("Request sent"));
await island.waitForTimeout(3200);

// Weekly check-in
await hook("sendIsland", { type: "checkin-prompt" });
await settle(400);
await shot(island, "checkin-prompt");
check("Check-in prompt pulses in the pill", (await island.locator(".island-shell").innerText()).includes("Weekly check-in"));
await island.getByRole("button", { name: /Weekly check-in is ready/ }).click();
await settle();
check("Question matches onboarding week 2", (await island.locator("legend").first().innerText()).includes("tools and access"));
await island.getByText("Frustrated", { exact: true }).click();
await island.locator("#ci-note").fill("Still waiting on my software licence");
check("Check-in offers 'Tell me if HR acts on this', ticked by default", await island.getByLabel(/Tell me if HR acts on this/).isChecked());
await shot(island, "checkin-form");
await axe(island, "island check-in");
await island.getByRole("button", { name: "Send", exact: true }).click();
await settle(400);
await shot(island, "checkin-sent");
await island.waitForTimeout(3200);

// Focus timer
await openMenu();
await island.getByRole("button", { name: /Focus timer/ }).click();
await island.waitForTimeout(1500);
await shot(island, "focus-timer");
check("Focus timer counts down in the pill", /24:5\d/.test(await island.locator(".island-shell").innerText()));
await island.getByRole("button", { name: /Focus timer, 25 minutes left|Focus timer, 24 minutes left/ }).click();
await settle();
await island.getByRole("button", { name: /Stop focus/ }).click();
await settle();

// Ping a colleague: search by topic, send, get a (demo) reply
await openMenu();
await island.getByRole("button", { name: /Ping a colleague/ }).click();
await settle();
await shot(island, "ping-search");
await axe(island, "island ping (search)");
await island.locator("#ping-search").fill("vpn");
await settle(200);
check("Ping search by topic finds IT", (await island.locator("ul[aria-label=Colleagues] li").count()) === 1);
await island.getByRole("button", { name: /Ravi Kumar/ }).click();
await settle();
await island.getByRole("button", { name: "Got 5 minutes to help me?" }).click();
await shot(island, "ping-compose");
await axe(island, "island ping (compose)");
await island.getByRole("button", { name: "Ping Ravi" }).click();
await settle(400);
check("Ping sent flash", (await island.locator(".island-shell").innerText()).includes("Pinged Ravi"));
await island.getByText("Ravi replied").first().waitFor({ timeout: 10000 });
await settle(500);
await shot(island, "ping-reply");
check("Colleague's reply pops up on the island", true);
await island.getByRole("button", { name: /Got it|Next/ }).click();
await settle();

// Idle: the pill shrinks to a small dot instead of disappearing; hovering brings it back
await island.mouse.move(5, 600); // nobody is pointing at it
await settle(300);
const fullWidth = (await island.locator(".island-shell").boundingBox()).width;
await hook("sendIsland", { type: "idle" });
await settle(700);
const miniBox = await island.locator(".island-shell").boundingBox();
await shot(island, "mini-pill");
// No notch: a 56 px dot. MacBook notch: just wider than the notch, so the dot shows beside it.
check("Idle pill shrinks to a small dot", miniBox.width <= fullWidth - 150, `${Math.round(fullWidth)} → ${Math.round(miniBox.width)} px`);
await island.mouse.move(miniBox.x + miniBox.width / 2, miniBox.y + miniBox.height / 2);
await settle(700);
check("Hovering the dot brings the full pill back", (await island.locator(".island-shell").boundingBox()).width === fullWidth);
await island.mouse.move(5, 600);

// Quiet: nothing pops up, the tray icon counts what's waiting
await openMenu();
await island.getByRole("button", { name: "Hide", exact: true }).click();
await settle();
await shot(island, "step-back");
await axe(island, "island step back");
await island.getByRole("button", { name: /Quiet for 1 hour/ }).click();
await settle(400);
check("Quiet says until when", /Quiet until/.test(await island.locator(".island-shell").innerText()));
await island.waitForTimeout(2800);
check("Quiet steps the island back", (await hook("trayStatus")).quietUntil > Date.now());
await hook("sendIsland", { type: "checkin-prompt" });
await settle(500);
check("During Quiet nothing pops up, the tray counts it", (await hook("trayStatus")).attention === 1 && (await island.locator(".island-shell").evaluate((el) => getComputedStyle(el.parentElement).opacity)) === "0");
await hook("sendIsland", { type: "quiet", until: "off" });
await settle(600);
check("Turning Quiet off brings it back with the check-in waiting", (await island.locator(".island-shell").innerText()).includes("Weekly check-in"));
await hook("sendIsland", { type: "collapse" }); // clears the demo check-in prompt again
await settle(1500); // closing hands focus back to the OS; let that settle before the next click

// Hide for now: a small bar stays at the top and brings it back
await openMenu();
await island.getByRole("button", { name: "Hide", exact: true }).click();
await settle();
await island.getByRole("button", { name: /Hide for now/ }).click();
await settle(400);
check("Hide shows how to bring it back", /to show|Show it from/.test(await island.locator(".island-shell").innerText()));
await island.getByRole("button", { name: "Show WorkPalz" }).waitFor({ timeout: 4000 });
await settle(500);
await shot(island, "hidden-bar", null);
check("Hidden island leaves a bar to click", true);
await island.getByRole("button", { name: "Show WorkPalz" }).click();
await settle();
check("Clicking the bar brings the island back", (await island.getByRole("button", { name: "Show WorkPalz" }).count()) === 0);

// Privacy
await openMenu();
await island.getByRole("button", { name: "Your privacy" }).click();
await settle();
await shot(island, "privacy");
await axe(island, "island privacy");
const stored = await island.getByText(/Stored now:/).innerText();
check("Privacy shows stored counts, pings included", stored.includes("1 check-in,") && stored.includes("1 ping"));
await island.keyboard.press("Escape");
await settle();
check("Esc collapses the island", (await island.locator(".island-shell").innerText()).includes("WorkPalz"));

// Keyboard: global shortcut opens the island and moves focus inside
await settle(1000); // Esc just handed focus back to the OS; let that settle first
await island.bringToFront();
await hook("sendIsland", { type: "open" });
await settle(800);
const focused = await island.evaluate(() => document.activeElement?.textContent ?? "");
check("Keyboard open moves focus to first option", focused.includes("Ask WorkPalz"), `focused: "${focused.trim().slice(0, 40)}"`);
await island.keyboard.press("Tab");
const next = await island.evaluate(() => document.activeElement?.textContent ?? "");
check("Tab moves to the next option", next.includes("Quick request"));
await island.keyboard.press("Escape");
await settle();

// Click-through: the see-through island window must never block clicks to the apps below it
const interactive = () => hook("isIslandInteractive");
await island.mouse.move(5, 600); // empty area, well away from the island
await hook("sendIsland", { type: "open" }); // opened by keyboard, the pointer is elsewhere
await settle(800);
check("Opened by keyboard: the empty area still lets clicks through", (await interactive()) === false);
const box = await island.locator(".island-shell").boundingBox();
await island.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
await settle(200);
check("Pointer on the island: it catches clicks", (await interactive()) === true);
await island.mouse.move(5, 600);
await settle(200);
check("Pointer off the island: clicks go through again", (await interactive()) === false);
await island.mouse.move(box.x + box.width / 2, box.y + 20);
await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find((w) => w.getTitle() === "WorkPalz").emit("blur"));
await island.mouse.move(5, 600);
await settle(800);
check("Closed by clicking another app: clicks go through", (await interactive()) === false);

// Moving the mouse off the island while typing must not close it
await openMenu();
await island.getByRole("button", { name: /Ask WorkPalz/ }).click();
await settle();
await island.locator("#ask-input").fill("typing a question");
const blursBefore = await hook("blurCount");
await island.mouse.move(5, 600);
await settle(1200);
check("Mouse drifting off the island doesn't close it", (await hook("blurCount")) === blursBefore && (await island.locator("#ask-input").count()) === 1, `blurs: ${blursBefore} → ${await hook("blurCount")}`);
await island.keyboard.press("Escape");
await settle(1000);

// ---------- HR dashboard ----------

const hrPromise = app.waitForEvent("window");
await hook("openHrDashboard");
const hr = await hrPromise;
hr.setDefaultTimeout(15000);
hr.on("console", (m) => m.type() === "error" && errors.push(`hr: ${m.text()}`));
hr.on("pageerror", (e) => errors.push(`hr: ${e.message}`));
await hr.waitForSelector("main#main");
await hr.addStyleTag({ content: "html.hr, html.hr body, html.hr #root { height:auto !important; overflow:visible !important; }" });
await hr.setViewportSize({ width: 1320, height: 880 });
await hr.waitForTimeout(500);
check("HR window title", (await hr.title()) === "WorkPalz · HR Dashboard");

await shot(hr, "hr-overview-before", null);
await axe(hr, "HR overview (before analysis)");

await hr.getByRole("button", { name: "Analyse this week" }).click();
await hr.getByText("Waiting on tools, licences or access").first().waitFor();
await hr.waitForTimeout(400);
await shot(hr, "hr-overview-themes", null);
check("Response rate is 9 of 10 after the live check-in", (await hr.locator("main").innerText()).includes("10 of 10") === false);
await axe(hr, "HR overview (themes)");
const overview = await hr.locator("main").innerText();
check("Engineering theme is 4 of 5 after the live check-in", overview.includes("4 of 5 Engineering new hires"));
check("Trend shown vs last week", /Up from 1 last week/.test(overview));
check("Marketing themes found", overview.includes("Unclear priorities") && overview.includes("Questions the company guide can't answer"));

// Follow-up → close the loop
await hr.getByRole("button", { name: /Create follow-up for Waiting on tools, licences or access, Engineering/ }).click();
await hr.waitForTimeout(300);
await hr.getByRole("button", { name: /^Follow-ups/ }).click();
await hr.waitForTimeout(300);
await shot(hr, "hr-followups", null);
await axe(hr, "HR follow-ups");
check("HR sees how many will be told, never who", /will tell \d+ new hires?, you won't see who/.test(await hr.locator("main").innerText()));
await hr.getByRole("checkbox").first().check();
await island.getByText("Update on something you raised").waitFor({ timeout: 4000 });
await settle(500);
await shot(island, "island-update-from-hr");
check("The update says HR doesn't know who received it", (await island.locator(".island-shell").innerText()).includes("HR doesn't know who received it"));
check("Island expands with an update when HR finishes the follow-up", true);
await axe(island, "island notice");
await island.getByRole("button", { name: /Got it|Next/ }).click();
await settle();

// Requests → status update notifies the employee
await hr.getByRole("button", { name: /^Requests/ }).click();
await hr.waitForTimeout(300);
await shot(hr, "hr-requests", null);
await axe(hr, "HR requests");
await hr.getByLabel("Status for Mei Ling Chew's request").selectOption("resolved");
await island.getByText("Request resolved").waitFor({ timeout: 4000 });
await settle(500);
await shot(island, "island-request-resolved");
check("Island tells the employee their request was resolved", true);
await island.getByRole("button", { name: /Got it|Next/ }).click();
await settle();

await hr.getByRole("button", { name: /^Questions/ }).click();
await hr.waitForTimeout(300);
await shot(hr, "hr-questions", null);
await axe(hr, "HR questions");
const q = await hr.locator("main").innerText();
check("Similar unanswered questions are grouped (staging access asked 3×)", /staging server[\s\S]{0,80}Asked 3×/.test(q));

// Fill the gap: AI draft (offline here), HR fills in the placeholder, publishes, the askers hear about it
const stagingGap = hr.locator("li", { hasText: "Asked 3×" });
await stagingGap.getByRole("button", { name: /Draft answer with AI/ }).click();
await hr.getByRole("button", { name: "Draft it" }).click();
await hr.getByLabel("Answer new hires will see").waitFor();
check("The AI suggests the right place: IT Help Centre for server access", await hr.getByRole("radio", { name: /IT Help Centre/ }).isChecked());
check("Publish is locked while [HR: …] placeholders remain", await hr.getByRole("button", { name: /^Publish to/ }).isDisabled());
await shot(hr, "hr-guide-draft", null);
await axe(hr, "HR company guide draft");
await hr.getByLabel("Answer new hires will see").fill("Ask your team lead to approve staging access in the IT portal under Access. It's usually ready the same day.");
await hr.getByRole("button", { name: "Publish to IT Help Centre" }).click();
await island.getByText("Your question has an answer").first().waitFor({ timeout: 4000 });
await settle(500);
await shot(island, "island-question-answered");
check("The new hire who asked is told the IT Help Centre now answers it", (await island.locator(".island-shell").innerText()).includes("IT Help Centre now covers it"));
await island.getByRole("button", { name: /Got it|Next/ }).click();
await settle();
await hr.waitForTimeout(300);
check("Published entry is listed under Added by HR", (await hr.locator("main").innerText()).includes("Added by HR"));

await hr.getByRole("button", { name: /^Check-ins/ }).click();
await hr.waitForTimeout(300);
await shot(hr, "hr-checkins", null);
await axe(hr, "HR check-ins");
const ci = await hr.locator("main").innerText();
check("Live check-in is anonymous to HR", ci.includes("Engineering new hire") && !ci.includes("Mei Ling"));

// Team filter
await hr.getByRole("button", { name: "Overview" }).click();
await hr.getByLabel("Team").selectOption("Marketing");
await hr.waitForTimeout(400);
const mk = await hr.locator("main").innerText();
check("Team filter shows only Marketing themes", !mk.includes("4 of 5 Engineering") && mk.includes("Marketing"));
check("Impact section is shown", mk.includes("Impact") && mk.includes("Company guide gaps closed"));
await hr.getByLabel("Team").selectOption("All");

// Ask AI: the assistant on every page (offline answers here)
await hr.getByRole("button", { name: "Ask AI" }).click();
await hr.getByRole("dialog", { name: "WorkPalz AI assistant" }).waitFor();
await hr.getByRole("button", { name: "Which team needs help most this week?" }).click();
await hr.getByText(/Offline mode/).first().waitFor({ timeout: 5000 });
await shot(hr, "hr-ask-ai", null);
await axe(hr, "HR Ask AI");
const chat = await hr.getByRole("dialog").innerText();
check("Ask AI answers from the dashboard data", /new hires checked in/.test(chat));
check("Ask AI never shows names", !/Mei Ling|Aisyah|Jun Hao|Priya/.test(chat));
await hr.keyboard.press("Escape");

// Manager view: own team, patterns only
await hr.getByLabel("View as").selectOption({ label: "Engineering manager" });
await hr.waitForTimeout(400);
const mgr = await hr.locator("body").innerText();
await shot(hr, "hr-manager-view", null);
await axe(hr, "HR manager view");
check("Manager can't open Requests or Check-ins", (await hr.getByRole("button", { name: /^Requests/ }).count()) === 0 && (await hr.getByRole("button", { name: /^Check-ins/ }).count()) === 0);
check("Manager sees no quotes", !mgr.includes("What they said") && mgr.includes("Quotes stay with HR"));
check("Manager sees only their team", !mgr.includes("Marketing new hires"));
await hr.getByLabel("View as").selectOption("hr");
await hr.waitForTimeout(300);

// Dark mode
await hr.getByRole("button", { name: "Switch to dark mode" }).click();
await hr.waitForTimeout(300);
check("Dark mode toggle", (await hr.evaluate(() => document.documentElement.dataset.theme)) === "dark");
await shot(hr, "hr-dark", null);
await axe(hr, "HR overview (dark)");
await hr.getByRole("button", { name: "Switch to light mode" }).click();

// ---------- Summary ----------

check("No console errors", errors.length === 0, errors.slice(0, 3).join(" | "));
await app.close();

fs.writeFileSync(path.join(shots, "results.json"), JSON.stringify({ results, a11y, errors }, null, 2));
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
