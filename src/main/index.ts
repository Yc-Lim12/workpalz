// Electron main process: island + HR windows, data, AI, IPC.
import { app, BrowserWindow, dialog, globalShortcut, ipcMain, Menu, nativeImage, screen, shell, Tray } from "electron";
import fs from "node:fs";
import path from "node:path";
import type { Action, AssistantMessage, AssistantView, CheckInInput, HandbookInput, Colleague, IslandEvent, IslandLayout, Ping, PingInput, RequestInput, RequestStatus, Shortcuts } from "../shared/types";
import { DEFAULT_SHORTCUTS, DRAFT_PLACEHOLDER, REQUEST_CATEGORIES } from "../shared/types";
import { loadStore, resetStore, store } from "./store";
import { analyse } from "./ai";
import { answerQuestion } from "./ask";
import { askAssistant, draftHandbookEntry } from "./assistant";
import { ME_ID, questionForWeek } from "./seed";

const WIN_W = 500;
const WIN_H = 640;

let island: BrowserWindow | null = null;
let hr: BrowserWindow | null = null;
let tray: Tray | null = null;
let layout: IslandLayout = { notch: false, topInset: 0 };
let dialogOpen = false;
let islandInteractive = false; // true = the see-through island window is catching clicks

let currentShortcuts: Shortcuts = { ...DEFAULT_SHORTCUTS };

const preload = path.join(__dirname, "../preload/index.js");
const isMac = process.platform === "darwin";

function load(win: BrowserWindow, view: "island" | "hr") {
  if (process.env.ELECTRON_RENDERER_URL) win.loadURL(`${process.env.ELECTRON_RENDERER_URL}#${view}`);
  else win.loadFile(path.join(__dirname, "../renderer/index.html"), { hash: view });
}

function sendIsland(ev: IslandEvent) {
  island?.webContents.send("island:event", ev);
}

function broadcastChange() {
  for (const w of BrowserWindow.getAllWindows()) w.webContents.send("data:changed");
}

// ---------- Island window ----------

function placeIsland() {
  if (!island) return;
  const d = screen.getPrimaryDisplay();
  const menuBar = d.workArea.y - d.bounds.y;
  const x = Math.round(d.bounds.x + (d.bounds.width - WIN_W) / 2);

  const wantNotch = isMac && menuBar >= 32;
  const y = wantNotch ? d.bounds.y : isMac ? d.workArea.y + 6 : d.bounds.y + 8;
  island.setPosition(x, y);

  const placed = island.getBounds().y === d.bounds.y;
  layout = wantNotch && placed ? { notch: true, topInset: menuBar } : { notch: false, topInset: 0 };
  sendIsland({ type: "layout", layout });
}

function createIslandWindow() {
  island = new BrowserWindow({
    width: WIN_W,
    height: WIN_H,
    frame: false,
    transparent: true,
    backgroundColor: "#00000000",
    hasShadow: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    enableLargerThanScreen: true,
    show: false,
    title: "WorkPalz",
    webPreferences: { preload, contextIsolation: true, sandbox: false },
  });

  island.setAlwaysOnTop(true, "screen-saver");
  island.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  island.setIgnoreMouseEvents(true, { forward: true });

  island.on("blur", () => {
    if (!dialogOpen) sendIsland({ type: "blur" });
  });

  load(island, "island");
  island.once("ready-to-show", () => {
    island?.showInactive();
    placeIsland();
  });
  screen.on("display-metrics-changed", placeIsland);
}

// ---------- Menu bar / tray icon ----------
// The island can hide itself, and it has no dock or taskbar entry, so this is
// the always-visible place to bring it back.

function createTray() {
  const dir = path.join(__dirname, "../../resources");
  const icon = nativeImage.createFromPath(path.join(dir, isMac ? "trayTemplate.png" : "tray.png"));
  if (isMac) icon.setTemplateImage(true); // follows light/dark menu bar
  tray = new Tray(isMac ? icon : icon.resize({ width: 16, height: 16 }));
  tray.setToolTip("WorkPalz");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Show WorkPalz", click: () => sendIsland({ type: "show" }) },
      { label: "Open menu", click: () => { island?.focus(); sendIsland({ type: "open" }); } },
      { label: "Hide WorkPalz", click: () => sendIsland({ type: "hide" }) },
      { type: "separator" },
      { label: "HR dashboard", click: openHrDashboard },
      { type: "separator" },
      { label: "Quit WorkPalz", role: "quit" },
    ])
  );
  // Windows: a left click on the tray icon brings the island back straight away
  tray.on("click", () => { if (!isMac) sendIsland({ type: "show" }); });
}

// ---------- HR window ----------

function openHrDashboard() {
  if (hr && !hr.isDestroyed()) {
    hr.show();
    hr.focus();
    return;
  }
  hr = new BrowserWindow({
    width: 1320,
    height: 880,
    minWidth: 760,
    minHeight: 560,
    title: "WorkPalz · HR Dashboard",
    backgroundColor: "#F6F7F9",
    autoHideMenuBar: true,
    webPreferences: { preload, contextIsolation: true, sandbox: false },
  });
  load(hr, "hr");
  hr.on("closed", () => (hr = null));
}

