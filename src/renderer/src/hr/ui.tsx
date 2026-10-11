// Shared bits for the HR dashboard. Colours chosen for WCAG AA contrast on white and #F6F7F9.
import type { ButtonHTMLAttributes, ReactNode } from "react";

export const C = {
  text: "#14161A",
  muted: "#545B69", // 6.9:1 on white
  border: "#D5D9E0",
  blue: "#1F5FE0", // white text 5.5:1
  blueText: "#163F99",
  amberBg: "#FFF4E8",
  amberText: "#7A3C00",
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
  return <Tag className={`rounded-2xl bg-white p-5 ${className}`}>{children}</Tag>;
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
  primary: "bg-[#1F5FE0] text-white hover:bg-[#1A52C4]",
  dark: "bg-[#14161A] text-white hover:bg-[#2A2D33]",
  ghost: "bg-transparent text-[#3A404B] hover:bg-[#E6E8EC]",
  muted: "bg-[#E6E8EC] text-[#2E333C]",
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
    <p className="m-0 rounded-2xl border border-dashed border-[#B8BEC8] bg-white p-8 text-center text-[14px]" style={{ color: C.muted }}>
      {children}
    </p>
  );
}

export const SOURCE_LABEL = { "check-in": "Check-in", question: "Question", request: "Request" } as const;
