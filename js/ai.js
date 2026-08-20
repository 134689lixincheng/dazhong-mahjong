import { canAnGang, canJiaGang, canMingGang, canPeng, canFormChi, removeOne, removeMany, sortTiles } from "./tiles.js";
import { canWinHand, handEfficiency, waitingTiles } from "./win.js";
import { getBlunderRate } from "./aiConfig.js";

/**
 * @param {object} [opts]
 * @param {number} [opts.blunderRate] 昏棋率 0~1；不传则读后台配置
 * @param {() => number} [opts.rng]
 * @param {boolean} [opts.perfect] 为 true 时忽略昏棋（建议出牌用）
 */
function rateOf(opts = {}) {
  if (opts.perfect) return 0;
  if (opts.blunderRate != null) return Math.min(1, Math.max(0, opts.blunderRate));
  return getBlunderRate();
}

function rngOf(opts = {}) {
  return opts.rng || Math.random;
}

function scoreDiscard(hand, tile, openCount) {
  const next = removeOne(hand, tile);
  const score = handEfficiency(next, openCount);
  return score - tileDanger(tile) * 0.15;
}

/** 按分数排序的候选打出 */
function rankedDiscards(hand, openMelds = []) {
  const openCount = openMelds.length;
  const unique = [...new Set(hand)];
  return unique
    .map((tile) => ({ tile, score: scoreDiscard(hand, tile, openCount) }))
    .sort((a, b) => b.score - a.score);
}

/**
 * AI 选打。昏棋时从较差候选里随机抽一张。
 */
export function aiChooseDiscard(hand, openMelds = [], opts = {}) {
  const ranked = rankedDiscards(hand, openMelds);
  if (!ranked.length) return hand[0];

  const blunder = rateOf(opts);
  const rng = rngOf(opts);

  if (blunder <= 0 || ranked.length === 1 || rng() >= blunder) {
    return ranked[0].tile;
  }

  // 昏棋：越差权重越高（排除最优）
  const bad = ranked.slice(1);
  const weights = bad.map((_, i) => i + 1);
  const sum = weights.reduce((a, b) => a + b, 0);
  let r = rng() * sum;
  for (let i = 0; i < bad.length; i++) {
    r -= weights[i];
    if (r <= 0) return bad[i].tile;
  }
  return bad[bad.length - 1].tile;
}

function tileDanger(id) {
  const suit = id[0];
  const num = Number(id.slice(1));
  if (suit === "z") return num >= 5 ? 0.2 : 0.8;
  if (num === 1 || num === 9) return 0.3;
  if (num === 2 || num === 8) return 0.5;
  return 0.7;
}

export function aiWantHu(hand14, opts = {}) {
  if (!canWinHand(hand14)) return false;
  // 昏棋：偶尔漏胡
  if (rateOf(opts) > 0 && rngOf(opts)() < rateOf(opts) * 0.35) return false;
  return true;
}

export function aiWantPeng(hand, discard, openMelds, opts = {}) {
  if (!canPeng(hand, discard)) return false;
  const without = removeMany(hand, [discard, discard]);
  const after = handEfficiency(without, openMelds.length + 1);
  const before = handEfficiency(hand, openMelds.length);
  const should = after >= before - 0.3;
  const blunder = rateOf(opts);
  const rng = rngOf(opts);
  if (!should) {
    // 昏棋：偶尔乱碰
    return blunder > 0 && rng() < blunder * 0.25;
  }
  // 该碰时，昏棋偶尔放过
  if (blunder > 0 && rng() < blunder * 0.4) return false;
  return true;
}

export function aiWantGang(hand, discard, openMelds, wallLeft, opts = {}) {
  if (wallLeft < 4) return false;
  if (!canMingGang(hand, discard)) return false;
  const blunder = rateOf(opts);
  if (blunder > 0 && rngOf(opts)() < blunder * 0.3) return false;
  return true;
}

export function aiWantChi(hand, discard, openMelds, opts = {}) {
  const chiOpts = canFormChi(hand, discard);
  if (!chiOpts.length) return null;
  let best = null;
  let bestScore = -Infinity;
  const before = handEfficiency(hand, openMelds.length);
  for (const opt of chiOpts) {
    const without = removeMany(hand, opt.tiles);
    const after = handEfficiency(without, openMelds.length + 1);
    if (after > bestScore && after >= before - 0.5) {
      bestScore = after;
      best = opt;
    }
  }
  const blunder = rateOf(opts);
  const rng = rngOf(opts);
  if (!best) {
    if (blunder > 0 && rng() < blunder * 0.2) return chiOpts[Math.floor(rng() * chiOpts.length)];
    return null;
  }
  if (blunder > 0 && rng() < blunder * 0.4) return null;
  if (blunder > 0 && rng() < blunder * 0.25 && chiOpts.length > 1) {
    const others = chiOpts.filter((o) => o !== best);
    return others[Math.floor(rng() * others.length)] || best;
  }
  return best;
}

export function aiAnGangChoice(hand, openMelds, wallLeft, opts = {}) {
  if (wallLeft < 4) return null;
  const gangs = canAnGang(hand);
  if (!gangs.length) return null;
  if (rateOf(opts) > 0 && rngOf(opts)() < rateOf(opts) * 0.35) return null;
  return gangs[0];
}

export function aiJiaGangChoice(hand, openMelds, wallLeft, opts = {}) {
  if (wallLeft < 4) return null;
  const gangs = canJiaGang(hand, openMelds);
  if (!gangs.length) return null;
  if (rateOf(opts) > 0 && rngOf(opts)() < rateOf(opts) * 0.35) return null;
  return gangs[0];
}

export function aiAfterDrawActions(hand, openMelds, wallLeft, opts = {}) {
  if (canWinHand(hand) && aiWantHu(hand, opts)) return { type: "hu" };
  const an = aiAnGangChoice(hand, openMelds, wallLeft, opts);
  if (an) return { type: "angang", tile: an };
  const jia = aiJiaGangChoice(hand, openMelds, wallLeft, opts);
  if (jia) return { type: "jiagang", tile: jia };
  return { type: "discard", tile: aiChooseDiscard(hand, openMelds, opts) };
}

export function explainWaits(hand13) {
  return waitingTiles(hand13);
}

export { sortTiles };
