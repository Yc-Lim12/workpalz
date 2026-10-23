export type IslandView = "pill" | "menu" | "checkin" | "ask" | "request" | "notice" | "privacy" | "settings" | "ping" | "away" | "tour";

export const BLUE = "var(--blue)";
export const AMBER = "var(--amber)";
export const MUTED = "var(--muted)"; 
export const PLACEHOLDER = "var(--muted)";

// Width per view. Height follows the content, so it never clips when text is zoomed.
export const WIDTH: Record<IslandView, number> = {
  pill: 240,
  menu: 360,
  checkin: 440,
  ask: 440,
  request: 440,
  notice: 380,
  privacy: 420,
  settings: 350,
  ping: 420,
  away: 360,
  tour: 400,
};
export const NOTCH_PILL_WIDTH = 420; // pill wraps around the MacBook notch
export const NOTCH_GAP = 210; // hidden middle part behind the notch
// Shrunk (idle) pill: a small dot, still at least 24 px to click (WCAG 2.5.8)
export const MINI_WIDTH = 56;
export const MINI_HEIGHT = 24;
export const MINI_SIDE = 28; // with a notch: the dot sits just left of it

export const RADIUS: Record<IslandView, number> = {
  pill: 20,
  menu: 28,
  checkin: 30,
  ask: 30,
  request: 30,
  notice: 28,
  privacy: 30,
  settings: 30,
  ping: 30,
  away: 28,
  tour: 30,
};

// iPhone-like springy morph
export const MORPH = { type: "spring", stiffness: 420, damping: 36, mass: 0.9 } as const;
