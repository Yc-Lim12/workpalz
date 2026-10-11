// Small shared building blocks for the island views.
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

export function Header({
  color,
  title,
  right,
  id,
  onBack,
}: {
  color: string;
  title: string;
  right?: ReactNode;
  id?: string;
  onBack?: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to menu"
          className="-ml-2 flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-[#E4E6EA] hover:bg-[#1C1D21]"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
      ) : (
        <Dot color={color} />
      )}
      <h2 id={id} className="m-0 text-[13px] font-semibold" style={{ color: color === "#FFA94D" ? "#FFC98A" : "#F4F5F7" }}>
        {title}
      </h2>
      {right && (
        <span className="ml-auto text-[12px]" style={{ color: MUTED }}>
          {right}
        </span>
      )}
    </div>
  );
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger" };

const VARIANT = {
  primary: "bg-[#FFA94D] text-[#0B0C0E]",
  secondary: "bg-[#2A2D33] text-[#F4F5F7] hover:bg-[#33363D]",
  ghost: "bg-transparent text-[#C3C7CF] hover:bg-[#1C1D21]",
  danger: "bg-[#5C1E14] text-[#FFD9CF] hover:bg-[#6E251A]",
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

// Radio/checkbox styled as a tile, but a real input underneath (keyboard + screen readers work natively)
export function Choice({
  type,
  name,
  checked,
  onChange,
  children,
  activeBg,
  className = "",
}: {
  type: "radio" | "checkbox";
  name: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
  activeBg: string;
  className?: string;
}) {
  return (
    <label className="block cursor-pointer">
      <input
        type={type}
        name={name}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <span
        className={`choice-face flex items-center justify-center rounded-xl text-center font-semibold transition ${className}`}
        style={{ background: checked ? activeBg : "#1C1D21", color: checked ? "#0B0C0E" : "#E4E6EA" }}
      >
        {children}
      </span>
    </label>
  );
}

export const inputClass =
  "w-full rounded-xl bg-[#1C1D21] px-3.5 text-[14px] text-[#F4F5F7] placeholder-[#8E949E]";
