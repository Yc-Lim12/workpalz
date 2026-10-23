# Testing WorkPalz

WorkPalz has three levels of automated testing, plus a manual check before demo day. All of them use temporary data, so your real WorkPalz data is never touched.

| Level | Command | Time | What it answers |
|---|---|---|---|
| 1. Typecheck | `npm run typecheck` | ~5 s | Does the code make sense? |
| 2. Unit tests | `npm test` | ~1 s | Is the logic right? (21 tests) |
| 3. End-to-end | `npm run build && npm run test:e2e` | ~1.5 min | Does the real app work? (94 checks) |
| 4. Manual demo run | see below | ~5 min | Does it look and feel right? |

## 1. Typecheck

```bash
npm run typecheck
```

TypeScript reads all the code without running it and catches mistakes such as a misspelled name, a missing field or the wrong type of data. **Pass = no errors.**

## 2. Unit tests

```bash
npm test
```

21 tests in [tests/logic.test.ts](tests/logic.test.ts) check the app's logic without opening any window. They always use the offline AI.

| Area | What's checked |
|---|---|
| AI themes | Finds "4 of 5 Engineering new hires" and the trend from last week |
| Ask WorkPalz | Answers from the company guide and names the part (Employee Handbook, IT Help Centre, Team Glossary); admits when the answer isn't there |
| Privacy | HR never sees names or employee IDs; "delete my data" removes everything |
| Hearing back | Only people who ticked "Tell me if HR acts on this" get the update; HR sees how many, never who |
| Ping | A reply reaches the sender; pings never appear for HR |
| Ask AI | Offline answers work and never contain names |
| Company guide | AI drafts keep `[HR: …]` placeholders and suggest where they belong; publishing tells the people who asked |
| Manager view | A manager's AI only sees their own team, with no notes or request details |
| Impact | Resolved requests, closed company guide gaps and "fixed without a ticket" are counted correctly |
| Island AI helpers | Smart request picks the category and a guide answer; "Who can help?" picks the right colleague; a stuck check-in gets a tip and the related request status |

**Pass = "21 passed".**

## 3. End-to-end test

```bash
npm run build
npm run test:e2e
```

[tests/e2e/demo.mjs](tests/e2e/demo.mjs) opens the real app and clicks through it the way a person would. It always uses the offline AI, even with a key in `.env`, so it costs nothing and gives the same result every time. It also runs an axe-core **WCAG 2.2 AA accessibility scan** on every screen, in light and dark mode.

### The flow

**Island (employee side)**

0. First launch: the welcome tour opens by itself, shows the open shortcut and explains anonymity
1. The pill shows "Wk 2"; the menu has 5 features
2. Ask WorkPalz: a jargon answer labelled "From the Team Glossary", a link button, "not in the company guide", then × clears the old answer and shows recent questions; first Esc clears, second closes
3. The Back button works; clicking into another app closes the island; half-typed text is kept
4. Smart Quick request: "laptop won't connect to the vpn" → one screen: VPN guide offered, "Goes to: IT · System access" already picked; then a hardware problem → Change shows all options → "Send to IT" → "Sent to IT"
5. Check-in prompt → "Tell me if HR acts on this" is ticked → pick "Frustrated" → send → "Thanks" with a guide tip
6. The focus timer counts down in the pill
7. Ping: "the staging server won't run" → ✦ Who can help → suggests Ahmad; search "vpn" → only Ravi from IT shows → send → his reply pops up
8. Idle → the pill shrinks to a dot → hovering brings it back. Quiet for 1 hour → the island steps back; a new check-in doesn't pop up but the tray counts it → turning Quiet off brings it back. Hide for now → the bar appears → clicking it brings the island back
9. The Privacy screen shows what's stored, pings included
10. Keyboard: the shortcut opens the menu with focus inside, Tab moves, Esc closes
11. Click-through: the see-through island window only catches clicks when the pointer is on the island; moving the mouse off it while typing doesn't close it

**HR dashboard**

12. Analyse → "4 of 5 Engineering new hires", "Up from 1 last week", Marketing themes
13. Create a follow-up → HR sees "will tell N new hires, you won't see who" → mark it done → the island shows "Update on something you raised… HR doesn't know who received it"
14. Resolve a request → the island tells the employee
15. Questions: "staging server" asked 3× → Draft answer with AI → it suggests the IT Help Centre → Publish stays locked until `[HR: …]` is filled in → publish → the island shows "Your question has an answer… IT Help Centre now covers it" → listed under "Added by HR"
16. Check-ins are anonymous: no names
17. The team filter and the Impact section
18. Ask AI answers from the dashboard data, with no names
19. Manager view: no Requests or Check-ins pages, no quotes, own team only
20. The dark mode toggle
21. No errors in the app's console

### What you get

- `PASS` or `FAIL` for each check, ending with **"94/94 checks passed"**
- A screenshot of every screen in `tests/e2e/shots/` (handy for pitch slides; not committed to git)
- Full results, including any accessibility problems, in `tests/e2e/shots/results.json`

Every step has a 15-second limit, so a missing button fails the run with an error instead of hanging it.

The test drives a real desktop window, so it is occasionally affected by focus timing (about 1 run in 10 times out). If one step fails once, run it again; if the same step fails twice, it's a real problem.

### If it fails to start

"Process failed to launch!" means Electron couldn't open the app:
- Run `npm run build` first. The test uses the built app in `out/`.
- Run `npm install` again if `node_modules` is missing or old.
- Some sandboxed or remote terminals can't open windows. Use a normal Terminal on your own machine.

## 4. Manual demo run (before demo day)

Do this on the laptop you'll present with, ideally on both Mac and Windows:

1. Follow the **3-minute demo script** in the [README](README.md#3-minute-demo-script).
2. Check that the island sits in the right place and that the menu bar / tray icon appears. Try Quiet, then trigger a check-in (`Ctrl+Alt+C`): the icon should show a number (Mac) or a dot (Windows).
3. Open a full-screen app (slides or a video call) and check the island steps back. On Windows it may not; use Quiet there.
4. Try the shortcuts: `Ctrl+Alt+Space`, `Ctrl+Alt+B`, `Ctrl+Alt+H` (`Cmd+Option` on Mac).
5. With an OpenAI key in `.env`, check that the dashboard shows "OpenAI" instead of "Offline analyser", and try Ask WorkPalz and Ask AI with your own questions.
6. Switch the island and the dashboard between light and dark mode.

## When to run what

| When | Run |
|---|---|
| After changing code | Typecheck + unit tests |
| Before pushing | Typecheck + unit tests + end-to-end |
| Before demo day | All of the above + the manual demo run |

## Not covered by automated tests

- **Windows**: the tests have only been run on Mac so far.
- **Full-screen stepping back and the tray number/dot**: these are drawn by the operating system, so check them by hand.
- **Real OpenAI answers**: automated runs always use the offline AI. Check the real AI by hand (step 4 above).
- **Look and feel**: layout, animations and wording. Check these yourself, using the screenshots.
