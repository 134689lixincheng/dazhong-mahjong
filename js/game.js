import {
  createFullSet,
  shuffle,
  sortTiles,
  removeOne,
  removeMany,
  canFormChi,
  canPeng,
  canMingGang,
  canAnGang,
  canJiaGang,
} from "./tiles.js";
import { canWinHand } from "./win.js";
import {
  aiAfterDrawActions,
  aiWantChi,
  aiWantGang,
  aiWantHu,
  aiWantPeng,
  aiChooseDiscard,
} from "./ai.js";

export const WIND_NAMES = ["东", "南", "西", "北"];

/**
 * mode: 'solo' | 'duo'
 * solo: 座位0人类，1/2/3 AI
 * duo:  座位0与2人类组队（对家），1与3为AI队
 */
export function createGame({ mode = "solo", names = null, rng = Math.random, blunderRate = null } = {}) {
  const isHuman = mode === "duo" ? [true, false, true, false] : [true, false, false, false];
  const teamOf = (seat) => (mode === "duo" ? seat % 2 : seat);

  const defaultNames =
    mode === "duo"
      ? ["玩家甲", "电脑·南", "玩家乙", "电脑·北"]
      : ["你", "电脑·南", "电脑·西", "电脑·北"];

  const players = [0, 1, 2, 3].map((i) => ({
    seat: i,
    name: (names && names[i]) || defaultNames[i],
    isHuman: isHuman[i],
    team: teamOf(i),
    hand: [],
    melds: [],
    discards: [],
    score: 0,
  }));

  return {
    mode,
    players,
    wall: [],
    dealer: 0,
    turn: 0,
    phase: "idle",
    lastDiscard: null,
    lastDiscarder: null,
    claimQueue: null,
    winner: null,
    winInfo: null,
    message: "",
    round: 1,
    wallLeft: 0,
    drawnTile: null,
    humanClaimOptions: null,
    activeHumanSeat: null,
    /** null = 读本地后台配置 */
    blunderRate,
    rng,
  };
}

function aiOpts(game, extra = {}) {
  return {
    rng: game.rng,
    ...(game.blunderRate != null ? { blunderRate: game.blunderRate } : {}),
    ...extra,
  };
}

export function startRound(game) {
  game.wall = shuffle(createFullSet(), game.rng);
  game.winner = null;
  game.winInfo = null;
  game.lastDiscard = null;
  game.lastDiscarder = null;
  game.claimQueue = null;
  game.drawnTile = null;
  game.humanClaimOptions = null;
  game.message = "";

  for (const p of game.players) {
    p.hand = [];
    p.melds = [];
    p.discards = [];
  }

  for (let r = 0; r < 13; r++) {
    for (let s = 0; s < 4; s++) {
      game.players[s].hand.push(game.wall.pop());
    }
  }
  for (const p of game.players) p.hand = sortTiles(p.hand);

  game.turn = game.dealer;
  game.phase = "draw";
  game.wallLeft = game.wall.length;
  game.message = `${WIND_NAMES[game.dealer]}家庄开局`;
  return game;
}

function drawTile(game, seat) {
  if (game.wall.length === 0) {
    game.phase = "result";
    game.winner = null;
    game.winInfo = { type: "draw", reason: "流局" };
    game.message = "牌山告罄，流局";
    return null;
  }
  const tile = game.wall.pop();
  game.players[seat].hand.push(tile);
  game.players[seat].hand = sortTiles(game.players[seat].hand);
  game.wallLeft = game.wall.length;
  game.drawnTile = tile;
  return tile;
}

export function beginTurnDraw(game) {
  const seat = game.turn;
  game.activeHumanSeat = game.players[seat].isHuman ? seat : null;
  game.lastDiscard = null;
  game.lastDiscarder = null;
  const tile = drawTile(game, seat);
  if (tile == null) return { type: "liuju" };
  game.phase = "discard";
  game.message = `${game.players[seat].name} 摸牌`;
  return { type: "drew", seat, tile };
}

