import { tileHTML } from "./tileArt.js";
import { tileLabel } from "./tiles.js";
import {
  createLocalSolo,
  runLocalLoop,
  localDiscard,
  localClaim,
  localZimo,
  localAnGang,
  localJiaGang,
  localNext,
} from "./localSolo.js";
import { createDuoHost, createDuoGuest } from "./duoP2p.js";
import { getBlunderRate } from "./aiConfig.js";

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const WIND_NAMES = ["东", "南", "西", "北"];

let mySeat = 0;
let roomInfo = null;
let state = null;
let selectedMode = "solo";
let selectedTile = null;
let localSession = null; // 纯前端单人
let duoSession = null; // P2P 双人

const lobby = $("#lobby");
const waiting = $("#waiting");
const table = $("#table");
const resultModal = $("#result-modal");

function isLocal() {
  return Boolean(localSession);
}

function isDuoNet() {
  return Boolean(duoSession);
}

function setErr(text) {
  $("#lobby-err").textContent = text || "";
}

function nick() {
  return ($("#nick").value || "玩家").trim().slice(0, 8);
}

function showLobby() {
  lobby.classList.remove("hidden");
  waiting.classList.add("hidden");
  table.classList.add("hidden");
  resultModal.classList.add("hidden");
}

function showWaiting() {
  lobby.classList.add("hidden");
  waiting.classList.remove("hidden");
  table.classList.add("hidden");
  resultModal.classList.add("hidden");
}

function showTable() {
  lobby.classList.add("hidden");
  waiting.classList.add("hidden");
  table.classList.remove("hidden");
}

function logicFromScreen(screen) {
  return (screen + mySeat) % 4;
}

function syncLocalState() {
  if (!localSession) return;
  mySeat = 0;
  roomInfo = { code: "本地", mode: "solo", status: localSession.game.phase === "result" ? "result" : "playing" };
  state = localSession.getState();
  showTable();
  render();
  if (state.phase === "result") showResult();
  else resultModal.classList.add("hidden");
}

function applyDuoLobby(room, seat) {
  mySeat = seat;
  roomInfo = room;
  if (room.status === "lobby") {
    renderWaiting();
    showWaiting();
  }
}

function applyDuoState(st, room, seat) {
  mySeat = seat;
  roomInfo = room;
  state = st;
  showTable();
  render();
  if (state.phase === "result") showResult();
  else resultModal.classList.add("hidden");
}

function renderWaiting() {
  $("#wait-code").textContent = roomInfo.code;
  const ul = $("#wait-list");
  ul.innerHTML = roomInfo.players
    .filter((p) => p.isHuman)
    .map((p) => {
      const team = p.team === 0 ? "甲队" : "乙队";
      const st = p.online ? (p.ready ? "已准备" : "在线") : "等待加入";
      const cls = p.online ? "online" : "offline";
      return `<li><span>${p.name} · ${team}</span><span class="${cls}">${st}</span></li>`;
    })
    .join("");
}

function fillRow(el, tiles, { back = false, size = "sm" } = {}) {
  if (!el) return;
  if (back) {
    const n = typeof tiles === "number" ? tiles : tiles?.length || 0;
    el.innerHTML = Array.from({ length: n }, () => tileHTML("m1", { back: true, size })).join("");
    return;
  }
  el.innerHTML = (tiles || []).map((t) => tileHTML(t, { size })).join("");
}

