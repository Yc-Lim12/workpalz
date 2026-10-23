// The island shell: morphs between views with a spring, merges into the MacBook notch.
import { type ReactNode, type RefObject } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { IslandLayout } from "../../../shared/types";
import { ISLAND_MAX_HEIGHT, MINI_HEIGHT, MINI_SIDE, MINI_WIDTH, MORPH, NOTCH_GAP, NOTCH_PILL_WIDTH, RADIUS, WIDTH, type IslandView } from "./theme";
import { Dot } from "./ui";

export type PillInfo = { label: string; time?: string; color: string; pulse?: boolean; ariaLabel: string };

type Props = {
  view: IslandView;
  mini?: boolean; // idle: shrunk to a small dot, still there and clickable
  layout: IslandLayout;
  pill: PillInfo;
  onPillClick: () => void;
  onHoverChange: (hovering: boolean) => void;
  contentRef: RefObject<HTMLDivElement>;
  children: ReactNode; 
};

// Added a subtle scale effect to make the content crossfade feel much more Apple-like
const contentAnim = {
  initial: { opacity: 0, filter: "blur(4px)", scale: 0.95 },
  animate: { opacity: 1, filter: "blur(0px)", scale: 1, transition: { delay: 0.05, duration: 0.25, ease: "easeOut" } },
  exit: { opacity: 0, filter: "blur(4px)", scale: 0.95, transition: { duration: 0.15, ease: "easeIn" } },
};

export default function Island({ view, mini = false, layout, pill, onPillClick, onHoverChange, contentRef, children }: Props) {
  const isPill = view === "pill";
  const notch = layout.notch;
  const width = isPill && mini ? (notch ? NOTCH_GAP + MINI_SIDE * 2 : MINI_WIDTH) : isPill && notch ? NOTCH_PILL_WIDTH : WIDTH[view];
  const r = isPill && mini && !notch ? MINI_HEIGHT / 2 : RADIUS[view];
  const top = notch ? Math.min(r, 12) : r; 

  // BUGFIX: Combining into a single borderRadius string allows Framer Motion to perfectly calculate the scale distortion!
  const borderRadius = `${top}px ${top}px ${r}px ${r}px`;

  return (
    <motion.div
      layout
      transition={MORPH}
      onMouseEnter={() => onHoverChange(true)}
      onMouseLeave={() => onHoverChange(false)}
      className="island-shell overflow-hidden shadow-[0_14px_40px_rgba(0,0,0,0.35)] [background-color:var(--island-bg)] [color:var(--ink)] border [border-color:var(--line)] relative origin-top"
      style={{ width, borderRadius }}
    >
      {/* BUGFIX: Changed from mode="wait" to mode="popLayout" so the height morphs smoothly and instantly */}
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div 
          key={isPill ? (mini ? "mini" : "pill") : view} 
          layout="position" 
          {...contentAnim}
          className="w-full flex flex-col justify-start"
        >
          {isPill ? (
            mini ? (
              <MiniContent pill={pill} notch={notch} height={notch ? layout.topInset : MINI_HEIGHT} onClick={onPillClick} />
            ) : (
              <PillContent pill={pill} notch={notch} height={notch ? layout.topInset : 40} onClick={onPillClick} />
            )
          ) : (
            // Never taller than the island's window: long views (or zoomed text) scroll instead of being cut off
            <div
              ref={contentRef}
              className="px-5 pb-5 w-full box-border overflow-y-auto"
              style={{ paddingTop: notch ? layout.topInset + 10 : 18, maxHeight: ISLAND_MAX_HEIGHT - (notch ? 0 : 6) }}
            >
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
    const side = (NOTCH_PILL_WIDTH - NOTCH_GAP) / 2;
    return (
      <button type="button" onClick={onClick} aria-label={pill.ariaLabel} className="flex w-full cursor-pointer items-center justify-between px-4" style={{ height }}>
        <span className="flex items-center gap-2 overflow-hidden" style={{ width: side - 16 }}>
          <Dot color={pill.color} pulse={pill.pulse} />
          <span className="truncate text-[12.5px] font-semibold">{pill.label}</span>
        </span>
        <span className="mono truncate text-right text-[12.5px] [color:var(--muted)]" style={{ width: side - 16 }}>
          {pill.time ?? ""}
        </span>
      </button>
    );
  }
  return (
    <button type="button" onClick={onClick} aria-label={pill.ariaLabel} className="flex w-full cursor-pointer items-center justify-center gap-2.5 px-4" style={{ height }}>
      <Dot color={pill.color} pulse={pill.pulse} />
      <span className="truncate text-[14px] font-semibold">{pill.label}</span>
      {pill.time && <span className="mono text-[13px] [color:var(--muted)]">{pill.time}</span>}
    </button>
  );
}

// The shrunk pill: just the status dot. Hover brings the full pill back, click opens it.
function MiniContent({ pill, notch, height, onClick }: { pill: PillInfo; notch: boolean; height: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={pill.ariaLabel}
      className={`flex w-full cursor-pointer items-center ${notch ? "justify-start" : "justify-center"}`}
      style={{ height, paddingLeft: notch ? MINI_SIDE / 2 - 4 : 0 }}
    >
      <Dot color={pill.color} pulse={pill.pulse} />
    </button>
  );
}
