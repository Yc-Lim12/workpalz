# WorkPalz

**A Dynamic Island for your desktop that helps new hires get unstuck, and helps HR spot onboarding problems early.**

AI Future Makers Bootcamp 2026 · Challenge 4: RETAIN (Early Employee Disengagement)

New employees often struggle quietly in their first months: missing tools, unclear priorities, no one to ask. HR usually finds out in the exit interview. WorkPalz sits at the top of the screen as a daily helper, so getting help takes seconds and giving feedback is effortless. AI then turns that voluntary feedback into clear themes HR can act on, and tells the new hires what changed.

## Features

**For new hires (the island)**
- **Ask WorkPalz**: answers from the **company guide**, which, like in a real company, lives in three places, and every answer says which one:
  - **Employee Handbook**: formal HR policy (leave, working hours, probation, code of conduct, notice period)
  - **IT Help Centre**: systems, access and how-tos ("VPN setup", "request a software licence")
  - **Team Glossary**: company jargon and project names ("Q4 OKR", "Project Aurora")

  Works like a search box: an × clears the question and the old answer, the first `Esc` clears and the second closes, and **recent questions** are listed to ask again (kept on that computer only; removed by "Delete my data").
- **Smart Quick request** (hybrid AI): describe the problem in your own words, or tap a **quick button** (Laptop or hardware, Pay or claims, …) and just add a line. One screen shows a matching answer from the company guide ("That fixed it" = no ticket needed) and where the request goes ("Goes to: IT · System access", picked for you, with Change); if you're still stuck, press "Send to IT". Vague requests ("I want to submit an IT ticket") get one short question first. Track status afterwards.
- **Ping a colleague**: search by name or topic ("VPN", "staging server"), or describe the problem and press **✦ Who can help with this?** (AI suggests the right person). See who's available and ask them for help. Only the colleague sees it, never HR.
- **Weekly check-in**: one tap plus an optional note. The question changes with the onboarding stage. Anonymous to HR by default, with a choice to hear back if HR acts on it (see below). If you say you're stuck, WorkPalz gives something back straight away (AI): a matching guide answer and the status of your related open request.
- **Focus timer**: 25-minute focus session shown in the pill.
- **Updates**: the island tells you when HR fixes something you raised, when a question you asked gets an answer in the company guide, or when a colleague replies.
- **Welcome tour**: on the first day the island opens itself once and shows how to open it, how it stays out of the way and how anonymity works. Replay it from Settings.
- **Visible, but polite**: the island stays on screen as the main thing, and steps back when you're busy:
  - after 10 idle minutes it **shrinks to a small dot** (hover to bring the full pill back); it stays full size while something is waiting or a focus timer runs
  - **full-screen apps** (slides, video calls) get the whole screen on macOS
  - **Quiet for 1 hour / until tomorrow**: nothing pops up; anything waiting shows as a **number on the menu bar / tray icon** (a dot on Windows)
  - **Hide for now** leaves a small bar at the top; click it, press `Ctrl+Alt+B`, or use the tray icon to bring it back
  - it only pops up for things that need you: an HR update, a ping reply or the weekly check-in
- **Settings**: light or dark island, and your own keyboard shortcuts.
- **Your privacy**: see what's stored, download it, or delete it.

**For HR (the dashboard)**
- **AI themes** across check-ins, unanswered questions and open requests, with "X of Y new hires", week-over-week trend, quotes and a suggested action.
- **One-click follow-ups**; marking one done tells the people who raised it, without revealing who they are.
- **Impact**: check-in response rate, requests resolved and how fast, oldest open request, follow-ups done, problems **fixed without a ticket**, company guide gaps closed.
- **Ask AI**: one assistant on every page that knows the whole dashboard. Ask "Which team needs help most?" or "Summarise this week for managers".
- **Fill gaps in the company guide with AI**: for questions the guide couldn't answer, the AI drafts an entry and suggests where it belongs (formal policy goes in the Employee Handbook, server access in the IT Help Centre, jargon in the Team Glossary); HR can change it. Anything company-specific is left as `[HR: …]`, and publishing stays locked until HR fills it in. Publishing updates Ask WorkPalz straight away and tells everyone who asked.
- **Manager view**: a team manager sees only their own team, as patterns. No check-in notes, quotes or single requests. Their AI assistant gets the same limited data.
- **Requests** board, **Questions** (company guide gaps + popular topics), **Check-ins** history, team filter, light and dark mode.

## Responsible AI and privacy