function render() {
  if (!state) return;

  $("#meta-mode").textContent = state.mode === "duo" ? "双人异地组队" : "单人模式";
  $("#meta-round").textContent = `第 ${state.round} 局 · ${WIND_NAMES[state.dealer]}庄`;
  $("#meta-wall").textContent = `余牌 ${state.wallLeft}`;
  $("#meta-room").textContent = roomInfo?.code ? `房 ${roomInfo.code}` : "";
  $("#status-msg").textContent = state.message || "";

  const banner = $("#team-banner");
  if (state.mode === "duo") {
    banner.classList.remove("hidden");
    const a = state.players.filter((p) => p.team === 0).map((p) => p.name).join(" + ");
    const b = state.players.filter((p) => p.team === 1).map((p) => p.name).join(" + ");
    banner.textContent = `甲队 ${a}  vs  乙队 ${b}`;
  } else {
    banner.classList.add("hidden");
  }

  $("#last-discard").innerHTML = state.lastDiscard ? tileHTML(state.lastDiscard, { size: "md" }) : "";

  for (let screen = 0; screen < 4; screen++) {
    const seat = logicFromScreen(screen);
    const p = state.players[seat];
    const el = $(`.seat[data-screen="${screen}"]`);
    if (!el || !p) continue;

    $(".seat-name", el).textContent = p.name;
    $(".seat-score", el).textContent = `${p.score}分`;

    const tags = [];
    if (seat === state.dealer) tags.push("庄");
    if (state.mode === "duo") tags.push(p.team === 0 ? "甲队" : "乙队");
    tags.push(p.isHuman ? "玩家" : "电脑");
    if (state.turn === seat && state.phase !== "result") tags.push("行动");
    const tagEl = $(".seat-tag", el);
    tagEl.textContent = tags.join(" · ");
    tagEl.className = "seat-tag";
    if (state.mode === "duo") tagEl.classList.add(p.team === 0 ? "team-a" : "team-b");
    if (state.turn === seat) tagEl.classList.add("active-turn");

    $(".meld-row", el).innerHTML = (p.melds || [])
      .flatMap((m) => m.tiles.map((t) => tileHTML(t, { size: "xs" })))
      .join("");
    fillRow($(".discard-row", el), p.discards, { size: "xs" });

    const hand = $(".hand-row", el);
    const isSelf = screen === 0;
    const canClick =
      isSelf &&
      state.phase === "discard" &&
      state.turn === mySeat &&
      !state.humanClaimOptions;

    if (p.hand) {
      const suggest = isSelf && canClick ? state.suggestDiscard : null;
      let hinted = false;
      hand.innerHTML = p.hand
        .map((t) => {
          const isHint = Boolean(suggest && t === suggest && !hinted);
          if (isHint) hinted = true;
          return tileHTML(t, {
            size: isSelf ? "md" : "sm",
            clickable: canClick,
            selected: canClick && selectedTile === t,
            hint: isHint,
          });
        })
        .join("");
    } else {
      fillRow(hand, p.handCount, { back: true, size: "sm" });
    }
  }

  const actionsEl = $("#turn-actions");
  actionsEl.innerHTML = "";
  if (state.phase === "discard" && state.turn === mySeat && !state.humanClaimOptions) {
    if (state.suggestDiscard) {
      const hintBtn = document.createElement("button");
      hintBtn.type = "button";
      hintBtn.className = "btn-suggest";
      hintBtn.textContent = "建议出牌";
      hintBtn.addEventListener("click", () => {
        if (!state.suggestDiscard) return;
        if (selectedTile === state.suggestDiscard) {
          void doDiscard(state.suggestDiscard);
        } else {
          selectedTile = state.suggestDiscard;
          render();
        }
      });
      actionsEl.appendChild(hintBtn);
    }
    for (const a of state.turnActions || []) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = a.label;
      btn.addEventListener("click", () => void onTurnAction(a));
      actionsEl.appendChild(btn);
    }
  }

  const claimBar = $("#claim-bar");
  if (state.humanClaimOptions && state.activeHumanSeat === mySeat) {
    claimBar.classList.remove("hidden");
    claimBar.innerHTML = "";
    for (const opt of state.humanClaimOptions) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = opt.type === "chi" ? "吃" : opt.label;
      if (opt.type === "chi" && opt.chi) btn.title = opt.chi.tiles.map(tileLabel).join("");
      if (opt.type === "pass") btn.classList.add("pass");
      btn.addEventListener("click", () => void onClaim(opt));
      claimBar.appendChild(btn);
    }
  } else {
    claimBar.classList.add("hidden");
    claimBar.innerHTML = "";
  }
}

function showResult() {
  resultModal.classList.remove("hidden");
  const info = state.winInfo;
  if (!info || info.type === "draw") {
    $("#result-title").textContent = "流局";
    $("#result-detail").textContent = "本局无人胡牌";
  } else {
    const w = state.players[info.seat];
    $("#result-title").textContent = info.type === "zimo" ? "自摸！" : "胡牌！";
    let detail = `${w.name} 获胜`;
    if (state.mode === "duo") detail += ` · ${w.team === 0 ? "甲队" : "乙队"}`;
    if (info.type === "dianpao") detail += `（${state.players[info.fromSeat].name} 点炮）`;
    $("#result-detail").textContent = detail;
  }
  $("#result-scores").innerHTML = state.players
    .map((p) => {
      const team = state.mode === "duo" ? ` · ${p.team === 0 ? "甲队" : "乙队"}` : "";
      return `<li><span>${p.name}${team}</span><span>${p.score} 分</span></li>`;
    })
    .join("");
}

async function doDiscard(tile) {
  selectedTile = null;
  if (isLocal()) {
    localDiscard(localSession, tile);
    syncLocalState();
    await runLocalLoop(localSession, syncLocalState);
    return;
  }
  if (isDuoNet()) {
    if (duoSession.role === "host") duoSession.localAction({ action: "discard", tile });
    else duoSession.sendAction({ action: "discard", tile });
  }
}

