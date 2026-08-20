import {
  loadConfig,
  saveConfig,
  verifyAdminPin,
  PRESETS,
} from "./aiConfig.js";

const $ = (sel) => document.querySelector(sel);

function setErr(text) {
  $("#admin-err").textContent = text || "";
}

function setOk(text) {
  $("#admin-ok").textContent = text || "";
}

function renderPresets(rate) {
  const row = $("#preset-row");
  row.innerHTML = "";
  for (const p of PRESETS) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = p.label;
    if (Math.abs(p.blunderRate - rate) < 0.005) btn.classList.add("active");
    btn.addEventListener("click", () => {
      const pct = Math.round(p.blunderRate * 100);
      $("#blunder-range").value = String(pct);
      $("#blunder-label").textContent = `${pct}%`;
      renderPresets(p.blunderRate);
    });
    row.appendChild(btn);
  }
}

function showBody() {
  $("#admin-gate").classList.add("hidden");
  $("#admin-body").classList.remove("hidden");
  const cfg = loadConfig();
  const pct = Math.round(cfg.blunderRate * 100);
  $("#blunder-range").value = String(pct);
  $("#blunder-label").textContent = `${pct}%`;
  $("#admin-pin-new").value = "";
  setOk("");
  renderPresets(cfg.blunderRate);
}

$("#btn-admin-login").addEventListener("click", () => {
  if (!verifyAdminPin($("#admin-pin").value)) {
    setErr("密码错误");
    return;
  }
  setErr("");
  sessionStorage.setItem("mj_admin_ok", "1");
  showBody();
});

$("#admin-pin").addEventListener("keydown", (e) => {
  if (e.key === "Enter") $("#btn-admin-login").click();
});

$("#blunder-range").addEventListener("input", () => {
  const pct = Number($("#blunder-range").value);
  $("#blunder-label").textContent = `${pct}%`;
  renderPresets(pct / 100);
});

$("#btn-admin-save").addEventListener("click", () => {
  const pct = Number($("#blunder-range").value);
  const patch = { blunderRate: pct / 100 };
  const newPin = $("#admin-pin-new").value.trim();
  if (newPin) patch.adminPin = newPin;
  saveConfig(patch);
  setOk(`已保存 · 昏棋率 ${pct}%`);
  $("#admin-pin-new").value = "";
});

// 同标签页已登录则直接进
if (sessionStorage.getItem("mj_admin_ok") === "1") {
  showBody();
}