export function discardTile(game, seat, tile) {
  if (game.phase !== "discard" || game.turn !== seat) {
    return { ok: false, error: "还没到出牌" };
  }
  const p = game.players[seat];
  if (!p.hand.includes(tile)) return { ok: false, error: "没有这张牌" };

  p.hand = sortTiles(removeOne(p.hand, tile));
  p.discards.push(tile);
  game.lastDiscard = tile;
  game.lastDiscarder = seat;
  game.drawnTile = null;
  game.phase = "claim";
  game.message = `${p.name} 打出`;
  game.claimQueue = buildClaimQueue(game, seat, tile);

  if (!game.claimQueue.length) {
    advanceTurn(game);
    return { ok: true, autoAdvance: true };
  }
  return { ok: true, autoAdvance: false };
}

function advanceTurn(game) {
  game.turn = (game.lastDiscarder + 1) % 4;
  game.phase = "draw";
  game.claimQueue = null;
  game.humanClaimOptions = null;
  game.activeHumanSeat = game.players[game.turn].isHuman ? game.turn : null;
  game.message = `轮到 ${game.players[game.turn].name}`;
}

function buildClaimQueue(game, discarder, tile) {
  const claims = [];

  for (let i = 1; i <= 3; i++) {
    const seat = (discarder + i) % 4;
    if (canWinHand([...game.players[seat].hand, tile])) {
      claims.push({ seat, type: "hu", priority: 0 });
    }
  }
  for (let i = 1; i <= 3; i++) {
    const seat = (discarder + i) % 4;
    const hand = game.players[seat].hand;
    if (canMingGang(hand, tile)) claims.push({ seat, type: "gang", priority: 1 });
    else if (canPeng(hand, tile)) claims.push({ seat, type: "peng", priority: 1 });
  }
  const next = (discarder + 1) % 4;
  const chiOpts = canFormChi(game.players[next].hand, tile);
  if (chiOpts.length) {
    claims.push({ seat: next, type: "chi", priority: 2, options: chiOpts });
  }

  claims.sort(
    (a, b) =>
      a.priority - b.priority ||
      ((a.seat - discarder + 4) % 4) - ((b.seat - discarder + 4) % 4)
  );
  return claims;
}

function takeDiscard(game) {
  const tile = game.lastDiscard;
  game.players[game.lastDiscarder].discards.pop();
  game.lastDiscard = null;
  return tile;
}

function applyScores(game, winnerSeat, kind, fromSeat) {
  const winP = game.players[winnerSeat];
  if (game.mode === "duo") {
    const pts = kind === "zimo" ? 2 : 1;
    for (const p of game.players) {
      if (p.team === winP.team) p.score += pts;
      else p.score -= pts;
    }
    if (kind === "dianpao" && fromSeat != null) {
      game.players[fromSeat].score -= 1;
      winP.score += 1;
    }
  } else if (kind === "zimo") {
    for (const p of game.players) {
      if (p.seat === winnerSeat) p.score += 6;
      else p.score -= 2;
    }
  } else {
    winP.score += 3;
    game.players[fromSeat].score -= 3;
  }
}

function finishHu(game, seat, kind, fromSeat, tileToAdd) {
  const p = game.players[seat];
  if (tileToAdd) p.hand = sortTiles([...p.hand, tileToAdd]);
  game.phase = "result";
  game.winner = seat;
  applyScores(game, seat, kind, fromSeat);
  game.winInfo = { type: kind, seat, fromSeat };
  game.humanClaimOptions = null;
  game.claimQueue = null;
  game.message =
    kind === "zimo"
      ? `${p.name} 自摸！`
      : `${p.name} 胡牌！（${game.players[fromSeat].name} 点炮）`;
  return { resolved: true, action: "hu", seat, kind };
}

function applyPeng(game, seat, tile, from) {
  takeDiscard(game);
  const p = game.players[seat];
  p.hand = sortTiles(removeMany(p.hand, [tile, tile]));
  p.melds.push({ type: "peng", tiles: [tile, tile, tile], from });
  game.turn = seat;
  game.phase = "discard";
  game.claimQueue = null;
  game.humanClaimOptions = null;
  game.activeHumanSeat = p.isHuman ? seat : null;
  game.message = `${p.name} 碰！`;
  return { resolved: true, action: "peng", seat };
}