async function onClaim(opt) {
  if (isLocal()) {
    localClaim(localSession, opt);
    syncLocalState();
    await runLocalLoop(localSession, syncLocalState);
    return;
  }
  if (isDuoNet()) {
    if (duoSession.role === "host") duoSession.localAction({ action: "claim", claim: opt });
    else duoSession.sendAction({ action: "claim", claim: opt });
  }
}

async function onTurnAction(a) {
  if (isLocal()) {
    if (a.type === "hu") localZimo(localSession);
    else if (a.type === "angang") localAnGang(localSession, a.tile);
    else if (a.type === "jiagang") localJiaGang(localSession, a.tile);
    syncLocalState();
    if (localSession.game.phase !== "result") await runLocalLoop(localSession, syncLocalState);
    return;
  }
  if (isDuoNet()) {
    const payload =
      a.type === "hu"
        ? { action: "zimo" }
        : a.type === "angang"
          ? { action: "angang", tile: a.tile }
          : { action: "jiagang", tile: a.tile };
    if (duoSession.role === "host") duoSession.localAction(payload);
    else duoSession.sendAction(payload);
  }
}

async function startLocalSolo() {
  localSession = createLocalSolo(nick(), { blunderRate: getBlunderRate() });
  localSession.alive = true;
  selectedTile = null;
  syncLocalState();
  await runLocalLoop(localSession, syncLocalState);
}

$("#hand-bottom")?.addEventListener("click", (e) => {
  const tileEl = e.target.closest("[data-tile]");
  if (!tileEl || !state) return;
  if (state.phase !== "discard" || state.turn !== mySeat) return;
  const id = tileEl.dataset.tile;
  if (selectedTile === id) {
    void doDiscard(id);
  } else {
    selectedTile = id;
    render();
  }
});

$$(".mode-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    $$(".mode-btn").forEach((b) => b.classList.remove("selected"));
    btn.classList.add("selected");
    selectedMode = btn.dataset.mode;
    $("#duo-panel").classList.toggle("hidden", selectedMode !== "duo");
    $("#btn-start-solo").classList.toggle("hidden", selectedMode !== "solo");
    setErr("");
  });
});

$("#btn-start-solo").addEventListener("click", async () => {
  setErr("");
  try {
    await startLocalSolo();
  } catch (e) {
    setErr(e.message || "开局失败");
  }
});

$("#btn-create").addEventListener("click", async () => {
  setErr("");
  try {
    localSession = null;
    duoSession?.destroy();
    duoSession = createDuoHost({
      name: nick(),
      onLobby: applyDuoLobby,
      onState: applyDuoState,
      onError: (m) => setErr(m),
    });
    await duoSession.start();
    showWaiting();
  } catch (e) {
    setErr(e.message || "创建房间失败（需可访问外网）");
    duoSession?.destroy();
    duoSession = null;
  }
});

$("#btn-join").addEventListener("click", async () => {
  setErr("");
  const code = $("#room-code").value.trim();
  if (!code) {
    setErr("请输入房间码");
    return;
  }
  try {
    localSession = null;
    duoSession?.destroy();
    duoSession = createDuoGuest({
      code,
      name: nick(),
      onLobby: applyDuoLobby,
      onState: applyDuoState,
      onError: (m) => setErr(m),
    });
    await duoSession.start();
    showWaiting();
  } catch (e) {
    setErr(e.message || "加入失败");
    duoSession?.destroy();
    duoSession = null;
  }
});

$("#btn-ready").addEventListener("click", () => {
  if (!duoSession) return;
  duoSession.setReady(nick());
});

$("#btn-copy").addEventListener("click", async () => {
  if (!roomInfo?.code) return;
  try {
    await navigator.clipboard.writeText(roomInfo.code);
    $("#btn-copy").textContent = "已复制";
    setTimeout(() => {
      $("#btn-copy").textContent = "复制房间码";
    }, 1200);
  } catch {
    setErr(`房间码：${roomInfo.code}`);
  }
});

function leaveAll() {
  if (localSession) localSession.alive = false;
  localSession = null;
  duoSession?.destroy();
  duoSession = null;
  state = null;
  roomInfo = null;
  selectedTile = null;
  showLobby();
}

$("#btn-leave-wait").addEventListener("click", leaveAll);
$("#btn-lobby").addEventListener("click", leaveAll);
$("#btn-result-lobby").addEventListener("click", leaveAll);

$("#btn-next").addEventListener("click", async () => {
  selectedTile = null;
  if (isLocal()) {
    localNext(localSession);
    syncLocalState();
    await runLocalLoop(localSession, syncLocalState);
    return;
  }
  if (isDuoNet()) {
    if (duoSession.role === "host") duoSession.localAction({ action: "next" });
    else duoSession.sendAction({ action: "next" });
  }
});

$(".mode-btn[data-mode='duo'] .mode-hint").textContent =
  "点对点联机 · 无需开服务器 · 两名 AI";
