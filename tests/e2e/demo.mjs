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

const require = createRequire(import.meta.url);
const AXE = fs.readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
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

const app = await electron.launch({
  args: [path.join(root, "out/main/index.js"), "--no-sandbox"],
  env: { ...process.env, WORKPALZ_E2E: "1", WORKPALZ_DATA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), "wp-e2e-")), GEMINI_API_KEY: "" },
});

const island = await app.firstWindow();
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

await shot(island, "pill");
check("Pill shows onboarding week", (await island.locator(".island-shell").innerText()).includes("Wk 2"));

await openMenu();
await shot(island, "menu");
await axe(island, "island menu");
check("Menu has 4 features", (await island.locator("section[aria-labelledby=menu-title] li").count()) === 4);

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
check("Ask answers jargon from handbook", true);

// Ask: link
await island.locator("#ask-input").fill("expense form");
await island.keyboard.press("Enter");
await island.getByRole("button", { name: /Expense form/ }).waitFor();
await shot(island, "ask-link");
check("Ask returns a link button", true);

// Ask: not in handbook
await island.locator("#ask-input").fill("how do I get staging server access");
await island.keyboard.press("Enter");
await island.getByText(/couldn't find that in the handbook/).waitFor();
await shot(island, "ask-not-found");
check("Ask admits when the handbook has no answer", true);

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
check("Question matches onboarding week 2", (await island.locator("legend").innerText()).includes("tools and access"));
await island.getByText("Frustrated", { exact: true }).click();
await island.locator("#ci-note").fill("Still waiting on my software licence");
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

// Privacy
await openMenu();
await island.getByRole("button", { name: "Your privacy" }).click();
await settle();
await shot(island, "privacy");
await axe(island, "island privacy");
check("Privacy shows stored counts", (await island.getByText(/Stored now:/).innerText()).includes("1 check-in,"));
await island.keyboard.press("Escape");
await settle();
check("Esc collapses the island", (await island.locator(".island-shell").innerText()).includes("WorkPalz"));

// Keyboard: global shortcut opens the island and moves focus inside
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

// ---------- HR dashboard ----------

const hrPromise = app.waitForEvent("window");
await hook("openHrDashboard");
const hr = await hrPromise;
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
check("Marketing themes found", overview.includes("Unclear priorities") && overview.includes("Questions the handbook can't answer"));

// Follow-up → close the loop
await hr.getByRole("button", { name: /Create follow-up for Waiting on tools, licences or access, Engineering/ }).click();
await hr.waitForTimeout(300);
await hr.getByRole("button", { name: /^Follow-ups/ }).click();
await hr.waitForTimeout(300);
await shot(hr, "hr-followups", null);
await axe(hr, "HR follow-ups");
await hr.getByRole("checkbox").first().check();
await island.getByText("Update on something you raised").waitFor({ timeout: 4000 });
await settle(500);
await shot(island, "island-update-from-hr");
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

// ---------- Summary ----------

check("No console errors", errors.length === 0, errors.slice(0, 3).join(" | "));
await app.close();

fs.writeFileSync(path.join(shots, "results.json"), JSON.stringify({ results, a11y, errors }, null, 2));
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
