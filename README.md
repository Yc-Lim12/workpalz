# WorkPalz

**A Dynamic Island for your desktop that helps new hires get unstuck, and helps HR spot onboarding problems early.**

AI Future Makers Bootcamp 2026 · Challenge 4: RETAIN (Early Employee Disengagement)

New employees often struggle quietly in their first months: missing tools, unclear priorities, no one to ask. HR usually finds out in the exit interview. WorkPalz sits at the top of the screen as a daily helper, so getting help takes seconds and giving feedback is effortless. AI then turns that voluntary feedback into clear themes HR can act on, and tells the new hires what changed.

## Features

**For new hires (the island)**
- **Ask WorkPalz**: explains company jargon ("Q4 OKR", "LGTM") and finds policies and links ("expense form", "holiday calendar"). Answers come only from the company handbook.
- **Quick request**: send an IT or HR request in a few clicks and track its status.
- **Ping a colleague**: search by name or topic ("VPN", "staging server"), see who's available, and ask them for help. Only the colleague sees it, never HR.
- **Weekly check-in**: one tap plus an optional note. The question changes with the onboarding stage. Anonymous to HR by default.
- **Focus timer**: 25-minute focus session shown in the pill.
- **Updates**: the island tells you when HR fixes something you raised, when a question you asked gets a handbook answer, or when a colleague replies.
- **Stays out of the way**: hides itself after 10 idle minutes (a running focus timer stays), or press **Hide**. A small bar stays at the top of the screen; click it, press `Ctrl+Alt+B`, or use the WorkPalz icon in the menu bar / system tray to bring it back.
- **Settings**: light or dark island, and your own keyboard shortcuts.
- **Your privacy**: see what's stored, download it, or delete it.

**For HR (the dashboard)**
- **AI themes** across check-ins, unanswered questions and open requests, with "X of Y new hires", week-over-week trend, quotes and a suggested action.
- **One-click follow-ups**; marking one done tells the people who raised it, without revealing who they are.
- **Impact**: check-in response rate, requests resolved and how fast, oldest open request, follow-ups done, handbook gaps closed.
- **Ask AI**: one assistant on every page that knows the whole dashboard. Ask "Which team needs help most?" or "Summarise this week for managers".
- **Fill handbook gaps with AI**: for questions the handbook couldn't answer, the AI drafts an entry. Anything company-specific is left as `[HR: …]`, and publishing stays locked until HR fills it in. Publishing updates Ask WorkPalz straight away and tells everyone who asked.
- **Manager view**: a team manager sees only their own team, as patterns. No check-in notes, quotes or single requests. Their AI assistant gets the same limited data.
- **Requests** board, **Questions** (handbook gaps + popular topics), **Check-ins** history, team filter, light and dark mode.

## Responsible AI and privacy

- Only voluntary input. No app, screen, keystroke or camera tracking. No mood guessing.
- Check-ins and questions are anonymous to HR unless the employee ticks "share my name". Requests include the name because IT needs it. Pings go only to the colleague.
- Names and IDs are never sent to the AI. Theme analysis sees "P1, P2…" only so it can count people; the HR assistant gets no names at all.
- The HR window only receives sanitised data (enforced in `src/main/store.ts`). The manager limits are enforced in `src/main/assistant.ts`, not just hidden on screen.
- AI answers in Ask WorkPalz are grounded in the handbook; if it isn't there, it says so. AI handbook drafts never invent company facts.
- AI suggests, people decide. Never used for performance reviews.

## Accessibility (WCAG 2.2 AA)

- Everything works by keyboard. `Ctrl+Alt+Space` opens the island from any app; `Esc` closes it.
- Visible focus ring on every control; focus moves into a view when it opens and to the new page when switching dashboard tabs.
- Real form controls (radios, checkboxes, labelled inputs, fieldsets) styled as tiles, so screen readers announce them properly.
- Status changes are announced (`aria-live`): new check-in prompt, answers, replies, analysis finished, follow-ups.
- All text meets 4.5:1 contrast in light and dark mode, control borders and focus rings 3:1.
- Colour is never the only signal: moods, severities, statuses and availability always have text labels.
- Respects "reduce motion" and Windows high-contrast mode.
- Touch/click targets are at least 44 px. The island grows with its content, so zoomed text doesn't get cut off.
- Skip link and landmarks (header, nav, main) in the dashboard; data tables use captions and header cells.
- The end-to-end test runs an axe-core WCAG scan on every screen, light and dark.

## Run

```bash
npm install
cp .env.example .env     # optional: add an OpenAI API key
npm run dev
```

