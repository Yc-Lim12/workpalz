# WorkPalz

**A Dynamic Island for your desktop that helps new hires get unstuck, and helps HR spot onboarding problems early.**

AI Future Makers Bootcamp 2026 · Challenge 4: RETAIN (Early Employee Disengagement)

New employees often struggle quietly in their first months: missing tools, unclear priorities, no one to ask. HR usually finds out in the exit interview. WorkPalz sits at the top of the screen as a daily helper, so giving feedback takes seconds, and AI turns that voluntary feedback into clear themes HR can act on.

## Features

**For new hires (the island)**
- **Ask WorkPalz**: explains company jargon ("Q4 OKR", "LGTM") and finds policies and links ("expense form", "holiday calendar"). Answers come only from the company handbook.
- **Quick request**: send an IT or HR request in a few clicks and track its status.
- **Weekly check-in**: one tap plus an optional note. The question changes with the onboarding stage. Anonymous to HR by default.
- **Focus timer**: 25-minute focus session shown in the pill.
- **Updates from HR**: when HR fixes something you raised, the island tells you.
- **Your privacy**: see what's stored, download it, or delete it.

**For HR (the dashboard)**
- **AI themes** across check-ins, unanswered questions and open requests, with "X of Y new hires", week-over-week trend, quotes and a suggested action.
- **One-click follow-ups**; marking one done notifies the people who raised it, without revealing who they are.
- **Requests** board, **Questions** (handbook gaps + popular topics), **Check-ins** history, team filter.

## Responsible AI and privacy

- Only voluntary input. No app, screen, keystroke or camera tracking. No mood guessing.
- Check-ins and questions are anonymous to HR unless the employee ticks "share my name". Requests include the name because IT needs it.
- Names and IDs are never sent to the AI; it sees "P1, P2…" only so it can count people.
- The HR window only receives sanitised data (enforced in `src/main/store.ts`).
- AI answers in Ask WorkPalz are grounded in the handbook; if it isn't there, it says so.
- AI suggests, people decide. Never used for performance reviews.

## Accessibility (WCAG 2.2 AA)

- Everything works by keyboard. `Ctrl+Alt+Space` opens the island from any app; `Esc` closes it.
- Visible focus ring on every control; focus moves into a view when it opens and to the new page when switching dashboard tabs.
- Real form controls (radios, checkboxes, labelled inputs, fieldsets) styled as tiles, so screen readers announce them properly.
- Status changes are announced (`aria-live`): new check-in prompt, answers, analysis finished, follow-ups.
- All text meets 4.5:1 contrast, control borders and focus rings 3:1 (checked by script).
- Colour is never the only signal: moods, severities and statuses always have text labels.
- Respects "reduce motion" and Windows high-contrast mode.
- Touch/click targets are at least 44 px. The island grows with its content, so zoomed text doesn't get cut off.
- Skip link and landmarks (header, nav, main) in the dashboard; data tables use captions and header cells.

## Run

```bash
npm install
cp .env.example .env     # optional: add a Gemini API key
npm run dev
```

Without a key, WorkPalz uses its offline analyser and handbook search, so the demo works without Wi-Fi.

| Command | What it does |
|---|---|
| `npm run dev` | Run the app |
| `npm test` | Run the logic tests (9) |
| `npm run build && npm run test:e2e` | Drive the real app through every feature, screenshot it and run a WCAG scan on every screen (37 checks) |
| `npm run typecheck` | TypeScript check |
| `npm run dist:win` | Build a Windows installer (run on Windows) |
| `npm run dist:mac` | Build a macOS .dmg |

## Shortcuts

Mac: use `Cmd+Option` instead of `Ctrl+Alt`.

| Keys | Action |
|---|---|
| `Ctrl+Alt+Space` | Open the island (keyboard access) |
| `Ctrl+Alt+H` | Open the HR dashboard |
| `Ctrl+Alt+C` | Demo: send this week's check-in prompt |
| `Ctrl+Alt+R` | Demo: reset all data |

## 2-minute demo script

1. `Ctrl+Alt+R` to reset, `Ctrl+Alt+H` to open the dashboard.
2. Island: **Ask WorkPalz** → "What is a Q4 OKR?" (instant answer + link). Then "how do I get staging server access" → not in handbook, logged as a gap.
3. `Ctrl+Alt+C` → island pulses → **Frustrated** + "Still waiting on my software licence" → Send.
4. Dashboard → **Analyse this week** → *Waiting on tools, licences or access: 4 of 5 Engineering new hires, up from 1 last week*, with a check-in, a question and a request as evidence.
5. **Create follow-up** → **Follow-ups** tab → tick done → the island expands: *"Update on something you raised…"*.

## Project structure

```
src/
├── shared/types.ts          types shared by every part
├── main/                    Electron main process (Node)
│   ├── index.ts             windows, IPC, shortcuts, notch placement
│   ├── store.ts             data store + privacy-sanitised HR views
│   ├── ai.ts                theme analysis (Gemini + offline)
│   ├── ask.ts               grounded handbook Q&A
│   ├── gemini.ts            Gemini client with timeout
│   ├── handbook.ts          fictional company handbook
│   └── seed.ts              fictional demo data
├── preload/index.ts         the only API the UI can call
└── renderer/src/
    ├── island/              island shell, views, state
    └── hr/                  dashboard shell, overview, tabs
tests/logic.test.ts          analyser, Q&A, privacy, notifications
```

## Before real-world deployment

This version stores data in a local file on one computer. A company rollout needs:
- shared database + API (e.g. Supabase/Postgres) so many laptops feed one dashboard
- company sign-in (Microsoft Entra / Google SSO) and roles for HR, managers and IT
- an HR admin page to edit the handbook and check-in questions
- encryption at rest, data retention settings, PDPA review and an accessibility audit with real assistive-technology users

All data in this repo is fictional.