- Only voluntary input. No app, screen, keystroke or camera tracking. No mood guessing.
- Check-ins and questions are anonymous to HR unless the employee ticks "share my name". Requests include the name because IT needs it. Pings go only to the colleague.
- **Anonymous, but you can still hear back**: WorkPalz, not HR, keeps a private note of who raised what. When HR marks a follow-up done, WorkPalz tells the people who ticked "Tell me if HR acts on this" (on by default, changeable at every check-in). HR only sees "will tell 3 new hires, you won't see who". The check-in, the update itself, the privacy screen and the welcome tour all explain this.
- Names and IDs are never sent to the AI. Theme analysis sees "P1, P2…" only so it can count people; the HR assistant gets no names at all.
- The HR window only receives sanitised data (enforced in `src/main/store.ts`). The manager limits are enforced in `src/main/assistant.ts`, not just hidden on screen.
- AI answers in Ask WorkPalz are grounded in the company guide and say which part they come from; if it isn't there, it says so. The AI never rewords formal Employee Handbook policy, and its drafts never invent company facts.
- **Hybrid on the island**: Quick request and "Who can help?" answer clear cases with keyword rules (instant, the same every time) and only ask the AI about wording the rules can't place. The person always confirms where a request goes.
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

Without a key, WorkPalz uses its offline analyser, company guide search and simple offline answers, so the demo works without Wi-Fi. With a key from [OpenAI](https://platform.openai.com/api-keys), the themes, Ask WorkPalz, Ask AI and handbook drafts use OpenAI (`gpt-5.6-luna` by default; change `MAIN_VITE_OPENAI_MODEL` to use another model). Never commit `.env`, and don't share an installer built with your key in `.env`: the key is built into the app.

| Command | What it does |
|---|---|
| `npm run dev` | Run the app |
| `npm test` | Run the logic tests (27) |
| `npm run build && npm run test:e2e` | Drive the real app through every feature, screenshot it and run a WCAG scan on every screen (98 checks) |
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

1. `Ctrl+Alt+R` to reset, `Ctrl+Alt+H` to open the dashboard. (On a fresh install the island first shows its welcome tour.)
2. Island: **Ask WorkPalz** → "What is a Q4 OKR?" (instant answer from the Team Glossary + link). Then "how do I get staging server access" → not in the company guide, logged as a gap.
3. **Ping a colleague** → search "VPN" → ping Ravi from IT → his reply pops up a few seconds later.
4. `Ctrl+Alt+C` → island pulses → **Frustrated** + "Still waiting on my software licence" → Send.
5. Dashboard → **Analyse this week** → *Waiting on tools, licences or access: 4 of 5 Engineering new hires, up from 1 last week*, with a check-in, a question and a request as evidence.
6. **Create follow-up** → **Follow-ups** tab → tick done → the island expands: *"Update on something you raised…"*.
7. **Questions** → staging server question → **Draft answer with AI** (it suggests the IT Help Centre) → fill in the `[HR: …]` part → **Publish** → the island: *"Your question has an answer"*.
8. **Ask AI** → "Which team needs help most this week?". Then **View as → Engineering manager** to show what a manager sees.

## Project structure

```
src/
├── shared/types.ts          types shared by every part
├── main/                    Electron main process (Node)
│   ├── index.ts             windows, tray icon, IPC, shortcuts, notch placement
│   ├── store.ts             data store + privacy-sanitised HR views, impact numbers
│   ├── ai.ts                theme analysis (OpenAI + offline)
│   ├── assistant.ts         Ask AI for HR/managers + company guide drafts
│   ├── ask.ts               grounded Q&A over the company guide
│   ├── helper.ts            island helpers (rules first, AI only when unsure): smart request, who can help, check-in reply
│   ├── openai.ts            OpenAI client with timeout
│   ├── handbook.ts          fictional company guide: Employee Handbook, IT Help Centre, Team Glossary
│   └── seed.ts              fictional demo data: new hires and colleagues
├── preload/index.ts         the only API the UI can call
└── renderer/src/
    ├── island/              island shell, views, settings, state
    └── hr/                  dashboard shell, overview, tabs, Ask AI panel
resources/                   menu bar / tray icons
tests/logic.test.ts          analyser, Q&A, privacy, "tell me" updates, pings, assistant, company guide, manager limits
tests/e2e/demo.mjs           end-to-end run of the real app with WCAG scans
```

## Roadmap

- **Works with the tools companies already use**: Slack and Microsoft Teams channels for new requests and "fixed it" updates, and Jira / ServiceNow tickets for every Quick request. Opt-in per company, and never check-ins, questions or pings.
- Real two-way pings over Slack or Teams (in the demo, colleagues reply automatically).

## Before real-world deployment

This version stores data in a local file on one computer, and roles are picked from a menu. A company rollout needs:
- shared database + API (e.g. Supabase/Postgres) so many laptops feed one dashboard
- company sign-in (Microsoft Entra / Google SSO) with roles for employees, managers, HR and IT
- syncing the company guide from the real handbook, IT help pages and wiki, and an HR admin page to edit it, the colleague directory and the check-in questions
- encryption at rest, data retention settings, PDPA review and an accessibility audit with real assistive-technology users

All data in this repo is fictional.
