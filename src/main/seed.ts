// Fictional demo data for "Lumora Tech". No real people.
import { FALLBACK_QUESTION, type AnswerSet, type Ask, type CheckIn, type CheckInQuestion, type Colleague, type Employee, type RequestCategory, type RequestStatus, type SupportRequest } from "../shared/types";

export const ME_ID = "e5"; // the employee using the island in the demo

export const EMPLOYEES: Employee[] = [
  { id: "e1", name: "Aisyah Rahman", team: "Engineering", week: 2 },
  { id: "e2", name: "Jun Hao Tan", team: "Engineering", week: 2 },
  { id: "e3", name: "Priya Menon", team: "Engineering", week: 2 },
  { id: "e4", name: "Daniel Koh", team: "Engineering", week: 1 },
  { id: "e5", name: "Mei Ling Chew", team: "Engineering", week: 2 },
  { id: "m1", name: "Farid Ismail", team: "Marketing", week: 4 },
  { id: "m2", name: "Sarah Lee", team: "Marketing", week: 4 },
  { id: "m3", name: "Kavitha Raj", team: "Marketing", week: 3 },
  { id: "f1", name: "Wei Jie Ong", team: "Finance", week: 6 },
  { id: "f2", name: "Nur Izzah", team: "Finance", week: 7 },
];

// Experienced staff a new hire can ping for help (not new hires, so not in HR stats)
export const COLLEAGUES: Colleague[] = [
  { id: "p1", name: "Ahmad Zaki", role: "Senior Engineer, your buddy", team: "Engineering", helpsWith: ["Codebase", "Code review", "Git", "Staging server"], availability: "available" },
  { id: "p2", name: "Grace Lim", role: "Engineering Lead", team: "Engineering", helpsWith: ["Priorities", "Architecture", "1:1s"], availability: "busy" },
  { id: "p3", name: "Ravi Kumar", role: "IT Helpdesk", team: "IT", helpsWith: ["Laptop", "VPN", "Software licences", "System access"], availability: "available" },
  { id: "p4", name: "Hannah Wong", role: "Marketing Manager", team: "Marketing", helpsWith: ["Campaign budget", "Priorities", "Brand guide"], availability: "away" },
  { id: "p5", name: "Siti Aminah", role: "HR Partner", team: "HR", helpsWith: ["Leave", "Benefits", "Onboarding"], availability: "available" },
  { id: "p6", name: "Marcus Tan", role: "Finance Analyst", team: "Finance", helpsWith: ["Expense claims", "Payroll", "Month-end"], availability: "available" },
];

// Answer choices HR can reword, extend or replace on the Check-ins tab.
// Each choice says what it means (Doing well / Okay / Needs help): that's what themes and tips use.
export const DEFAULT_ANSWER_SETS: AnswerSet[] = [
  {
    id: "mood",
    name: "Mood",
    choices: [
      { id: "great", label: "Great", signal: "good" },
      { id: "okay", label: "Okay", signal: "okay" },
      { id: "stuck", label: "Stuck", signal: "struggling" },
      { id: "frustrated", label: "Frustrated", signal: "struggling" },
      { id: "overloaded", label: "Overloaded", signal: "struggling" },
    ],
  },
  {
    id: "yes-somewhat",
    name: "Yes / Somewhat / Not yet",
    choices: [
      { id: "yes", label: "Yes", signal: "good" },
      { id: "somewhat", label: "Somewhat", signal: "okay" },
      { id: "not-yet", label: "Not yet", signal: "struggling" },
    ],
  },
  {
    id: "scale",
    name: "1 to 5",
    choices: [
      { id: "1", label: "1 Not at all", signal: "struggling" },
      { id: "2", label: "2", signal: "struggling" },
      { id: "3", label: "3", signal: "okay" },
      { id: "4", label: "4", signal: "good" },
      { id: "5", label: "5 Very", signal: "good" },
    ],
  },
];

// The weekly question changes with the onboarding stage. HR can change these on the Check-ins tab.
// Belonging is asked from week 3, not left until the end: losing connection shows early.
export const DEFAULT_QUESTIONS: CheckInQuestion[] = [
  { id: "tools", text: "Do you have the tools and access you need this week?", weeks: [1, 2], answerSetId: "yes-somewhat" },
  { id: "belonging", text: "Do you feel part of the team?", weeks: [3, 8, 9, 10, 11, 12], answerSetId: "yes-somewhat" },
  { id: "priorities", text: "How clear are your priorities right now?", weeks: [4, 5], answerSetId: "scale" },
  { id: "feedback", text: "Are you getting enough feedback from your manager?", weeks: [6, 7], answerSetId: "yes-somewhat" },
];

export const questionForWeek = (week: number, questions = DEFAULT_QUESTIONS): CheckInQuestion =>
  questions.find((q) => q.weeks.includes(week)) ?? FALLBACK_QUESTION;