Without a key, WorkPalz uses its offline analyser, handbook search and simple offline answers, so the demo works without Wi-Fi. With a key from [OpenAI](https://platform.openai.com/api-keys), the themes, Ask WorkPalz, Ask AI and handbook drafts use OpenAI (`gpt-5.6-luna` by default; change `MAIN_VITE_OPENAI_MODEL` to use another model). Never commit `.env`, and don't share an installer built with your key in `.env`: the key is built into the app.

| Command | What it does |
|---|---|
| `npm run dev` | Run the app |
| `npm test` | Run the logic tests (16) |
| `npm run build && npm run test:e2e` | Drive the real app through every feature, screenshot it and run a WCAG scan on every screen (62 checks) |
| `npm run typecheck` | TypeScript check |
| `npm run dist:win` | Build a Windows installer (run on Windows) |
| `npm run dist:mac` | Build a macOS .dmg |

See [TESTING.md](TESTING.md) for the full testing flow: what each test checks and when to run it.

## Shortcuts

Mac: use `Cmd+Option` instead of `Ctrl+Alt`. The island shortcuts can be changed in **Settings**.

| Keys | Action |
|---|---|
| `Ctrl+Alt+Space` | Open or close the island menu |
| `Ctrl+Alt+B` | Hide or show the island |
| `Ctrl+Alt+H` | Open the HR dashboard |
| `Ctrl+Alt+C` | Demo: send this week's check-in prompt |
| `Ctrl+Alt+R` | Demo: reset all data |

Optional shortcuts for Ask WorkPalz, Quick request, Ping a colleague and the focus timer can be set in Settings.

## 3-minute demo script

1. `Ctrl+Alt+R` to reset, `Ctrl+Alt+H` to open the dashboard.
2. Island: **Ask WorkPalz** → "What is a Q4 OKR?" (instant answer + link). Then "how do I get staging server access" → not in the handbook, logged as a gap.
3. **Ping a colleague** → search "VPN" → ping Ravi from IT → his reply pops up a few seconds later.
4. `Ctrl+Alt+C` → island pulses → **Frustrated** + "Still waiting on my software licence" → Send.
5. Dashboard → **Analyse this week** → *Waiting on tools, licences or access: 4 of 5 Engineering new hires, up from 1 last week*, with a check-in, a question and a request as evidence.
6. **Create follow-up** → **Follow-ups** tab → tick done → the island expands: *"Update on something you raised…"*.
7. **Questions** → staging server question → **Draft answer with AI** → fill in the `[HR: …]` part → **Publish** → the island: *"Your question has an answer"*.
8. **Ask AI** → "Which team needs help most this week?". Then **View as → Engineering manager** to show what a manager sees.

## Project structure

```
src/
├── shared/types.ts          types shared by every part
├── main/                    Electron main process (Node)
│   ├── index.ts             windows, tray icon, IPC, shortcuts, notch placement
│   ├── store.ts             data store + privacy-sanitised HR views, impact numbers
│   ├── ai.ts                theme analysis (OpenAI + offline)
│   ├── assistant.ts         Ask AI for HR/managers + handbook drafts
│   ├── ask.ts               grounded handbook Q&A
│   ├── openai.ts            OpenAI client with timeout
│   ├── handbook.ts          fictional company handbook
│   └── seed.ts              fictional demo data: new hires and colleagues
├── preload/index.ts         the only API the UI can call
└── renderer/src/
    ├── island/              island shell, views, settings, state
    └── hr/                  dashboard shell, overview, tabs, Ask AI panel
resources/                   menu bar / tray icons
tests/logic.test.ts          analyser, Q&A, privacy, pings, assistant, handbook, manager limits
tests/e2e/demo.mjs           end-to-end run of the real app with WCAG scans
```

## Roadmap

- **Works with the tools companies already use**: Slack and Microsoft Teams channels for new requests and "fixed it" updates, and Jira / ServiceNow tickets for every Quick request. Opt-in per company, and never check-ins, questions or pings.
- Real two-way pings over Slack or Teams (in the demo, colleagues reply automatically).

## Before real-world deployment

This version stores data in a local file on one computer, and roles are picked from a menu. A company rollout needs:
- shared database + API (e.g. Supabase/Postgres) so many laptops feed one dashboard
- company sign-in (Microsoft Entra / Google SSO) with roles for employees, managers, HR and IT
- an HR admin page to edit the handbook, the colleague directory and the check-in questions
- encryption at rest, data retention settings, PDPA review and an accessibility audit with real assistive-technology users

All data in this repo is fictional.