function applyGang(game, seat, tile, from) {
  takeDiscard(game);
  const p = game.players[seat];
  p.hand = sortTiles(removeMany(p.hand, [tile, tile, tile]));
  p.melds.push({ type: "mgang", tiles: [tile, tile, tile, tile], from });
  drawTile(game, seat);
  game.turn = seat;
  game.phase = "discard";
  game.claimQueue = null;
  game.humanClaimOptions = null;
  game.activeHumanSeat = p.isHuman ? seat : null;
  game.message = `${p.name} 杠！`;
  return { resolved: true, action: "gang", seat };
}

function applyChi(game, seat, opt, tile, from) {
  takeDiscard(game);
  const p = game.players[seat];
  p.hand = sortTiles(removeMany(p.hand, opt.tiles));
  p.melds.push({ type: "chi", tiles: opt.meld, from });
  game.turn = seat;
  game.phase = "discard";
  game.claimQueue = null;
  game.humanClaimOptions = null;
  game.activeHumanSeat = p.isHuman ? seat : null;
  game.message = `${p.name} 吃！`;
  return { resolved: true, action: "chi", seat };
}

function humanOptionsFor(game, seat) {
  const tile = game.lastDiscard;
  const p = game.players[seat];
  const opts = [];
  if (canWinHand([...p.hand, tile])) opts.push({ type: "hu", label: "胡！" });
  if (canMingGang(p.hand, tile)) opts.push({ type: "gang", label: "杠" });
  if (canPeng(p.hand, tile)) opts.push({ type: "peng", label: "碰" });
  if ((game.lastDiscarder + 1) % 4 === seat) {
    for (const o of canFormChi(p.hand, tile)) {
      opts.push({ type: "chi", label: "吃", chi: o });
    }
  }
  opts.push({ type: "pass", label: "过" });
  return opts;
}

/**
 * 处理鸣牌队列：同优先级先问人类；AI 自动决定
 */
export function resolveClaims(game) {
  if (!game.claimQueue?.length) {
    advanceTurn(game);
    return { resolved: true };
  }

  const tile = game.lastDiscard;
  const from = game.lastDiscarder;
  const queue = game.claimQueue;

  // 有人类可操作时，按队列顺序（已按优先级排好）询问第一位人类
  for (const c of queue) {
    if (!game.players[c.seat].isHuman) continue;
    game.humanClaimOptions = humanOptionsFor(game, c.seat);
    game.activeHumanSeat = c.seat;
    return { resolved: false, needHuman: c.seat, options: game.humanClaimOptions };
  }

  // 全是 AI：按优先级尝试执行
  for (const c of queue) {
    const p = game.players[c.seat];
    if (c.type === "hu" && aiWantHu([...p.hand, tile], aiOpts(game))) {
      const t = takeDiscard(game);
      return finishHu(game, c.seat, "dianpao", from, t);
    }
    if (c.type === "gang" && aiWantGang(p.hand, tile, p.melds, game.wallLeft, aiOpts(game))) {
      return applyGang(game, c.seat, tile, from);
    }
    if (c.type === "peng" && aiWantPeng(p.hand, tile, p.melds, aiOpts(game))) {
      return applyPeng(game, c.seat, tile, from);
    }
    if (c.type === "chi") {
      const opt = aiWantChi(p.hand, tile, p.melds, aiOpts(game));
      if (opt) return applyChi(game, c.seat, opt, tile, from);
    }
  }

  advanceTurn(game);
  return { resolved: true };
}

export function humanClaim(game, seat, action) {
  if (!game.players[seat].isHuman) return { ok: false };
  const tile = game.lastDiscard;
  const from = game.lastDiscarder;

  if (action.type === "pass") {
    game.claimQueue = (game.claimQueue || []).filter((c) => c.seat !== seat);
    game.humanClaimOptions = null;
    return resolveClaims(game);
  }
  if (action.type === "hu") {
    const t = takeDiscard(game);
    return finishHu(game, seat, "dianpao", from, t);
  }
  if (action.type === "gang") return applyGang(game, seat, tile, from);
  if (action.type === "peng") return applyPeng(game, seat, tile, from);
  if (action.type === "chi") return applyChi(game, seat, action.chi, tile, from);
  return { ok: false };
}

