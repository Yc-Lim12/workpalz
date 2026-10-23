// Fictional "company guide" for Lumora Tech (demo only): what Ask WorkPalz answers from.
// Like a real company, the knowledge lives in three places, and every answer says which:
//   - Employee Handbook: formal HR policy (leave, conduct, probation, pay)
//   - IT Help Centre:    systems, access and how-tos
//   - Team Glossary:     company jargon, project names and rituals
// In a real deployment these sync from the company's handbook, IT help pages and wiki.
//
// Deliberately MISSING (so the demo can show onboarding gaps):
//   - how to get staging server access
//   - who approves marketing campaign budgets

import type { HandbookEntry } from "../shared/types";

const INTRANET = "https://intranet.lumora.example";

export const HANDBOOK: HandbookEntry[] = [
  {
    id: "okr",
    title: "OKR (Objectives and Key Results)",
    kind: "jargon",
    source: "glossary",
    keywords: ["okr", "okrs", "q1 okr", "q2 okr", "q3 okr", "q4 okr", "objectives", "key results"],
    answer:
      "OKRs are our quarterly goals. Each team sets 2–3 objectives, each with measurable key results. 'Q4 OKR' means the goals for October to December. Your manager will share your team's OKRs in your first month.",
    link: `${INTRANET}/okrs`,
    linkLabel: "This quarter's OKRs",
  },
  {
    id: "aurora",
    title: "Project Aurora",
    kind: "jargon",
    source: "glossary",
    keywords: ["aurora", "project aurora"],
    answer:
      "Aurora is Lumora's new customer payments platform, launching next quarter. Most Engineering new hires join it. The team demos progress every Thursday at 4 pm, and #aurora has the latest news.",
  },
  {
    id: "eod",
    title: "EOD / EOW",
    kind: "jargon",
    source: "glossary",
    keywords: ["eod", "eow", "end of day", "end of week"],
    answer: "EOD = end of day (6 pm your local time). EOW = end of week (Friday 6 pm).",
  },
  {
    id: "standup",
    title: "Stand-up",
    kind: "jargon",
    source: "glossary",
    keywords: ["standup", "stand-up", "daily standup", "scrum"],
    answer:
      "A 15-minute daily team meeting at 9:30 am. Each person shares what they did yesterday, what they're doing today and anything blocking them.",
  },
  {
    id: "one-on-one",
    title: "1:1 meetings",
    kind: "policy",
    source: "handbook",
    keywords: ["1:1", "1-1", "one on one", "one-on-one", "check in with manager", "meeting with manager"],
    answer:
      "New hires have a 30-minute 1:1 with their manager every week for the first 3 months. If you haven't had one this week, it's fine to ask your manager to book it.",
  },
  {
    id: "buddy",
    title: "Onboarding buddy",
    kind: "policy",
    source: "handbook",
    keywords: ["buddy", "onboarding buddy", "mentor", "who can i ask"],
    answer:
      "Every new hire gets a buddy from another team for their first 90 days. Your buddy is your go-to person for 'small' questions. Check your welcome email for their name.",
  },
  {
    id: "probation",
    title: "Probation review",
    kind: "policy",
    source: "handbook",
    keywords: ["probation", "confirmation", "3 month review", "three month review"],
    answer:
      "Probation is 3 months. Your manager will hold a review in week 11 or 12 based on the 30-day goals you agreed together.",
  },
  {
    id: "annual-leave",
    title: "Annual leave",
    kind: "policy",
    source: "handbook",
    keywords: ["annual leave", "leave", "pto", "holiday leave", "time off", "vacation", "apply leave"],
    answer:
      "You get 14 days of annual leave a year, pro-rated in your first year. Apply at least 3 working days ahead in the HR portal, or use Quick request → Leave in WorkPalz.",
    link: `${INTRANET}/hr/leave`,
    linkLabel: "Apply for leave",
  },
  {
    id: "medical",
    title: "Medical leave and claims",
    kind: "policy",
    source: "handbook",
    keywords: ["medical", "mc", "sick", "sick leave", "clinic", "panel clinic", "medical claim"],
    answer:
      "You get 14 days of paid medical leave a year. Visit any panel clinic with your staff ID, and upload your MC in the HR portal on the same day.",
    link: `${INTRANET}/hr/medical`,
    linkLabel: "Panel clinic list",
  },
  {
    id: "holidays",
    title: "Public holiday calendar",
    kind: "how-to",
    source: "handbook",
    keywords: ["holiday calendar", "public holiday", "holidays", "holiday"],
    answer: "We follow the federal public holidays for Malaysia plus your state's holidays. The full 2026 calendar is on the intranet.",
    link: `${INTRANET}/hr/holidays-2026`,
    linkLabel: "2026 holiday calendar",
  },
  {
    id: "expense",
    title: "Expense claims",
    kind: "how-to",
    source: "handbook",
    keywords: ["expense", "expense form", "claim", "reimburse", "reimbursement", "receipt"],
    answer:
      "Submit claims with receipts in the Expense form by the 15th to be paid in that month's salary. Your manager approves them.",
    link: `${INTRANET}/finance/expense-form`,
    linkLabel: "Expense form",
  },
  {
    id: "payroll",
    title: "Pay day",
    kind: "policy",
    source: "handbook",
    keywords: ["salary", "pay day", "payday", "payslip", "payroll", "when do i get paid"],
    answer: "Salary is paid on the 25th of every month. Payslips are in the HR portal under 'My pay'.",
    link: `${INTRANET}/hr/payslips`,
    linkLabel: "My payslips",
  },
  {
    id: "software-licence",
    title: "Requesting software or licences",
    kind: "how-to",
    source: "it",
    keywords: ["software", "licence", "license", "ide", "install", "jetbrains", "figma licence", "software request"],
    answer:
      "Use Quick request → Software or licence in WorkPalz. IT approves standard tools within 2 working days. Mention which project needs it.",
  },
  {
    id: "hardware",
    title: "Laptop and hardware issues",
    kind: "how-to",
    source: "it",
    keywords: ["laptop", "keyboard", "mouse", "monitor", "hardware", "broken", "charger"],
    answer: "Use Quick request → Laptop or hardware. For urgent issues, the IT desk is on level 3, open 9 am to 6 pm.",
  },
  {
    id: "vpn",
    title: "VPN setup",
    kind: "how-to",
    source: "it",
    keywords: ["vpn", "remote access", "work from home access", "connect from home"],
    answer: "Install the company VPN app from the IT self-service portal and sign in with your work email. You'll need it to reach internal tools from home.",
    link: `${INTRANET}/it/vpn`,
    linkLabel: "VPN setup guide",
  },
  {
    id: "wfh",
    title: "Hybrid work",
    kind: "policy",
    source: "handbook",
    keywords: ["wfh", "work from home", "hybrid", "remote work", "office days"],
    answer: "Teams work hybrid: 3 days in the office, 2 from home. New hires are asked to be in the office 4 days a week for the first month.",
  },
  {
    id: "working-hours",
    title: "Working hours",
    kind: "policy",
    source: "handbook",
    keywords: ["working hours", "office hours", "start time", "what time", "lunch break", "overtime"],
    answer:
      "Core hours are 9 am to 6 pm, Monday to Friday, with a one-hour lunch break. You can start between 8 and 10 am if your team agrees. Overtime must be approved by your manager first.",
  },
  {
    id: "code-of-conduct",
    title: "Code of conduct",
    kind: "policy",
    source: "handbook",
    keywords: ["code of conduct", "conduct", "harassment", "discrimination", "report a concern", "grievance", "whistleblowing"],
    answer:
      "Treat everyone with respect; harassment and discrimination are never accepted. You can raise a concern with your manager, your HR partner or the confidential ethics line, and you won't face any retaliation for doing so.",
    link: `${INTRANET}/code-of-conduct`,
    linkLabel: "Code of conduct",
  },
  {
    id: "notice-period",
    title: "Resignation and notice period",
    kind: "policy",
    source: "handbook",
    keywords: ["resign", "resignation", "notice period", "quit", "leaving the company"],
    answer:
      "During probation the notice period is 2 weeks; after confirmation it is 1 month. Resignations are made in writing to your manager, copied to HR.",
  },
];
