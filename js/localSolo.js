import {
  createGame,
  startRound,
  beginTurnDraw,
  discardTile,
  resolveClaims,
  humanClaim,
  declareZimo,
  doAnGang,
  doJiaGang,
  playAIDiscardPhase,
  nextRound,
  publicState,
} from "./game.js";

/**
 * 纯前端单人局（无 WebSocket，适合 Vercel 静态托管）
 */
export function createLocalSolo(name = "你", { blunderRate = null } = {}) {
  const game = createGame({
    mode: "solo",
    names: [name, "电脑·南", "电脑·西", "电脑·北"],
    blunderRate,
  });
  startRound(game);
  return {
    game,
    seat: 0,
    running: false,
    getState() {
      return publicState(this.game, 0);
    },
  };
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function runLocalLoop(session, onUpdate) {
  if (session.running) return;
  session.running = true;
  const g = session.game;
  try {
    while (g.phase !== "result" && session.alive !== false) {
      if (g.phase === "draw") {
        beginTurnDraw(g);
        onUpdate();
        if (g.phase === "result") break;
        await sleep(260);
        continue;
      }
      if (g.phase === "discard") {
        if (g.players[g.turn].isHuman) {
          onUpdate();
          break;
        }
        await sleep(400);
        playAIDiscardPhase(g);
        onUpdate();
        if (g.phase === "result") break;
        continue;
      }
      if (g.phase === "claim") {
        const r = resolveClaims(g);
        onUpdate();
        if (g.phase === "result") break;
        if (r.needHuman != null) break;
        await sleep(200);
        continue;
      }
      break;
    }
  } finally {
    session.running = false;
    onUpdate();
  }
}

export function localDiscard(session, tile) {
  const r = discardTile(session.game, 0, tile);
  return r;
}

export function localClaim(session, action) {
  return humanClaim(session.game, session.game.activeHumanSeat ?? 0, action);
}

export function localZimo(session) {
  return declareZimo(session.game, 0);
}

export function localAnGang(session, tile) {
  return doAnGang(session.game, 0, tile);
}

export function localJiaGang(session, tile) {
  return doJiaGang(session.game, 0, tile);
}

export function localNext(session) {
  nextRound(session.game);
}