export function declareZimo(game, seat) {
  if (game.turn !== seat || game.phase !== "discard") return { ok: false };
  if (!canWinHand(game.players[seat].hand)) return { ok: false, error: "不能胡" };
  return { ok: true, ...finishHu(game, seat, "zimo", null, null) };
}

export function doAnGang(game, seat, tile) {
  const p = game.players[seat];
  if (!canAnGang(p.hand).includes(tile)) return { ok: false };
  p.hand = sortTiles(removeMany(p.hand, [tile, tile, tile, tile]));
  p.melds.push({ type: "angang", tiles: [tile, tile, tile, tile], from: seat });
  drawTile(game, seat);
  game.message = `${p.name} 暗杠`;
  return { ok: true };
}

export function doJiaGang(game, seat, tile) {
  const p = game.players[seat];
  if (!canJiaGang(p.hand, p.melds).includes(tile)) return { ok: false };
  p.hand = sortTiles(removeOne(p.hand, tile));
  const meld = p.melds.find((m) => m.type === "peng" && m.tiles[0] === tile);
  if (meld) {
    meld.type = "jiagang";
    meld.tiles = [tile, tile, tile, tile];
  }
  drawTile(game, seat);
  game.message = `${p.name} 加杠`;
  return { ok: true };
}

export function playAIDiscardPhase(game) {
  const seat = game.turn;
  const p = game.players[seat];
  if (p.isHuman) return { needHuman: true, seat };

  const act = aiAfterDrawActions(p.hand, p.melds, game.wallLeft, aiOpts(game));
  if (act.type === "hu") {
    finishHu(game, seat, "zimo", null, null);
    return { action: "hu", seat };
  }
  if (act.type === "angang") {
    doAnGang(game, seat, act.tile);
    return playAIDiscardPhase(game);
  }
  if (act.type === "jiagang") {
    doJiaGang(game, seat, act.tile);
    return playAIDiscardPhase(game);
  }
  return discardTile(game, seat, act.tile);
}

export function getTurnActions(game, seat) {
  const p = game.players[seat];
  const actions = [];
  if (canWinHand(p.hand)) actions.push({ type: "hu", label: "自摸" });
  for (const t of canAnGang(p.hand)) actions.push({ type: "angang", tile: t, label: `暗杠` });
  for (const t of canJiaGang(p.hand, p.melds)) actions.push({ type: "jiagang", tile: t, label: `加杠` });
  return actions;
}

export function nextRound(game) {
  if (game.winner != null && game.winner !== game.dealer) {
    game.dealer = (game.dealer + 1) % 4;
  } else if (game.winner == null) {
    game.dealer = (game.dealer + 1) % 4;
  }
  game.round += 1;
  startRound(game);
}

/** 发给某座位玩家的脱敏状态（异地联网用） */
export function publicState(game, viewerSeat) {
  const revealAll = game.phase === "result";
  const me = game.players[viewerSeat];
  const canSuggest =
    game.phase === "discard" && game.turn === viewerSeat && me?.hand?.length > 0;
  return {
    mode: game.mode,
    dealer: game.dealer,
    turn: game.turn,
    phase: game.phase,
    lastDiscard: game.lastDiscard,
    lastDiscarder: game.lastDiscarder,
    winner: game.winner,
    winInfo: game.winInfo,
    message: game.message,
    round: game.round,
    wallLeft: game.wallLeft,
    activeHumanSeat: game.activeHumanSeat,
    humanClaimOptions:
      game.activeHumanSeat === viewerSeat ? game.humanClaimOptions : null,
    turnActions:
      game.phase === "discard" && game.turn === viewerSeat
        ? getTurnActions(game, viewerSeat)
        : [],
    suggestDiscard: canSuggest ? aiChooseDiscard(me.hand, me.melds, { perfect: true }) : null,
    blunderRate: game.blunderRate,
    players: game.players.map((p) => {
      const showHand = revealAll || p.seat === viewerSeat;
      return {
        seat: p.seat,
        name: p.name,
        isHuman: p.isHuman,
        team: p.team,
        score: p.score,
        melds: p.melds,
        discards: p.discards,
        handCount: p.hand.length,
        hand: showHand ? p.hand : null,
      };
    }),
  };
}

export { canWinHand, sortTiles };
