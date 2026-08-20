/** 联机：线上默认点对点；本机 npm start 时自动用同源 WebSocket。也可用 ?ws= 指定节点。 */

export const DEFAULT_WS_URL = "";

const KEY = "mahjong_ws_url";

export function getWsUrl() {
  const q = new URLSearchParams(location.search).get("ws");
  if (q) {
    try {
      localStorage.setItem(KEY, q);
    } catch {}
    return normalizeWs(q);
  }
  try {
    const saved = localStorage.getItem(KEY);
    if (saved) return normalizeWs(saved);
  } catch {}
  if (DEFAULT_WS_URL) return normalizeWs(DEFAULT_WS_URL);
  return "";
}

export function setWsUrl(url) {
  const v = String(url || "").trim();
  try {
    if (v) localStorage.setItem(KEY, v);
    else localStorage.removeItem(KEY);
  } catch {}
  return getWsUrl();
}

function normalizeWs(url) {
  let u = String(url || "").trim();
  if (!u) return "";
  if (u.startsWith("https://")) u = "wss://" + u.slice(8);
  if (u.startsWith("http://")) u = "ws://" + u.slice(7);
  if (!/^wss?:\/\//i.test(u)) {
    const proto = location.protocol === "https:" ? "wss:" : "ws:";
    u = `${proto}//${u.replace(/^\/\//, "")}`;
  }
  return u.replace(/\/$/, "");
}

export function sameOriginWs() {
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${location.host}`;
}

export function isLikelyStaticHost() {
  return (
    location.hostname.includes("vercel.app") ||
    location.hostname.includes("github.io") ||
    location.hostname.includes("jsdelivr.net") ||
    location.hostname.includes("onrender.com") ||
    location.protocol === "file:"
  );
}
