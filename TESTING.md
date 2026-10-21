# Testing WorkPalz

WorkPalz has three levels of automated testing, plus a manual check before demo day. All of them use temporary data, so your real WorkPalz data is never touched.

| Level | Command | Time | What it answers |
|---|---|---|---|
| 1. Typecheck | `npm run typecheck` | ~5 s | Does the code make sense? |
| 2. Unit tests | `npm test` | ~1 s | Is the logic right? (16 tests) |
| 3. End-to-end | `npm run build && npm run test:e2e` | ~1 min | Does the real app work? (62 checks) |
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

16 tests in [tests/logic.test.ts](tests/logic.test.ts) check the app's logic without opening any window. They always use the offline AI.

| Area | What's checked |
|---|---|
| AI themes | Finds "4 of 5 Engineering new hires" and the trend from last week |
| Ask WorkPalz | Answers from the handbook, and admits when the answer isn't there |
| Privacy | HR never sees names or employee IDs; "delete my data" removes everything |
| Ping | A reply reaches the sender; pings never appear for HR |
| Ask AI | Offline answers work and never contain names |
| Handbook | AI drafts keep `[HR: …]` placeholders; publishing tells the people who asked |
| Manager view | A manager's AI only sees their own team, with no notes or request details |
| Impact | Resolved requests and closed handbook gaps are counted correctly |

**Pass = "16 passed".**

## 3. End-to-end test

```bash
npm run build
npm run test:e2e
```

[tests/e2e/demo.mjs](tests/e2e/demo.mjs) opens the real app and clicks through it the way a person would. It always uses the offline AI, even with a key in `.env`, so it costs nothing and gives the same result every time. It also runs an axe-core **WCAG 2.2 AA accessibility scan** on every screen, in light and dark mode.

### The flow

**Island (employee side)**

1. The pill shows "Wk 2"; the menu has 5 features
2. Ask WorkPalz: a jargon answer, a link button, and "not in the handbook"
3. The Back button works; clicking into another app closes the island; half-typed text is kept
4. Quick request → "Request sent"
5. Check-in prompt → pick "Frustrated" → send
6. The focus timer counts down in the pill
7. Ping: search "vpn" → only Ravi from IT shows → send → his reply pops up
8. Hide → a hint shows the shortcut → the bar appears → clicking it brings the island back
9. The Privacy screen shows what's stored, pings included
10. Keyboard: the shortcut opens the menu with focus inside, Tab moves, Esc closes

**HR dashboard**

11. Analyse → "4 of 5 Engineering new hires", "Up from 1 last week", Marketing themes
12. Create a follow-up → mark it done → the island shows "Update on something you raised"
13. Resolve a request → the island tells the employee
14. Questions: "staging server" asked 3× → Draft answer with AI → Publish stays locked until `[HR: …]` is filled in → publish → the island shows "Your question has an answer" → listed under "Added by HR"
15. Check-ins are anonymous: no names
16. The team filter and the Impact section
17. Ask AI answers from the dashboard data, with no names
18. Manager view: no Requests or Check-ins pages, no quotes, own team only
19. The dark mode toggle
20. No errors in the app's console

### What you get

- `PASS` or `FAIL` for each check, ending with **"62/62 checks passed"**
- A screenshot of every screen in `tests/e2e/shots/` (handy for pitch slides; not committed to git)
- Full results, including any accessibility problems, in `tests/e2e/shots/results.json`

### If it fails to start

"Process failed to launch!" means Electron couldn't open the app:
- Run `npm run build` first. The test uses the built app in `out/`.
- Run `npm install` again if `node_modules` is missing or old.
- Some sandboxed or remote terminals can't open windows. Use a normal Terminal on your own machine.

## 4. Manual demo run (before demo day)

Do this on the laptop you'll present with, ideally on both Mac and Windows:

1. Follow the **3-minute demo script** in the [README](README.md#3-minute-demo-script).
2. Check that the island sits in the right place and that the menu bar / tray icon appears.
3. Try the shortcuts: `Ctrl+Alt+Space`, `Ctrl+Alt+B`, `Ctrl+Alt+H` (`Cmd+Option` on Mac).
4. With an OpenAI key in `.env`, check that the dashboard shows "OpenAI" instead of "Offline analyser", and try Ask WorkPalz and Ask AI with your own questions.
5. Switch the island and the dashboard between light and dark mode.

## When to run what

| When | Run |
|---|---|
| After changing code | Typecheck + unit tests |
| Before pushing | Typecheck + unit tests + end-to-end |
| Before demo day | All of the above + the manual demo run |

## Not covered by automated tests

- **Windows**: the tests have only been run on Mac so far.
- **Real OpenAI answers**: automated runs always use the offline AI. Check the real AI by hand (step 4 above).
- **Look and feel**: layout, animations and wording. Check these yourself, using the screenshots.
