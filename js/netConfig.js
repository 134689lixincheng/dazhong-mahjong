/**
 * 联机节点：默认留空，线上走公共 MQTT 中继（国内可直连、无冷启动）。
 * 有自建/免费节点时用 ?ws=wss://... 指定，双方需填同一地址。
 */

export const DEFAULT_WS_URL = "";

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
export function httpFromWs(wsUrl) {
  return String(wsUrl || "")
    .replace(/^wss:/i, "https:")
    .replace(/^ws:/i, "http:");
}

/** Render 免费档冷启动约 30–60 秒，所以一直探活到 maxMs，并播报进度 */
export async function wakeRelay(wsUrl = getWsUrl(), { maxMs = 90000, onProgress } = {}) {
  if (!wsUrl) return false;
  const http = httpFromWs(wsUrl);
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    try {
      const r = await fetch(`${http}/?probe=${Date.now()}`, { cache: "no-store" });
      if (r.ok || r.status === 404) return true;
    } catch {}
    onProgress?.(Math.round((Date.now() - start) / 1000));
    await new Promise((r) => setTimeout(r, 1500));
  }
  return false;
}
