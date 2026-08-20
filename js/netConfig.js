/** 联机节点：WebSocket 服（香港/国内反代后可填）优先于 PeerJS */

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

/** 本机打开 local-server 时，默认同源 WebSocket */
export function sameOriginWs() {
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${location.host}`;
}

export function isLikelyStaticHost() {
  return (
    location.hostname.includes("vercel.app") ||
    location.hostname.includes("github.io") ||
    location.hostname.includes("jsdelivr.net") ||
    location.protocol === "file:"
  );
}
