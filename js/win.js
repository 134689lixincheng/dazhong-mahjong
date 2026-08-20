import { countMap, parseTile, tileId } from "./tiles.js";

/** 标准型：4 面子 + 1 将；另支持七对 */

function removeN(counts, id, n) {
  const v = (counts.get(id) || 0) - n;
  if (v < 0) return false;
  if (v === 0) counts.delete(id);
  else counts.set(id, v);
  return true;
}

function cloneCounts(m) {
  return new Map(m);
}

function tryMelds(counts) {
  if ([...counts.values()].every((v) => v === 0) || counts.size === 0) return true;

  let first = null;
  for (const [id, n] of counts) {
    if (n > 0) {
      first = id;
      break;
    }
  }
  if (!first) return true;

  const n = counts.get(first) || 0;

  // 刻子
  if (n >= 3) {
    const c = cloneCounts(counts);
    removeN(c, first, 3);
    if (tryMelds(c)) return true;
  }

  // 顺子（仅数牌）
  const { suit, num } = parseTile(first);
  if (suit !== "z" && num <= 7) {
    const a = first;
    const b = tileId(suit, num + 1);
    const c = tileId(suit, num + 2);
    if ((counts.get(a) || 0) >= 1 && (counts.get(b) || 0) >= 1 && (counts.get(c) || 0) >= 1) {
      const next = cloneCounts(counts);
      removeN(next, a, 1);
      removeN(next, b, 1);
      removeN(next, c, 1);
      if (tryMelds(next)) return true;
    }
  }

  return false;
}

export function isSevenPairs(tiles) {
  if (tiles.length !== 14) return false;
  const c = countMap(tiles);
  if (c.size !== 7) return false;
  for (const n of c.values()) if (n !== 2) return false;
  return true;
}

export function canWinHand(tiles) {
  if (tiles.length !== 14) return false;
  if (isSevenPairs(tiles)) return true;

  const counts = countMap(tiles);
  // 枚举将眼
  for (const [id, n] of [...counts]) {
    if (n < 2) continue;
    const c = cloneCounts(counts);
    removeN(c, id, 2);
    if (tryMelds(c)) return true;
  }
  return false;
}

/** 向听近似：完成面子数 + 搭子，越大越好（用于 AI） */
export function handEfficiency(tiles, openMeldCount = 0) {
  const needMelds = 4 - openMeldCount;
  const counts = countMap(tiles);
  let pairs = 0;
  let triples = 0;
  let sequences = 0;
  let taatsus = 0; // 两面/坎张/边张近似
  let isolates = 0;

  const used = new Map();
  const take = (id, n) => {
    used.set(id, (used.get(id) || 0) + n);
  };
  const avail = (id) => (counts.get(id) || 0) - (used.get(id) || 0);

  // 优先刻子
  for (const [id, n] of counts) {
    const k = Math.floor(n / 3);
    if (k) {
      triples += k;
      take(id, k * 3);
    }
  }

  // 顺子贪心
  for (const suit of ["m", "p", "s"]) {
    for (let num = 1; num <= 7; num++) {
      while (
        avail(tileId(suit, num)) > 0 &&
        avail(tileId(suit, num + 1)) > 0 &&
        avail(tileId(suit, num + 2)) > 0
      ) {
        sequences++;
        take(tileId(suit, num), 1);
        take(tileId(suit, num + 1), 1);
        take(tileId(suit, num + 2), 1);
      }
    }
  }

  // 对子
  for (const [id] of counts) {
    while (avail(id) >= 2) {
      pairs++;
      take(id, 2);
    }
  }

  // 搭子
  for (const suit of ["m", "p", "s"]) {
    for (let num = 1; num <= 8; num++) {
      const a = tileId(suit, num);
      const b = tileId(suit, num + 1);
      if (avail(a) > 0 && avail(b) > 0) {
        taatsus++;
        take(a, 1);
        take(b, 1);
      }
    }
    for (let num = 1; num <= 7; num++) {
      const a = tileId(suit, num);
      const c = tileId(suit, num + 2);
      if (avail(a) > 0 && avail(c) > 0) {
        taatsus++;
        take(a, 1);
        take(c, 1);
      }
    }
  }

  for (const [id] of counts) {
    isolates += avail(id);
  }

  const meldLike = triples + sequences;
  const pairBonus = Math.min(1, pairs) * 1.5;
  const extraPairs = Math.max(0, pairs - 1) * 0.4;
  const progress = meldLike * 3 + Math.min(needMelds - meldLike, taatsus) * 1.2 + pairBonus + extraPairs - isolates * 0.35;

  // 七对倾向
  let seven = 0;
  for (const n of counts.values()) {
    if (n >= 2) seven += Math.floor(n / 2);
    if (n === 4) seven += 0.2;
  }
  const sevenScore = seven * 1.1;

  return Math.max(progress, sevenScore);
}

/** 听牌检测：打出某张后是否听 */
export function waitingTiles(hand13) {
  if (hand13.length !== 13) return [];
  const waits = [];
  const candidates = new Set();
  for (const suit of ["m", "p", "s"]) {
    for (let n = 1; n <= 9; n++) candidates.add(tileId(suit, n));
  }
  for (let n = 1; n <= 7; n++) candidates.add(tileId("z", n));

  for (const t of candidates) {
    if (canWinHand([...hand13, t])) waits.push(t);
  }
  return waits;
}

export function isTenpai(hand13) {
  return waitingTiles(hand13).length > 0;
}
