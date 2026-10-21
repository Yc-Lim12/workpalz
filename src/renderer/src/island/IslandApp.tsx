import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import Island, { type PillInfo } from "./Island";
import { AMBER, BLUE, type IslandView } from "./theme";
import { AskView, CheckInView, MenuView, NoticeView, PingView, PrivacyView, RequestView, SettingsView, displayShortcut, isMac, loadShortcuts } from "./views";
import type { Colleague, Employee, IslandLayout, Notice, Ping, SupportRequest } from "../../../shared/types";

const api = window.workpalz;
const FOCUS_MS = 25 * 60 * 1000;
const MENU_AUTO_CLOSE_MS = 8000;
// The idle pill hides itself so it stops covering other apps (a running focus timer stays)
const IDLE_HIDE_MS = 10 * 60 * 1000;

const mmss = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

export default function IslandApp() {
  const [view, setView] = useState<IslandView>("pill");
  const [layout, setLayout] = useState<IslandLayout>({ notch: false, topInset: 0 });
  const [me, setMe] = useState<Employee | null>(null);
  const [question, setQuestion] = useState("");
  const [pending, setPending] = useState(false);
  const [requests, setRequests] = useState<SupportRequest[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [colleagues, setColleagues] = useState<Colleague[]>([]);
  const [pings, setPings] = useState<Ping[]>([]);
  const [focusEnd, setFocusEnd] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [flash, setFlash] = useState<string | null>(null);
  const [announce, setAnnounce] = useState("");
  const [hidden, setHidden] = useState(false);
  const [lastActive, setLastActive] = useState(Date.now());

  const contentRef = useRef<HTMLDivElement>(null);
  const hovering = useRef(false);
  const closeTimer = useRef<number | null>(null);
  const prevUnread = useRef(0);
  const viewRef = useRef(view);
  viewRef.current = view;
  const hiddenRef = useRef(hidden);
  hiddenRef.current = hidden;
  
  const toggleFocusRef = useRef<() => void>(() => {});
  const lastOpened = useRef(0); 

  // The island window is big and see-through, and sits on top of every app. It only catches
  // clicks while the pointer is actually on the island (or the hide bar); everywhere else,
  // clicks go to the app underneath. Decided from the pointer's position, so it can't get stuck.
  const interactive = useRef(false);
  const pointer = useRef<{ x: number; y: number } | null>(null);
  const setInteractive = (on: boolean) => {
    if (interactive.current === on) return;
    interactive.current = on;
    api.setInteractive(on);
  };
  const recheckPointer = () => {
    const p = pointer.current;
    const el = p ? document.elementFromPoint(p.x, p.y) : null;
    setInteractive(!!el?.closest(".island-shell, [data-island-hit]"));
  };

  const unread = notices.filter((n) => !n.read);
  const openRequests = requests.filter((r) => r.status !== "resolved").length;

  const clearClose = () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    closeTimer.current = null;
  };

  const say = (text: string) => {
    setAnnounce("");
    window.setTimeout(() => setAnnounce(text), 50); 
  };

  const showFlash = (text: string) => {
    setHidden(false);
    setFlash(text);
    say(text);
    window.setTimeout(() => setFlash(null), 3000);
  };

  const open = useCallback((v: IslandView, userAction = true) => {
    clearClose();
    setHidden(false);
    if (userAction && v !== "pill") api.focusIsland();
    lastOpened.current = Date.now(); 
    setView(v);
  }, []);

  const collapse = useCallback(() => {
    clearClose();
    setView("pill");
    if (document.hasFocus()) api.releaseFocus();
  }, []);

  const hide = useCallback(() => {
    collapse();
    setHidden(true);
    hovering.current = false;
    setInteractive(false);
  }, [collapse]);

  // Tell them how to get it back, then hide. An auto-hide is called off if they're using it.
  const hideWithHint = useCallback((auto: boolean) => {
    const key = loadShortcuts().toggle;
    const where = isMac ? "menu bar" : "system tray";
    collapse();
    setFlash(key ? `${displayShortcut(key)} to show` : `Show it from the ${where}`);
    say(`WorkPalz will hide. ${key ? `Press ${displayShortcut(key)}, click the bar at the top, or use` : "Click the bar at the top, or use"} the WorkPalz icon in the ${where} to bring it back`);
    window.setTimeout(() => {
      setFlash(null);
      if (auto && hovering.current) setLastActive(Date.now());
      else hide();
    }, 2500);
  }, [collapse, hide]);

  const unhide = () => {
    setHidden(false);
    setLastActive(Date.now());
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      pointer.current = { x: e.clientX, y: e.clientY };
      recheckPointer();
    };
    const onLeave = () => {
      pointer.current = null;
      setInteractive(false);
    };
    document.addEventListener("mousemove", onMove);
    document.documentElement.addEventListener("mouseleave", onLeave);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.documentElement.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  // The island grows or shrinks when the view changes, so the still pointer may now be on or off it
  useEffect(() => {
    const id = window.setTimeout(recheckPointer, 450);
    return () => window.clearTimeout(id);
  }, [view, hidden]);

  const refresh = useCallback(async () => {
    const [r, n, pg] = await Promise.all([api.listMyRequests(), api.listMyNotices(), api.listMyPings()]);
    setRequests(r);
    setNotices(n);
    setPings(pg);
  }, []);

  useEffect(() => {
    api.setShortcuts(loadShortcuts());

    const savedTheme = localStorage.getItem('app-theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);

    api.getMe().then(setMe);
    api.getQuestion().then(setQuestion);
    api.getLayout().then(setLayout);
    api.listColleagues().then(setColleagues);
    refresh();
    return api.onDataChanged(() => {
      refresh();
      api.getMe().then(setMe);
    });
  }, [refresh]);

  useEffect(() => {
    if (unread.length > prevUnread.current && viewRef.current === "pill") {
      open("notice", false);
      say(unread[0].from ? `${unread[0].title}: ${unread[0].body}` : `Update from HR: ${unread[0].title}`);
    }
    prevUnread.current = unread.length;
  }, [unread, open]);

  useEffect(
    () =>
      api.onIslandEvent((ev) => {
        if (ev.type === "layout") setLayout(ev.layout);
        if (ev.type === "checkin-prompt") {
          setHidden(false);
          setPending(true);
          say("Weekly check-in is ready");
        }
        
        if (ev.type === "open") {
          viewRef.current !== "pill" ? collapse() : open("menu");
        }
        if (ev.type === "open-ask") {
          viewRef.current === "ask" ? collapse() : open("ask");
        }
        if (ev.type === "open-request") {
          viewRef.current === "request" ? collapse() : open("request");
        }
        if (ev.type === "open-ping") {
          viewRef.current === "ping" ? collapse() : open("ping");
        }
        if (ev.type === "toggle-focus") {
          toggleFocusRef.current();
        }
        if (ev.type === "show") {
          setHidden(false);
          setLastActive(Date.now());
        }
        if (ev.type === "hide") hide();
        if (ev.type === "toggle-hidden") {
          if (hiddenRef.current) {
            setHidden(false);
            setLastActive(Date.now());
          } else hide();
        }

        if (ev.type === "blur" && viewRef.current !== "pill" && viewRef.current !== "notice") {
          setTimeout(() => {
            if (Date.now() - lastOpened.current > 200) {
              clearClose();
              setView("pill");
            }
          }, 50);
        }
        if (ev.type === "collapse") {
          setPending(false);
          setFocusEnd(null);
          collapse();
        }
      }),
    [open, collapse, hide]
  );

  // Auto-hide the idle pill; any activity, a running focus timer or something new keeps it up
  useEffect(() => {
    if (hidden || view !== "pill" || focusEnd || unread.length || flash) return;
    const id = window.setTimeout(() => hideWithHint(true), IDLE_HIDE_MS);
    return () => window.clearTimeout(id);
  }, [hidden, view, focusEnd, unread.length, flash, lastActive, hideWithHint]);

  const toggleFocus = () => {
    if (focusEnd) {
      setFocusEnd(null);
      say("Focus timer stopped");
    } else {
      setNow(Date.now());
      setFocusEnd(Date.now() + FOCUS_MS);
      say("Focus timer started, 25 minutes");
    }
    collapse();
  };
  toggleFocusRef.current = toggleFocus;

  useEffect(() => {
    if (!focusEnd) return;
    const id = window.setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= focusEnd) {
        setFocusEnd(null);
        showFlash("Focus session done");
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [focusEnd]);

  useEffect(() => {
    if (view === "pill") return;
    const id = window.setTimeout(() => {
      const root = contentRef.current;
      if (!root || !document.hasFocus() || root.contains(document.activeElement)) return;
      const el =
        root.querySelector<HTMLElement>("[data-autofocus]") ??
        root.querySelector<HTMLElement>('input, textarea, select, [href], button:not([aria-label="Back to menu"])');
      el?.focus();
    }, 280);
    return () => window.clearTimeout(id);
  }, [view, layout]);

  const scheduleClose = useCallback(() => {
    clearClose();
    closeTimer.current = window.setTimeout(() => {
      const focusInside = document.hasFocus() && contentRef.current?.contains(document.activeElement);
      if (!hovering.current && !focusInside && viewRef.current === "menu") setView("pill");
    }, MENU_AUTO_CLOSE_MS);
  }, []);

  useEffect(() => {
    if (view === "menu") scheduleClose();
    return clearClose;
  }, [view, scheduleClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && viewRef.current !== "pill") collapse();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [collapse]);

  // Clickability is handled by the pointer tracking above; hover only keeps the menu open
  const handleHover = (on: boolean) => {
    if (hiddenRef.current) return;
    if (on) setLastActive(Date.now());
    hovering.current = on;
    if (!on && viewRef.current === "menu") scheduleClose();
  };

  const pill: PillInfo = flash
    ? { label: flash, color: BLUE, ariaLabel: `${flash}. Open WorkPalz` }
    : unread.length
      ? unread[0].from
        ? { label: unread[0].title, color: BLUE, pulse: true, ariaLabel: `${unread[0].title}. Open to read` }
        : { label: "Update from HR", color: BLUE, pulse: true, ariaLabel: "New update from HR. Open to read" }
      : focusEnd
        ? {
            label: "Focus",
            time: mmss(focusEnd - now),
            color: BLUE,
            ariaLabel: `Focus timer, ${Math.ceil((focusEnd - now) / 60000)} minutes left. Open WorkPalz`,
          }
        : pending
          ? { label: "Weekly check-in", color: AMBER, pulse: true, ariaLabel: "Weekly check-in is ready. Open to answer" }
          : {
              label: "WorkPalz",
              time: me ? `Wk ${me.week}` : undefined,
              color: BLUE,
              ariaLabel: `WorkPalz, onboarding week ${me?.week ?? ""}. Open menu`,
            };

  const onPillClick = () => {
    if (unread.length) open("notice");
    else if (pending && !focusEnd) open("checkin");
    else open("menu");
  };

  return (
    <MotionConfig reducedMotion="user">
      <main aria-label="WorkPalz" className="relative flex h-full w-full items-start justify-center" style={{ paddingTop: layout.notch ? 0 : 6 }}>
        <motion.div
          animate={hidden ? { opacity: 0, y: -24, scale: 0.9 } : { opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          style={{ pointerEvents: hidden ? "none" : "auto" }}
          aria-hidden={hidden}
        >
          <Island
            view={view}
            layout={layout}
            pill={pill}
            onPillClick={onPillClick}
            onHoverChange={handleHover}
            contentRef={contentRef}
          >
            {view === "menu" && (
              <MenuView
                pending={pending}
                focusRunning={!!focusEnd}
                focusLeft={focusEnd ? mmss(focusEnd - now) : ""}
                openRequests={openRequests}
                onOpen={(v) => open(v)}
                onToggleFocus={toggleFocus}
                onHide={() => hideWithHint(false)}
                onClose={collapse}
              />
            )}
            {view === "checkin" && (
              <CheckInView
                question={question}
                onClose={collapse}
                onBack={() => open("menu")}
                onSubmit={async (input) => {
                  await api.submitCheckIn(input);
                  setPending(false);
                  collapse();
                  showFlash("Thanks, check-in sent");
                }}
              />
            )}
            {view === "ask" && <AskView onAsk={api.ask} onOpenLink={api.openLink} onBack={() => open("menu")} />}
            {view === "request" && (
              <RequestView
                mine={requests}
                onClose={collapse}
                onBack={() => open("menu")}
                onSubmit={async (input) => {
                  await api.submitRequest(input);
                  collapse();
                  showFlash("Request sent");
                }}
              />
            )}
            {view === "ping" && (
            <PingView
              colleagues={colleagues}
              mine={pings}
              onBack={() => open("menu")}
              onSubmit={async (input) => {
                await api.sendPing(input);
                const c = colleagues.find((x) => x.id === input.colleagueId);
                collapse();
                showFlash(c ? `Pinged ${c.name.split(" ")[0]}` : "Ping sent");
              }}
            />
          )}
          {view === "notice" && unread[0] && (
              <NoticeView
                notice={unread[0]}
                more={unread.length - 1}
                onDone={async () => {
                  await api.markNoticeRead(unread[0].id);
                  if (unread.length <= 1) collapse();
                }}
              />
            )}
            {view === "notice" && !unread[0] && <EmptyCollapse onCollapse={collapse} />}
            {view === "privacy" && (
              <PrivacyView getData={api.getMyData} onExport={api.exportMyData} onDelete={api.deleteMyData} onBack={() => open("menu")} />
            )}
            {view === "settings" && (
              <SettingsView onBack={() => open("menu")} />
            )}
          </Island>
        </motion.div>

        {/* While hidden, a small bar stays at the top so people know where it went. Click, not hover,
            so reaching for browser tabs doesn't pop it open. */}
        <AnimatePresence>
          {hidden && (
            <motion.button
              type="button"
              aria-label="Show WorkPalz"
              title="Show WorkPalz"
              onClick={unhide}
              data-island-hit
              initial={{ opacity: 0, scaleX: 0.4 }}
              animate={{ opacity: 1, scaleX: 1 }}
              exit={{ opacity: 0, scaleX: 0.4 }}
              transition={{ delay: 0.2, duration: 0.2 }}
              className="group absolute left-1/2 -translate-x-1/2 cursor-pointer px-3 py-2"
              style={{ top: layout.notch ? layout.topInset : 0 }}
            >
              <span className="block h-[5px] w-12 rounded-full opacity-60 shadow-[0_1px_4px_rgba(0,0,0,0.3)] transition-all group-hover:w-16 group-hover:opacity-100 [background-color:var(--muted)]" />
            </motion.button>
          )}
        </AnimatePresence>

        <div role="status" aria-live="polite" className="sr-only">
          {announce}
        </div>
      </main>
    </MotionConfig>
  );
}

function EmptyCollapse({ onCollapse }: { onCollapse: () => void }) {
  useEffect(() => {
    onCollapse();
  }, [onCollapse]);
  return null;
}