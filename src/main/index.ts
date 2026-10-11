// Electron main process: island + HR windows, data, AI, IPC.
import { app, BrowserWindow, dialog, globalShortcut, ipcMain, screen, shell } from "electron";
import fs from "node:fs";
import path from "node:path";
import type { Action, CheckInInput, IslandEvent, IslandLayout, RequestInput, RequestStatus } from "../shared/types";
import { REQUEST_CATEGORIES } from "../shared/types";
import { loadStore, resetStore, store } from "./store";
import { analyse } from "./ai";
import { answerQuestion } from "./ask";
import { ME_ID, questionForWeek } from "./seed";

// The island window is big enough for the largest view and never resizes.
// The island morphs inside it; the transparent area around it is click-through.
const WIN_W = 500;
const WIN_H = 640;

let island: BrowserWindow | null = null;
let hr: BrowserWindow | null = null;
let layout: IslandLayout = { notch: false, topInset: 0 };
let dialogOpen = false; // a save dialog also takes focus; don't treat that as "clicked away"

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

  // MacBooks with a notch have a taller menu bar (~37 px vs ~24 px).
  // There the island sits in the notch, like the iPhone's Dynamic Island.
  const wantNotch = isMac && menuBar >= 32;
  const y = wantNotch ? d.bounds.y : isMac ? d.workArea.y + 6 : d.bounds.y + 8;
  island.setPosition(x, y);

  // macOS may refuse to put a window over the menu bar; only use notch mode if it worked
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

  // Clicking anywhere outside (another app, the desktop) closes the island, like on iPhone
  island.on("blur", () => {
    if (!dialogOpen) sendIsland({ type: "blur" });
  });

  load(island, "island");
  island.once("ready-to-show", () => {
    island?.showInactive(); // appear without stealing focus
    placeIsland();
  });
  screen.on("display-metrics-changed", placeIsland);
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

// ---------- IPC ----------

function registerIpc() {
  const me = () => store.employee(ME_ID)!;

  // island window
  ipcMain.on("island:set-interactive", (_e, on: boolean) => island?.setIgnoreMouseEvents(!on, { forward: true }));
  ipcMain.on("island:focus", () => island?.focus());
  ipcMain.on("island:release-focus", () => island?.blur());
  ipcMain.handle("island:layout", () => layout);
  ipcMain.on("open-link", (_e, url: string) => {
    if (/^https:\/\//.test(url)) shell.openExternal(url);
  });

  // employee
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

  ipcMain.handle("requests:mine", () => store.myRequests(ME_ID));
  ipcMain.handle("notices:mine", () => store.myNotices(ME_ID));
  ipcMain.handle("notices:read", (_e, id: string) => {
    store.markNoticeRead(id);
    broadcastChange();
  });

  ipcMain.handle("mydata:summary", () => {
    const d = store.myData(ME_ID);
    return { checkIns: d.checkIns.length, questions: d.questions.length, requests: d.requests.length };
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

  // HR (sanitised views only)
  ipcMain.handle("hr:teams", () => store.hrTeams());
  ipcMain.handle("hr:stats", (_e, team: string) => store.hrStats(team));
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

// Tests run with their own data folder so they never touch real data
if (process.env.WORKPALZ_DATA_DIR) app.setPath("userData", process.env.WORKPALZ_DATA_DIR);

app.whenReady().then(() => {
  loadStore();
  registerIpc();
  createIslandWindow();

  // Keyboard access: open the island from anywhere (WCAG 2.1.1)
  globalShortcut.register("CommandOrControl+Alt+Space", () => {
    island?.focus();
    sendIsland({ type: "open" });
  });

  // Presentation shortcuts
  globalShortcut.register("CommandOrControl+Alt+C", () => sendIsland({ type: "checkin-prompt" }));
  globalShortcut.register("CommandOrControl+Alt+H", openHrDashboard);
  globalShortcut.register("CommandOrControl+Alt+R", () => {
    resetStore();
    broadcastChange();
    sendIsland({ type: "collapse" });
  });

  // Hooks for the end-to-end test (global shortcuts can't be pressed from a test)
  if (process.env.WORKPALZ_E2E) {
    (globalThis as Record<string, unknown>).__workpalz = { sendIsland, openHrDashboard };
  }
});

app.on("will-quit", () => globalShortcut.unregisterAll());
app.on("window-all-closed", () => app.quit());
