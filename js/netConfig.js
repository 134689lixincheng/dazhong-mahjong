/** 联机节点：双方必须同一地址。线上默认走 Render（新加坡），免填表。 */

export const DEFAULT_WS_URL = "wss://dazhong-mahjong-dwkm.onrender.com";

const KEY = "mahjong_ws_url";

export function getWsUrl() {
  const q = new URLSearchParams(location.search).get("ws");
  if (q) return normalizeWs(q);
  if (DEFAULT_WS_URL) return normalizeWs(DEFAULT_WS_URL);
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

/** 唤醒免费实例（Render 休眠后首次要等一会） */
export async function wakeRelay(wsUrl = getWsUrl()) {
  if (!wsUrl) return false;
  const http = wsUrl.replace(/^wss:/i, "https:").replace(/^ws:/i, "http:");
  try {
    await fetch(http + "/", { mode: "no-cors", cache: "no-store" });
  } catch {}
  // 再探活（有 CORS 时能拿到状态）
  for (let i = 0; i < 20; i++) {
    try {
      const r = await fetch(http + "/", { cache: "no-store" });
      if (r.ok || r.status === 404) return true;
    } catch {}
    await new Promise((r) => setTimeout(r, 1500));
  }
  return false;
}
