import type { ButtonHTMLAttributes, ReactNode } from "react";
import { motion } from "framer-motion";
import { MUTED } from "./theme";

export function Dot({ color, pulse }: { color: string; pulse?: boolean }) {
  return (
    <span className="relative inline-flex h-2 w-2 shrink-0" aria-hidden="true">
      {pulse && (
        <motion.span
          className="absolute inset-0 rounded-full"
          style={{ background: color }}
          animate={{ scale: [1, 2.4], opacity: [0.7, 0] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: "easeOut" }}
        />
      )}
      <span className="relative inline-block h-2 w-2 rounded-full" style={{ background: color }} />
    </span>
  );
}

export function Header({ color, title, right, id, onBack, backLabel = "Back to menu" }: { color: string; title: string; right?: ReactNode; id?: string; onBack?: () => void; backLabel?: string; }) {
  return (
    <div className="flex items-center gap-2">
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          aria-label={backLabel}
          className="-ml-2 flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full transition [color:var(--ink)] hover:[background-color:var(--bg)]"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
      ) : (
        <Dot color={color} />
      )}
      <h2 id={id} className="m-0 text-[13px] font-semibold [color:var(--ink)]">{title}</h2>
      {right && <span className="ml-auto text-[12px]" style={{ color: MUTED }}>{right}</span>}
    </div>
  );
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger" };

const VARIANT = {
  primary: "[background-color:var(--amber)] [color:var(--surface)] hover:opacity-80",
  secondary: "[background-color:var(--surface)] [color:var(--ink)] border [border-color:var(--line)] hover:[background-color:var(--bg)]",
  ghost: "bg-transparent [color:var(--ink)] hover:[background-color:var(--bg)]",
  danger: "bg-red-600 text-white hover:opacity-80",
};

export function Btn({ variant = "secondary", className = "", ...rest }: BtnProps) {
  return (
    <button
      type="button"
      {...rest}
      className={`min-h-11 cursor-pointer rounded-[14px] px-4 text-[14px] font-semibold transition active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-45 ${VARIANT[variant]} ${className}`}
    />
  );
}

export function Choice({ type, name, checked, onChange, children, activeBg, className = "" }: { type: "radio" | "checkbox"; name: string; checked: boolean; onChange: (checked: boolean) => void; children: ReactNode; activeBg: string; className?: string; }) {
  return (
    <label className="block cursor-pointer">
      <input type={type} name={name} checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span
        className={`choice-face flex items-center justify-center rounded-xl text-center font-semibold transition border [border-color:var(--line)] ${className}`}
        style={{ 
          backgroundColor: checked ? activeBg : "var(--surface)", 
          color: checked ? "var(--surface)" : "var(--ink)" 
        }}
      >
        {children}
      </span>
    </label>
  );
}

export const inputClass =
  "w-full rounded-xl [background-color:var(--surface)] border [border-color:var(--line)] px-3.5 text-[14px] [color:var(--ink)] placeholder-[color:var(--muted)] outline-none focus:ring-2 focus:ring-[var(--blue)]";