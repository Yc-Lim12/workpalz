import { useCallback, useEffect, useRef, useState } from "react";
import { MotionConfig } from "framer-motion";
import Island, { type PillInfo } from "./Island";
import { AMBER, BLUE, type IslandView } from "./theme";
import { AskView, CheckInView, MenuView, NoticeView, PrivacyView, RequestView, SettingsView } from "./views";
import type { Employee, IslandLayout, Notice, SupportRequest } from "../../../shared/types";

const api = window.workpalz;
const FOCUS_MS = 25 * 60 * 1000;
const MENU_AUTO_CLOSE_MS = 8000;

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
  const [focusEnd, setFocusEnd] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [flash, setFlash] = useState<string | null>(null);
  const [announce, setAnnounce] = useState("");

  const contentRef = useRef<HTMLDivElement>(null);
  const hovering = useRef(false);
  const closeTimer = useRef<number | null>(null);
  const prevUnread = useRef(0);
  const viewRef = useRef(view);
  viewRef.current = view;
  
  const toggleFocusRef = useRef<() => void>(() => {});
  const lastOpened = useRef(0); 
  const isNavigating = useRef(false); // NEW: The shield!

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
    setFlash(text);
    say(text);
    window.setTimeout(() => setFlash(null), 3000);
  };

  const open = useCallback((v: IslandView, userAction = true) => {
    clearClose();
    if (userAction && v !== "pill") api.focusIsland();
    lastOpened.current = Date.now(); 
    
    // BUGFIX: Throw up the Navigation Shield for 400ms during the transition.
    // This forces the island to stay clickable even if Framer Motion shrinks it!
    isNavigating.current = true;
    setTimeout(() => { isNavigating.current = false; }, 400);
    api.setInteractive(true);
    hovering.current = true;

    setView(v);
  }, []);

  const collapse = useCallback(() => {
    clearClose();
    setView("pill");
    if (document.hasFocus()) api.releaseFocus();
  }, []);

  const refresh = useCallback(async () => {
    const [r, n] = await Promise.all([api.listMyRequests(), api.listMyNotices()]);
    setRequests(r);
    setNotices(n);
  }, []);

  useEffect(() => {
    const savedShortcuts = JSON.parse(localStorage.getItem('app-shortcuts') || '{"main":"Ctrl+Alt+Space","ask":"","request":"","focus":""}');
    // @ts-ignore
    if (api.setShortcuts) api.setShortcuts(savedShortcuts);

    const savedTheme = localStorage.getItem('app-theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);

    api.getMe().then(setMe);
    api.getQuestion().then(setQuestion);
    api.getLayout().then(setLayout);
    refresh();
    return api.onDataChanged(() => {
      refresh();
      api.getMe().then(setMe);
    });
  }, [refresh]);

  useEffect(() => {
    if (unread.length > prevUnread.current && viewRef.current === "pill") {
      open("notice", false);
      say(`Update from HR: ${unread[0].title}`);
    }
    prevUnread.current = unread.length;
  }, [unread, open]);

  useEffect(
    () =>
      api.onIslandEvent((ev: any) => {
        if (ev.type === "layout") setLayout(ev.layout);
        if (ev.type === "checkin-prompt") {
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
        if (ev.type === "toggle-focus") {
          toggleFocusRef.current();
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
    [open, collapse]
  );

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

  const handleHover = (on: boolean) => {
    // BUGFIX: If the animation is running, completely ignore fake mouse-leaves!
    if (isNavigating.current && !on) return; 

    hovering.current = on;
    api.setInteractive(on);
    if (!on && viewRef.current === "menu") scheduleClose();
  };

  const pill: PillInfo = flash
    ? { label: flash, color: BLUE, ariaLabel: `${flash}. Open WorkPalz` }
    : unread.length
      ? { label: "Update from HR", color: BLUE, pulse: true, ariaLabel: "New update from HR. Open to read" }
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
      <main aria-label="WorkPalz" className="flex h-full w-full items-start justify-center" style={{ paddingTop: layout.notch ? 0 : 6 }}>
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