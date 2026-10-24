import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import Island, { type PillInfo } from "./Island";
import { AMBER, BLUE, type IslandView } from "./theme";
import { AskView, CheckInThanksView, CheckInView, clearAskHistory, MenuView, NoticeView, PingView, PrivacyView, RequestView, SettingsView, StepBackView, TourView, displayShortcut, isMac, loadShortcuts } from "./views";
import { REQUEST_CATEGORIES } from "../../../shared/types";
import type { CheckInReply, Colleague, Employee, IslandLayout, Notice, Ping, SupportRequest } from "../../../shared/types";

const api = window.workpalz;
const FOCUS_MS = 25 * 60 * 1000;
const MENU_AUTO_CLOSE_MS = 8000;
// The idle pill shrinks to a small dot so it's in the way less, but never disappears by itself.
// It stays full size while it has something for you (an update, a check-in, a running focus timer).
const IDLE_SHRINK_MS = 10 * 60 * 1000;
const TOUR_KEY = "tour-done";
const QUIET_KEY = "quiet-until";

const readQuiet = () => {
  try {
    const v = Number(localStorage.getItem(QUIET_KEY));
    return v > Date.now() ? v : null;
  } catch {
    return null;
  }
};
const clock = (t: number) => new Date(t).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

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
  const [mini, setMini] = useState(false);
  const [checkInReply, setCheckInReply] = useState<CheckInReply | null>(null);
  // Quiet (do not disturb): nothing pops up; anything waiting shows as a number by the clock
  const [quietUntil, setQuietUntil] = useState<number | null>(readQuiet);
  const [lastActive, setLastActive] = useState(Date.now());
  const quiet = quietUntil !== null;
  const away = hidden || quiet;

  const contentRef = useRef<HTMLDivElement>(null);
  const hovering = useRef(false);
  const closeTimer = useRef<number | null>(null);
  const prevUnread = useRef(0);
  const viewRef = useRef(view);
  viewRef.current = view;
  const hiddenRef = useRef(away);
  hiddenRef.current = away;
  const quietRef = useRef(quiet);
  quietRef.current = quiet;
  
  const toggleFocusRef = useRef<() => void>(() => {});
  const attentionRef = useRef(0);
  const focusEndRef = useRef<number | null>(null);
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

  const setQuiet = (until: number | null) => {
    setQuietUntil(until);
    try {
      if (until) localStorage.setItem(QUIET_KEY, String(until));
      else localStorage.removeItem(QUIET_KEY);
    } catch {}
  };

  const flashTimer = useRef<number | undefined>(undefined);
  const showFlash = (text: string) => {
    if (!quietRef.current) setHidden(false);
    setMini(false);
    setFlash(text);
    say(text);
    window.clearTimeout(flashTimer.current); // a newer message gets its full 3 seconds
    flashTimer.current = window.setTimeout(() => setFlash(null), 3000);
  };

  // The 2.5 s "how to bring it back" hint before hiding: cancelled if they open it again meanwhile
  const stepBackTimer = useRef<number | undefined>(undefined);
  const cancelStepBack = () => window.clearTimeout(stepBackTimer.current);

  const open = useCallback((v: IslandView, userAction = true) => {
    clearClose();
    if (userAction) cancelStepBack();
    setHidden(false);
    setMini(false);
    if (userAction) setQuiet(null); // opening it yourself ends Quiet
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

  // Tell them how to get it back, then step back (hide for now, or Quiet until a time)
  const stepBackWithHint = (quietTill: number | null) => {
    const key = loadShortcuts().toggle;
    const where = isMac ? "menu bar" : "system tray";
    collapse();
    setFlash(quietTill ? `Quiet until ${clock(quietTill)}` : key ? `${displayShortcut(key)} to show` : `Show it from the ${where}`);
    say(
      `${quietTill ? `Quiet until ${clock(quietTill)}. Nothing will pop up; anything waiting shows as a number on the WorkPalz icon in the ${where}.` : "WorkPalz will hide."} ${
        key ? `Press ${displayShortcut(key)}, or use` : "Use"
      } the WorkPalz icon in the ${where} to bring it back`
    );
    cancelStepBack();
    stepBackTimer.current = window.setTimeout(() => {
      setFlash(null);
      if (quietTill) {
        setQuiet(quietTill);
        hovering.current = false;
        setInteractive(false);
      } else hide();
    }, 2500);
  };

  const unhide = () => {
    cancelStepBack();
    setHidden(false);
    setQuiet(null);
    setMini(false);
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
  }, [view, hidden, mini, quiet]);

  const refresh = useCallback(async () => {
    const [r, n, pg] = await Promise.all([api.listMyRequests(), api.listMyNotices(), api.listMyPings()]);
    setRequests(r);
    setNotices(n);
    setPings(pg);
  }, []);

  useEffect(() => {
    api.setShortcuts(loadShortcuts());

    let savedTheme = "dark";
    try {
      savedTheme = localStorage.getItem("app-theme") || "dark";
    } catch {}
    document.documentElement.setAttribute("data-theme", savedTheme);

    api.getMe().then(setMe);
    api.getQuestion().then(setQuestion);
    api.getLayout().then(setLayout);
    api.listColleagues().then(setColleagues);
    refresh();

    // First day: open once by itself and show how WorkPalz works
    let tour: number | undefined;
    try {
      if (!localStorage.getItem(TOUR_KEY)) {
        // Only once, however it gets closed (Got it, Skip, Esc, clicking away)
        localStorage.setItem(TOUR_KEY, "1");
        tour = window.setTimeout(() => open("tour", false), 1200);
      }
    } catch {}
    const stop = api.onDataChanged(() => {
      refresh();
      api.getMe().then(setMe);
    });
    return () => {
      window.clearTimeout(tour);
      stop();
    };
  }, [refresh, open]);

  useEffect(() => {
    // During Quiet nothing pops up: the update waits, counted on the tray icon
    if (unread.length > prevUnread.current && viewRef.current === "pill" && !quietRef.current) {
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
          if (!quietRef.current) setHidden(false);
          setMini(false);
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
        if (ev.type === "show") unhide();
        if (ev.type === "hide") hide();
        if (ev.type === "toggle-hidden") {
          if (hiddenRef.current) unhide();
          else hide();
        }
        // Same rule as the idle timer: never shrink while a focus timer runs or something is waiting
        if (ev.type === "idle" && !focusEndRef.current && !attentionRef.current) setMini(true);
        if (ev.type === "quiet") {
          if (ev.until === "off") unhide();
          else {
            collapse();
            setQuiet(ev.until === "hour" ? Date.now() + 60 * 60 * 1000 : tomorrowMorning());
            hovering.current = false;
            setInteractive(false);
          }
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

  // Shrink the idle pill; any activity, a running focus timer or something waiting keeps it full size
  useEffect(() => {
    if (away || mini || view !== "pill" || focusEnd || unread.length || pending || flash) return;
    const id = window.setTimeout(() => setMini(true), IDLE_SHRINK_MS);
    return () => window.clearTimeout(id);
  }, [away, mini, view, focusEnd, unread.length, pending, flash, lastActive]);

  // Quiet ends by itself at the chosen time. Checked every minute (and on waking), because a
  // single long timer doesn't count time the laptop spent asleep.
  useEffect(() => {
    if (!quietUntil) return;
    const check = () => {
      if (Date.now() >= quietUntil) setQuiet(null);
    };
    const id = window.setInterval(check, 60 * 1000);
    const first = window.setTimeout(check, Math.max(0, Math.min(quietUntil - Date.now(), 60 * 1000)));
    window.addEventListener("focus", check);
    return () => {
      window.clearInterval(id);
      window.clearTimeout(first);
      window.removeEventListener("focus", check);
    };
  }, [quietUntil]);

  // The tray / menu bar icon shows how many things are waiting, and whether Quiet is on
  const attention = unread.length + (pending ? 1 : 0);
  attentionRef.current = attention;
  focusEndRef.current = focusEnd;
  useEffect(() => {
    api.reportStatus({ attention, quietUntil });
  }, [attention, quietUntil]);

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
        root.querySelector<HTMLElement>('input, textarea, select, [href], button:not([aria-label^="Back to"])');
      el?.focus();
    }, 280);
    return () => window.clearTimeout(id);
  }, [view, layout]);

  // Inside a view, the focused button can disappear (Continue, Change, a quick button, an Ask chip).
  // Then focus would fall to nothing and a keyboard user starts from scratch: put it back on the
  // view's main field instead.
  useEffect(() => {
    const onOut = () =>
      window.setTimeout(() => {
        if (viewRef.current === "pill" || !document.hasFocus()) return;
        if (document.activeElement && document.activeElement !== document.body) return;
        const root = contentRef.current;
        const el =
          root?.querySelector<HTMLElement>("[data-autofocus]") ??
          root?.querySelector<HTMLElement>('input, textarea, select, [href], button:not([aria-label^="Back to"])');
        el?.focus();
      }, 0);
    document.addEventListener("focusout", onOut);
    return () => document.removeEventListener("focusout", onOut);
  }, []);

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
    if (on) {
      setLastActive(Date.now());
      setMini(false); // hovering the small dot brings the full pill back
    }
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
          animate={away ? { opacity: 0, y: -24, scale: 0.9 } : { opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          style={{ pointerEvents: away ? "none" : "auto" }}
          aria-hidden={away}
        >
          <Island
            view={view}
            mini={mini && view === "pill"}
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
                onHide={() => open("away")}
                onClose={collapse}
              />
            )}
            {view === "checkin" && (
              <CheckInView
                question={question}
                onClose={collapse}
                onBack={() => open("menu")}
                onSubmit={async (input) => {
                  const reply = await api.submitCheckIn(input);
                  setPending(false);
                  if (reply.tip || reply.openRequest) {
                    setCheckInReply(reply); // something useful to give back
                    open("thanks", false);
                  } else {
                    collapse();
                    showFlash("Thanks, check-in sent");
                  }
                }}
              />
            )}
            {view === "ask" && <AskView onAsk={api.ask} onOpenLink={api.openLink} onBack={() => open("menu")} />}
            {view === "request" && (
              <RequestView
                mine={requests}
                onSuggest={api.suggestRequest}
                onOpenLink={api.openLink}
                onSolved={async (tipId) => {
                  await api.solvedByGuide(tipId);
                  collapse();
                  showFlash("Glad it's sorted");
                }}
                onClose={collapse}
                onBack={() => open("menu")}
                onSubmit={async (input) => {
                  await api.submitRequest(input);
                  collapse();
                  const dept = REQUEST_CATEGORIES.find((c) => c.id === input.category)?.dept ?? "IT";
                  showFlash(`Sent to ${dept}`);
                  say(`Request sent to ${dept}. You'll get updates here.`);
                }}
              />
            )}
            {view === "ping" && (
            <PingView
              colleagues={colleagues}
              onSuggest={api.suggestColleague}
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
              <PrivacyView
                getData={api.getMyData}
                onExport={api.exportMyData}
                onDelete={async () => {
                  await api.deleteMyData();
                  clearAskHistory(); // recent questions live on this computer: delete them too
                }}
                onBack={() => open("menu")}
              />
            )}
            {view === "settings" && (
              <SettingsView onBack={() => open("menu")} onReplayTour={() => open("tour")} />
            )}
            {view === "thanks" && checkInReply && (
              <CheckInThanksView reply={checkInReply} onOpenLink={api.openLink} onDone={collapse} />
            )}
            {view === "away" && (
              <StepBackView
                onBack={() => open("menu")}
                onHide={() => stepBackWithHint(null)}
                onQuietHour={() => stepBackWithHint(Date.now() + 60 * 60 * 1000)}
                onQuietTomorrow={() => stepBackWithHint(tomorrowMorning())}
              />
            )}
            {view === "tour" && (
              <TourView
                name={me?.name.split(" ")[0] ?? ""}
                shortcut={displayShortcut(loadShortcuts().main)}
                where={isMac ? "menu bar" : "system tray"}
                onDone={() => {
                  try {
                    localStorage.setItem(TOUR_KEY, "1");
                  } catch {}
                  collapse();
                }}
              />
            )}
          </Island>
        </motion.div>

        {/* While hidden, a small bar stays at the top so people know where it went. Click, not hover,
            so reaching for browser tabs doesn't pop it open. */}
        <AnimatePresence>
          {hidden && !quiet && (
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

// Quiet "until tomorrow" means until 9 am the next day
function tomorrowMorning() {
  const t = new Date();
  t.setDate(t.getDate() + 1);
  t.setHours(9, 0, 0, 0);
  return t.getTime();
}

function EmptyCollapse({ onCollapse }: { onCollapse: () => void }) {
  useEffect(() => {
    onCollapse();
  }, [onCollapse]);
  return null;
}