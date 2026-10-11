// Safe bridge between the UIs and the main process. Only these calls are exposed.
import { contextBridge, ipcRenderer } from "electron";
import type { WorkPalzApi } from "../shared/types";

const listen = (channel: string) => (cb: (...args: any[]) => void) => {
  const handler = (_e: unknown, ...args: any[]) => cb(...args);
  ipcRenderer.on(channel, handler);
  return () => {
    ipcRenderer.removeListener(channel, handler);
  };
};
const call = (channel: string) => (...args: unknown[]) => ipcRenderer.invoke(channel, ...args);

const api: WorkPalzApi = {
  setInteractive: (on) => ipcRenderer.send("island:set-interactive", on),
  focusIsland: () => ipcRenderer.send("island:focus"),
  releaseFocus: () => ipcRenderer.send("island:release-focus"),
  getLayout: call("island:layout"),
  onIslandEvent: listen("island:event"),
  onDataChanged: listen("data:changed"),
  openLink: (url) => ipcRenderer.send("open-link", url),

  getMe: call("me:get"),
  getQuestion: call("checkin:question"),
  submitCheckIn: call("checkin:add"),
  ask: call("ask"),
  submitRequest: call("request:add"),
  listMyRequests: call("requests:mine"),
  listMyNotices: call("notices:mine"),
  markNoticeRead: call("notices:read"),
  getMyData: call("mydata:summary"),
  exportMyData: call("mydata:export"),
  deleteMyData: call("mydata:delete"),

  hrStats: call("hr:stats"),
  hrTeams: call("hr:teams"),
  hrCheckIns: call("hr:checkins"),
  hrAsks: call("hr:asks"),
  hrRequests: call("hr:requests"),
  setRequestStatus: call("hr:request-status"),
  analyse: call("ai:analyse"),
  getLastAnalysis: call("ai:last"),
  listActions: call("actions:list"),
  addAction: call("actions:add"),
  setActionStatus: call("actions:status"),
  resetDemo: call("demo:reset"),
} as WorkPalzApi;

contextBridge.exposeInMainWorld("workpalz", api);
