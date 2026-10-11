// The black island shell: morphs between views with a spring, merges into the MacBook notch.
import { type ReactNode, type RefObject } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { IslandLayout } from "../../../shared/types";
import { MORPH, NOTCH_GAP, NOTCH_PILL_WIDTH, RADIUS, WIDTH, type IslandView } from "./theme";
import { Dot } from "./ui";

export type PillInfo = { label: string; time?: string; color: string; pulse?: boolean; ariaLabel: string };

type Props = {
  view: IslandView;
  layout: IslandLayout;
  pill: PillInfo;
  onPillClick: () => void;
  onHoverChange: (hovering: boolean) => void;
  contentRef: RefObject<HTMLDivElement>;
  children: ReactNode; // the expanded view
};

const contentAnim = {
  initial: { opacity: 0, filter: "blur(4px)" },
  animate: { opacity: 1, filter: "blur(0px)", transition: { delay: 0.06, duration: 0.2 } },
  exit: { opacity: 0, filter: "blur(4px)", transition: { duration: 0.1 } },
};

export default function Island({ view, layout, pill, onPillClick, onHoverChange, contentRef, children }: Props) {
  const isPill = view === "pill";
  const notch = layout.notch;
  const width = isPill && notch ? NOTCH_PILL_WIDTH : WIDTH[view];
  const r = RADIUS[view];
  const top = notch ? Math.min(r, 12) : r; // flatter top corners where it meets the notch

  return (
    <motion.div
      layout
      transition={MORPH}
      onMouseEnter={() => onHoverChange(true)}
      onMouseLeave={() => onHoverChange(false)}
      className="island-shell overflow-hidden bg-black text-[#F4F5F7] shadow-[0_14px_40px_rgba(0,0,0,0.55)]"
      style={{
        width,
        borderTopLeftRadius: top,
        borderTopRightRadius: top,
        borderBottomLeftRadius: r,
        borderBottomRightRadius: r,
      }}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={isPill ? "pill" : view} layout="position" {...contentAnim}>
          {isPill ? (
            <PillContent pill={pill} notch={notch} height={notch ? layout.topInset : 40} onClick={onPillClick} />
          ) : (
            <div ref={contentRef} className="px-5 pb-5" style={{ paddingTop: notch ? layout.topInset + 10 : 18 }}>
              {children}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}

function PillContent({ pill, notch, height, onClick }: { pill: PillInfo; notch: boolean; height: number; onClick: () => void }) {
  if (notch) {
    // Content sits either side of the notch; the middle is hidden behind it
    const side = (NOTCH_PILL_WIDTH - NOTCH_GAP) / 2;
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={pill.ariaLabel}
        className="flex w-full cursor-pointer items-center justify-between px-4"
        style={{ height }}
      >
        <span className="flex items-center gap-2 overflow-hidden" style={{ width: side - 16 }}>
          <Dot color={pill.color} pulse={pill.pulse} />
          <span className="truncate text-[12.5px] font-semibold">{pill.label}</span>
        </span>
        <span className="mono truncate text-right text-[12.5px] text-[#A1A6B0]" style={{ width: side - 16 }}>
          {pill.time ?? ""}
        </span>
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={pill.ariaLabel}
      className="flex w-full cursor-pointer items-center justify-center gap-2.5 px-4"
      style={{ height }}
    >
      <Dot color={pill.color} pulse={pill.pulse} />
      <span className="truncate text-[14px] font-semibold">{pill.label}</span>
      {pill.time && <span className="mono text-[13px] text-[#A1A6B0]">{pill.time}</span>}
    </button>
  );
}
