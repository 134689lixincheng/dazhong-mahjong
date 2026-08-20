/** 牌面编码：m万 p筒 s条 z字(1东2南3西4北5中6发7白) */

export const SUITS = {
  m: { name: "万", color: "char" },
  p: { name: "筒", color: "dot" },
  s: { name: "条", color: "bamboo" },
  z: { name: "字", color: "honor" },
};

export const HONOR_LABELS = ["", "东", "南", "西", "北", "中", "发", "白"];
export const NUM_LABELS = ["", "一", "二", "三", "四", "五", "六", "七", "八", "九"];

export function tileId(suit, num) {
  return `${suit}${num}`;
}

export function parseTile(id) {
  return { suit: id[0], num: Number(id.slice(1)), id };
}

export function tileLabel(id) {
  const { suit, num } = parseTile(id);
  if (suit === "z") return HONOR_LABELS[num];
  return NUM_LABELS[num] + SUITS[suit].name;
}

export function tileSortKey(id) {
  const order = { m: 0, p: 1, s: 2, z: 3 };
  const { suit, num } = parseTile(id);
  return order[suit] * 10 + num;
}

export function sortTiles(tiles) {
  return [...tiles].sort((a, b) => tileSortKey(a) - tileSortKey(b));
}

/** 一副 136 张（无花牌） */
export function createFullSet() {
  const tiles = [];
  for (const suit of ["m", "p", "s"]) {
    for (let n = 1; n <= 9; n++) {
      for (let c = 0; c < 4; c++) tiles.push(tileId(suit, n));
    }
  }
  for (let n = 1; n <= 7; n++) {
    for (let c = 0; c < 4; c++) tiles.push(tileId("z", n));
  }
  return tiles;
}

export function shuffle(arr, rng = Math.random) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function countMap(tiles) {
  const m = new Map();
  for (const t of tiles) m.set(t, (m.get(t) || 0) + 1);
  return m;
}

export function removeOne(tiles, id) {
  const i = tiles.indexOf(id);
  if (i < 0) return null;
  const next = tiles.slice();
  next.splice(i, 1);
  return next;
}

export function removeMany(tiles, ids) {
  let next = tiles.slice();
  for (const id of ids) {
    next = removeOne(next, id);
    if (!next) return null;
  }
  return next;
}

export function isSameSuitNumber(a, b) {
  return a === b;
}

export function canFormChi(hand, discard) {
  const { suit, num } = parseTile(discard);
  if (suit === "z") return [];
  const options = [];
  const has = (n) => hand.includes(tileId(suit, n));
  // 吃法：discard 作为左/中/右
  const patterns = [
    [num - 2, num - 1, num],
    [num - 1, num, num + 1],
    [num, num + 1, num + 2],
  ];
  for (const p of patterns) {
    if (p.some((n) => n < 1 || n > 9)) continue;
    const need = p.filter((n) => n !== num).map((n) => tileId(suit, n));
    if (need.every((id) => has(parseTile(id).num) || hand.includes(id))) {
      // 校验手牌里真有这两张（且不是 discard 本身）
      let temp = hand.slice();
      let ok = true;
      for (const id of need) {
        const i = temp.indexOf(id);
        if (i < 0) {
          ok = false;
          break;
        }
        temp.splice(i, 1);
      }
      if (ok) options.push({ tiles: need, meld: [...need, discard].sort((a, b) => tileSortKey(a) - tileSortKey(b)), type: "chi" });
    }
  }
  // 去重
  const seen = new Set();
  return options.filter((o) => {
    const k = o.tiles.slice().sort().join(",");
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function canPeng(hand, discard) {
  return hand.filter((t) => t === discard).length >= 2;
}

export function canMingGang(hand, discard) {
  return hand.filter((t) => t === discard).length >= 3;
}

export function canAnGang(hand) {
  const c = countMap(hand);
  const out = [];
  for (const [id, n] of c) if (n >= 4) out.push(id);
  return out;
}

export function canJiaGang(hand, openMelds) {
  const out = [];
  for (const meld of openMelds) {
    if (meld.type === "peng" && hand.includes(meld.tiles[0])) {
      out.push(meld.tiles[0]);
    }
  }
  return out;
}