// ---------- Custom Shortcuts Handler ----------

function applyShortcuts() {
  globalShortcut.unregisterAll(); 

  const register = (shortcut: string, action: () => void) => {
    if (!shortcut) return;
    try {
      // register() returns false when another app already owns the shortcut
      if (!globalShortcut.register(shortcut.replace(/\bCmd\b/, "Command"), action)) {
        console.error("Shortcut already in use:", shortcut);
      }
    } catch {
      console.error("Invalid shortcut:", shortcut);
    }
  };

  // Register all bound features safely
  register(currentShortcuts.main, () => { island?.focus(); sendIsland({ type: "open" }); });
  register(currentShortcuts.ask, () => { island?.focus(); sendIsland({ type: "open-ask" }); });
  register(currentShortcuts.request, () => { island?.focus(); sendIsland({ type: "open-request" }); });
  register(currentShortcuts.ping, () => { island?.focus(); sendIsland({ type: "open-ping" }); });
  register(currentShortcuts.focus, () => { island?.focus(); sendIsland({ type: "toggle-focus" }); });
  register(currentShortcuts.toggle, () => sendIsland({ type: "toggle-hidden" }));

  // Default presentation shortcuts
  globalShortcut.register("CommandOrControl+Alt+C", () => sendIsland({ type: "checkin-prompt" }));
  globalShortcut.register("CommandOrControl+Alt+H", openHrDashboard);
  globalShortcut.register("CommandOrControl+Alt+R", () => {
    resetStore();
    broadcastChange();
    sendIsland({ type: "collapse" });
  });
}

// ---------- Ping replies (demo only) ----------
// There's no second person in the demo, so colleagues answer by themselves.
// Away colleagues don't reply; busy ones take longer.

const REPLIES: Record<Exclude<Colleague["availability"], "away">, string[]> = {
  available: [
    "Sure! Come over to my desk, or I can call you in 5 minutes.",
    "Happy to help. Send me a screenshot and I'll take a look now.",
  ],
  busy: ["I'm in a meeting right now. Free at 3pm, I'll come find you then."],
};

function simulateReply(ping: Ping, c: Colleague) {
  if (c.availability === "away") return;
  const options = REPLIES[c.availability];
  const reply = options[Math.floor(Math.random() * options.length)];
  setTimeout(() => {
    store.replyToPing(ping.id, c.name, reply);
    broadcastChange();
  }, c.availability === "available" ? 5000 : 9000);
}

// ---------- IPC ----------

