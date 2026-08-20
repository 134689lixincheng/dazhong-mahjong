/**
 * 自测：对 DEFAULT / 参数 URL 做 create + join
 * 用法：node scripts/verify-duo.mjs [wss://host]
 */
import { DEFAULT_WS_URL } from "../js/netConfig.js";

const url = process.argv[2] || DEFAULT_WS_URL;
if (!url) {
  console.error("FAIL: no ws url");
  process.exit(1);
}

function once(ws, type, timeout = 15000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout waiting ${type}`)), timeout);
    ws.addEventListener("message", function handler(ev) {
      let msg;
      try {
        msg = JSON.parse(ev.data);
      } catch {
        return;
      }
      if (msg.type === type || (type === "any" && msg.type)) {
        clearTimeout(t);
        ws.removeEventListener("message", handler);
        resolve(msg);
      }
      if (msg.type === "error") {
        clearTimeout(t);
        ws.removeEventListener("message", handler);
        reject(new Error(msg.message));
      }
    });
  });
}

function openWs(u, timeout = 45000) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(u);
    const t = setTimeout(() => {
      try {
        ws.close();
      } catch {}
      reject(new Error("ws open timeout"));
    }, timeout);
    ws.addEventListener("open", () => {
      clearTimeout(t);
      resolve(ws);
    });
    ws.addEventListener("error", () => {
      clearTimeout(t);
      reject(new Error("ws error"));
    });
  });
}

const http = url.replace(/^wss:/i, "https:").replace(/^ws:/i, "http:");
console.log("wake", http);
try {
  await fetch(http + "/");
  console.log("OK wake http");
} catch (e) {
  console.log("WARN wake", e.message);
}

console.log("connect host", url);
const host = await openWs(url);
host.send(JSON.stringify({ type: "create", mode: "duo", name: "测甲", blunderRate: 0.1 }));
const roomMsg = await once(host, "room");
const code = roomMsg.room?.code;
if (!code) throw new Error("no room code");
console.log("OK create room", code);

console.log("connect guest");
const guest = await openWs(url);
const guestRoomP = once(guest, "room");
guest.send(JSON.stringify({ type: "join", code, name: "测乙" }));
const guestRoom = await guestRoomP;
if (guestRoom.seat !== 2) throw new Error("guest seat expected 2, got " + guestRoom.seat);
console.log("OK join seat", guestRoom.seat);

host.close();
guest.close();
console.log("PASS duo create+join");
