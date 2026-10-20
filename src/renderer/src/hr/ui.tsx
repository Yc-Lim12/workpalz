// Shared bits for the HR dashboard. Colours are theme variables (index.css), WCAG AA in light and dark.
import type { ButtonHTMLAttributes, ReactNode } from "react";

export const C = {
  text: "var(--hr-text)",
  muted: "var(--hr-muted)", // 6.6:1 or better on surfaces in both themes
  border: "var(--hr-border)",
  blue: "var(--hr-blue)",
  blueText: "var(--hr-blue-text)",
  amberBg: "var(--hr-amber-soft)",
  amberText: "var(--hr-amber-fg)",
};

export function ago(iso: string) {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return d === 1 ? "yesterday" : `${d} days ago`;
}

export function Card({ children, className = "", as: Tag = "div" }: { children: ReactNode; className?: string; as?: "div" | "section" | "article" }) {
  return <Tag className={`rounded-2xl bg-[color:var(--hr-surface)] p-5 ${className}`}>{children}</Tag>;
}

export function Chip({ children, bg, fg }: { children: ReactNode; bg: string; fg: string }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold" style={{ background: bg, color: fg }}>
      {children}
    </span>
  );
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "dark" | "ghost" | "muted" };
const V = {
  primary: "bg-[color:var(--hr-blue-bg)] text-white hover:bg-[color:var(--hr-blue-bg-hover)]",
  dark: "bg-[color:var(--hr-inverse)] text-white hover:bg-[color:var(--hr-inverse-hover)]",
  ghost: "bg-transparent text-[color:var(--hr-text3)] hover:bg-[color:var(--hr-chip)]",
  muted: "bg-[color:var(--hr-chip)] text-[color:var(--hr-text2)]",
};
export function Button({ variant = "primary", className = "", ...rest }: BtnProps) {
  return (
    <button
      type="button"
      {...rest}
      className={`min-h-11 cursor-pointer rounded-xl px-4 text-[14px] font-semibold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70 ${V[variant]} ${className}`}
    />
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="m-0 rounded-2xl border border-dashed border-[color:var(--hr-dashed)] bg-[color:var(--hr-surface)] p-8 text-center text-[14px]" style={{ color: C.muted }}>
      {children}
    </p>
  );
}

export const SOURCE_LABEL = { "check-in": "Check-in", question: "Question", request: "Request" } as const;