function registerIpc() {
  const me = () => store.employee(ME_ID)!;

  ipcMain.on("island:set-interactive", (_e, on: boolean) => {
    islandInteractive = !!on;
    island?.setIgnoreMouseEvents(!on, { forward: true });
  });
  ipcMain.on("island:focus", () => island?.focus());
  ipcMain.on("island:release-focus", () => island?.blur());
  ipcMain.handle("island:layout", () => layout);
  ipcMain.on("open-link", (_e, url: string) => {
    if (/^https:\/\//.test(url)) shell.openExternal(url);
  });

  ipcMain.on("island:set-shortcuts", (_e, shortcuts: Shortcuts) => {
    currentShortcuts = shortcuts;
    applyShortcuts();
  });

  ipcMain.handle("me:get", () => me());
  ipcMain.handle("checkin:question", () => questionForWeek(me().week));

  ipcMain.handle("checkin:add", (_e, input: CheckInInput) => {
    const m = me();
    store.addCheckIn({
      employeeId: m.id,
      team: m.team,
      week: m.week,
      question: questionForWeek(m.week),
      mood: input.mood,
      note: String(input.note ?? "").trim().slice(0, 280),
      shareName: !!input.shareName,
    });
    broadcastChange();
  });

  ipcMain.handle("ask", async (_e, question: string) => {
    const q = String(question ?? "").trim().slice(0, 200);
    const { result, entryId } = await answerQuestion(q);
    const m = me();
    store.addAsk({ employeeId: m.id, team: m.team, week: m.week, question: q, entryId, answered: result.answered });
    broadcastChange();
    return result;
  });

  ipcMain.handle("request:add", (_e, input: RequestInput) => {
    if (!REQUEST_CATEGORIES.some((c) => c.id === input.category)) throw new Error("Unknown category");
    const m = me();
    store.addRequest({
      employeeId: m.id,
      name: m.name,
      team: m.team,
      category: input.category,
      description: String(input.description ?? "").trim().slice(0, 280),
    });
    broadcastChange();
  });

  ipcMain.handle("colleagues:list", () => store.colleagues());
  ipcMain.handle("pings:mine", () => store.myPings(ME_ID));
  ipcMain.handle("ping:send", (_e, input: PingInput) => {
    const c = store.colleague(String(input.colleagueId));
    if (!c) throw new Error("Unknown colleague");
    const ping = store.addPing({
      fromId: ME_ID,
      toId: c.id,
      toName: c.name,
      message: String(input.message ?? "").trim().slice(0, 200),
    });
    broadcastChange();
    simulateReply(ping, c);
  });

  ipcMain.handle("requests:mine", () => store.myRequests(ME_ID));
  ipcMain.handle("notices:mine", () => store.myNotices(ME_ID));
  ipcMain.handle("notices:read", (_e, id: string) => {
    store.markNoticeRead(id);
    broadcastChange();
  });

  ipcMain.handle("mydata:summary", () => {
    const d = store.myData(ME_ID);
    return { checkIns: d.checkIns.length, questions: d.questions.length, requests: d.requests.length, pings: d.pings.length };
  });

  ipcMain.handle("mydata:export", async () => {
    const opts = {
      title: "Save my WorkPalz data",
      defaultPath: path.join(app.getPath("downloads"), "workpalz-my-data.json"),
      filters: [{ name: "JSON", extensions: ["json"] }],
    };
    dialogOpen = true;
    const res = await (island ? dialog.showSaveDialog(island, opts) : dialog.showSaveDialog(opts)).finally(() => {
      dialogOpen = false;
      island?.focus();
    });
    if (res.canceled || !res.filePath) return false;
    fs.writeFileSync(res.filePath, JSON.stringify(store.myData(ME_ID), null, 2));
    return true;
  });

  ipcMain.handle("mydata:delete", () => {
    store.deleteMyData(ME_ID);
    broadcastChange();
  });

  ipcMain.handle("hr:teams", () => store.hrTeams());
  ipcMain.handle("hr:handbook-draft", (_e, questions: string[]) => draftHandbookEntry(Array.isArray(questions) ? questions : []));
  ipcMain.handle("hr:handbook-added", () => store.handbookAdded());
  ipcMain.handle("hr:handbook-publish", (_e, input: HandbookInput) => {
    const title = String(input.title ?? "").trim().slice(0, 80);
    const answer = String(input.answer ?? "").trim().slice(0, 1000);
    if (!title || !answer) throw new Error("Title and answer are required");
    if (answer.includes(DRAFT_PLACEHOLDER) || title.includes(DRAFT_PLACEHOLDER)) throw new Error("Fill in the placeholders first");
    const keywords = (Array.isArray(input.keywords) ? input.keywords : [])
      .map((k) => String(k).trim().toLowerCase().slice(0, 40))
      .filter(Boolean)
      .slice(0, 12);
    const askIds = (Array.isArray(input.askIds) ? input.askIds : []).map(String);
    const notified = store.publishHandbookEntry({ title, answer, keywords, askIds });
    broadcastChange();
    return notified;
  });
  ipcMain.handle("hr:assistant", (_e, messages: AssistantMessage[], view: AssistantView) =>
    askAssistant(Array.isArray(messages) ? messages : [], view)
  );
  ipcMain.handle("hr:stats", (_e, team: string) => store.hrStats(team));
  ipcMain.handle("hr:impact", (_e, team: string) => store.hrImpact(team));
  ipcMain.handle("hr:checkins", () => store.hrCheckIns());
  ipcMain.handle("hr:asks", () => store.hrAsks());
  ipcMain.handle("hr:requests", () => store.hrRequests());
  ipcMain.handle("hr:request-status", (_e, id: string, status: RequestStatus) => {
    store.setRequestStatus(id, status);
    broadcastChange();
  });

  ipcMain.handle("ai:analyse", async () => {
    store.setAnalysis(await analyse());
    broadcastChange();
    return store.hrAnalysis();
  });
  ipcMain.handle("ai:last", () => store.hrAnalysis());

  ipcMain.handle("actions:list", () => store.hrActions());
  ipcMain.handle("actions:add", (_e, themeId: string) => {
    store.addAction(themeId);
    broadcastChange();
  });
  ipcMain.handle("actions:status", (_e, id: string, status: Action["status"]) => {
    store.setActionStatus(id, status);
    broadcastChange();
  });

  ipcMain.handle("demo:reset", () => {
    resetStore();
    broadcastChange();
    sendIsland({ type: "collapse" });
  });
}

// ---------- App ----------

if (process.env.WORKPALZ_DATA_DIR) app.setPath("userData", process.env.WORKPALZ_DATA_DIR);

app.whenReady().then(() => {
  loadStore();
  registerIpc();
  createIslandWindow();
  createTray();

  applyShortcuts();

  if (process.env.WORKPALZ_E2E) {
    (globalThis as Record<string, unknown>).__workpalz = { sendIsland, openHrDashboard, isIslandInteractive: () => islandInteractive };
  }
});

app.on("will-quit", () => globalShortcut.unregisterAll());
app.on("window-all-closed", () => app.quit());