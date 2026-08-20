const STORAGE_KEY = "mj_admin_cfg";

const DEFAULTS = {
  blunderRate: 0.12, // 0~1，AI 走昏招概率
  adminPin: "8888",
};

export const PRESETS = [
  { id: "noob", label: "菜鸟", blunderRate: 0.4 },
  { id: "normal", label: "普通", blunderRate: 0.15 },
  { id: "strong", label: "高手", blunderRate: 0.05 },
  { id: "master", label: "大师", blunderRate: 0 },
];

export function loadConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULTS,
      ...parsed,
      blunderRate: clampRate(parsed.blunderRate ?? DEFAULTS.blunderRate),
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveConfig(partial) {
  const next = {
    ...loadConfig(),
    ...partial,
    blunderRate: clampRate(partial.blunderRate ?? loadConfig().blunderRate),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function getBlunderRate() {
  return loadConfig().blunderRate;
}

export function verifyAdminPin(pin) {
  return String(pin) === String(loadConfig().adminPin || DEFAULTS.adminPin);
}

function clampRate(v) {
  const n = Number(v);
  if (Number.isNaN(n)) return DEFAULTS.blunderRate;
  return Math.min(1, Math.max(0, n));
}

export function formatBlunderPercent(rate = getBlunderRate()) {
  return `${Math.round(rate * 100)}%`;
}