const daysAgo = (d: number, hour = 15) => {
  const t = new Date();
  t.setDate(t.getDate() - d);
  t.setHours(hour, 10, 0, 0);
  return t.toISOString();
};

const emp = (id: string) => EMPLOYEES.find((e) => e.id === id)!;

// ---------- Check-ins ----------
// [employeeId, daysAgo, answer (a choice in that week's question), note, shareName]
type C = [string, number, string, string, boolean];

const CHECKINS: C[] = [
  // This week. Engineering (week 1-2, "tools and access"): 3 of 5 blocked (live demo adds the 4th).
  ["e1", 1, "not-yet", "Still waiting on my IDE and database licences, borrowing a teammate's laptop to test.", false],
  ["e2", 1, "not-yet", "No access to the staging server yet so I can't run the project.", true],
  ["e3", 2, "not-yet", "My software licence request has been pending for 6 days.", false],
  ["e4", 2, "yes", "Settling in, my buddy has been helpful.", false],
  // Marketing: unclear priorities (week 4, 1 to 5), belonging (week 3)
  ["m1", 1, "2", "Not sure which campaign is the priority, got two different answers.", false],
  ["m2", 2, "1", "Unclear what success looks like for my first project.", true],
  ["m3", 1, "yes", "Good week, the team lunch helped.", false],
  // Finance: fine (week 6, feedback)
  ["f1", 2, "yes", "Quick feedback from my manager in our weekly 1:1.", true],
  // Last week
  ["e1", 8, "not-yet", "Laptop arrived without the dev tools installed.", false],
  ["e2", 8, "somewhat", "Learning the codebase.", false],
  ["e3", 9, "yes", "Good onboarding sessions.", false],
  ["m1", 8, "somewhat", "Getting to know the team.", false],
  ["m2", 9, "somewhat", "Lots of reading this week.", false],
  ["f1", 9, "5", "Clear plan for the month.", false],
  ["f2", 8, "somewhat", "Learning the month-end process.", false],
];

export function seedCheckIns(): CheckIn[] {
  return CHECKINS.map(([employeeId, d, answer, note, shareName], i) => {
    const e = emp(employeeId);
    const week = d >= 7 ? Math.max(1, e.week - 1) : e.week;
    const q = questionForWeek(week);
    const choice = DEFAULT_ANSWER_SETS.find((a) => a.id === q.answerSetId)!.choices.find((c) => c.id === answer)!;
    return {
      id: `c${i}`,
      employeeId,
      team: e.team,
      week,
      question: q.text,
      questionId: q.id,
      answer: choice.id,
      answerLabel: choice.label,
      signal: choice.signal,
      note,
      shareName,
      notifyMe: true,
      createdAt: daysAgo(d),
    };
  });
}

// ---------- Ask WorkPalz questions ----------
// [employeeId, daysAgo, question, entryId | null]
type A = [string, number, string, string | null];

const ASKS: A[] = [
  ["e1", 3, "how do I request a software licence", "software-licence"],
  ["e2", 2, "how do I get access to the staging server", null],
  ["e3", 1, "staging server access", null],
  ["e4", 2, "what is project aurora", "aurora"],
  ["e4", 1, "vpn setup", "vpn"],
  ["m1", 2, "who approves the campaign budget", null],
  ["m2", 1, "what is the Q4 OKR", "okr"],
  ["m3", 1, "who approves campaign budget?", null],
  ["f1", 3, "when is pay day", "payroll"],
  ["f2", 2, "expense form", "expense"],
  ["e1", 9, "what is a stand-up", "standup"],
];

export function seedAsks(): Ask[] {
  return ASKS.map(([employeeId, d, question, entryId], i) => {
    const e = emp(employeeId);
    return {
      id: `a${i}`,
      employeeId,
      team: e.team,
      week: d >= 7 ? Math.max(1, e.week - 1) : e.week,
      question,
      entryId,
      answered: entryId !== null,
      createdAt: daysAgo(d, 11),
    };
  });
}

// ---------- Quick requests ----------
// [employeeId, daysAgo, category, description, status]
type R = [string, number, RequestCategory, string, RequestStatus];

const REQUESTS: R[] = [
  ["e1", 4, "software", "IDE and database client licences for the payments project.", "open"],
  ["e3", 6, "software", "IDE licence. Request pending since my first week.", "open"],
  ["e2", 3, "access", "Staging server access for the onboarding project.", "in_progress"],
  ["m2", 2, "leave", "Half day on Friday for a family event.", "resolved"],
];

export function seedRequests(): SupportRequest[] {
  return REQUESTS.map(([employeeId, d, category, description, status], i) => {
    const e = emp(employeeId);
    return {
      id: `r${i}`,
      employeeId,
      name: e.name,
      team: e.team,
      category,
      description,
      status,
      createdAt: daysAgo(d, 10),
      updatedAt: daysAgo(Math.max(0, d - 1), 10),
    };
  });
}
