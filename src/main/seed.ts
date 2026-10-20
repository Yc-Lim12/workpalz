// Fictional demo data for "Lumora Tech". No real people.
import type { Ask, CheckIn, Colleague, Employee, Mood, RequestCategory, RequestStatus, SupportRequest } from "../shared/types";

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

// The weekly question changes with the onboarding stage
export function questionForWeek(week: number): string {
  if (week <= 2) return "Do you have the tools and access you need this week?";
  if (week <= 4) return "How clear are your priorities right now?";
  if (week <= 8) return "Are you getting enough feedback from your manager?";
  return "Do you feel part of the team?";
}

const daysAgo = (d: number, hour = 15) => {
  const t = new Date();
  t.setDate(t.getDate() - d);
  t.setHours(hour, 10, 0, 0);
  return t.toISOString();
};

const emp = (id: string) => EMPLOYEES.find((e) => e.id === id)!;

// ---------- Check-ins ----------
// [employeeId, daysAgo, mood, note, shareName]
type C = [string, number, Mood, string, boolean];

const CHECKINS: C[] = [
  // This week. Engineering: 3 of 5 blocked on tools/access (live demo adds the 4th).
  ["e1", 1, "frustrated", "Still waiting on my IDE and database licences, borrowing a teammate's laptop to test.", false],
  ["e2", 1, "stuck", "No access to the staging server yet so I can't run the project.", true],
  ["e3", 2, "frustrated", "My software licence request has been pending for 6 days.", false],
  ["e4", 2, "okay", "Settling in, my buddy has been helpful.", false],
  // Marketing: unclear priorities
  ["m1", 1, "stuck", "Not sure which campaign is the priority, got two different answers.", false],
  ["m2", 2, "frustrated", "Unclear what success looks like for my first project.", true],
  ["m3", 1, "okay", "Good week, the team lunch helped.", false],
  // Finance: fine
  ["f1", 2, "great", "Quick feedback from my manager in our weekly 1:1.", true],
  // Last week
  ["e1", 8, "stuck", "Laptop arrived without the dev tools installed.", false],
  ["e2", 8, "okay", "Learning the codebase.", false],
  ["e3", 9, "okay", "Good onboarding sessions.", false],
  ["m1", 8, "okay", "Getting to know the team.", false],
  ["m2", 9, "okay", "Lots of reading this week.", false],
  ["f1", 9, "great", "Clear plan for the month.", false],
  ["f2", 8, "okay", "Learning the month-end process.", false],
];

export function seedCheckIns(): CheckIn[] {
  return CHECKINS.map(([employeeId, d, mood, note, shareName], i) => {
    const e = emp(employeeId);
    const week = d >= 7 ? Math.max(1, e.week - 1) : e.week;
    return {
      id: `c${i}`,
      employeeId,
      team: e.team,
      week,
      question: questionForWeek(week),
      mood,
      note,
      shareName,
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
  ["e4", 2, "what does LGTM mean", "lgtm"],
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
