/**
 * 双人房间的通用逻辑（与传输方式无关）。
 * 房主在本机跑权威牌局，通过 channel 把状态同步给队友。
 *
 * channel 需要提供：start() / send(msg) / isOpen() / close()
 * 以及可赋值的回调：onMessage / onPeerJoin / onPeerLeave
 */
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
import { getBlunderRate } from "./aiConfig.js";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export function createHostRoom({ code, name, channel, onState, onLobby, onError }) {
  let game = null;
  let running = false;
  let alive = true;
  const names = [name || "玩家甲", "电脑·南", "玩家乙", "电脑·北"];
  let guestReady = false;
  let hostReady = false;

  function lobbySnapshot() {
    return {
      code,
      mode: "duo",
      status: game ? (game.phase === "result" ? "result" : "playing") : "lobby",
      players: [
        { seat: 0, name: names[0], isHuman: true, ready: hostReady, online: true, team: 0 },
        { seat: 1, name: names[1], isHuman: false, ready: true, online: true, team: 1 },
        { seat: 2, name: names[2], isHuman: true, ready: guestReady, online: channel.isOpen(), team: 0 },
        { seat: 3, name: names[3], isHuman: false, ready: true, online: true, team: 1 },
      ],
    };
  }

  function pushLobby() {
    const room = lobbySnapshot();
    onLobby?.(room, 0);
    channel.send({ type: "room", room, seat: 2 });
  }

  function pushState() {
    if (!game) return;
    const room = lobbySnapshot();
    onState?.(publicState(game, 0), room, 0);
    channel.send({ type: "state", room, seat: 2, state: publicState(game, 2) });
  }

  async function runLoop() {
    if (running || !game || !alive) return;
    running = true;
    try {
      while (alive && game && game.phase !== "result") {
        if (game.phase === "draw") {
          beginTurnDraw(game);
          pushState();
          if (game.phase === "result") break;
          await sleep(260);
          continue;
        }
        if (game.phase === "discard") {
          const seat = game.turn;
          if (game.players[seat].isHuman) {
            pushState();
            break;
          }
          await sleep(400);
          playAIDiscardPhase(game);
          pushState();
          if (game.phase === "result") break;
          continue;
        }
        if (game.phase === "claim") {
          const r = resolveClaims(game);
          pushState();
          if (game.phase === "result") break;
          if (r.needHuman != null) break;
          await sleep(200);
          continue;
        }
        break;
      }
    } finally {
      running = false;
      pushState();
    }
  }

  function maybeStart() {
    if (hostReady && guestReady && channel.isOpen() && !game) {
      game = createGame({ mode: "duo", names, blunderRate: getBlunderRate() });
      startRound(game);
      pushState();
      void runLoop();
    } else {
      pushLobby();
    }
  }

  function applyAction(seat, msg) {
    if (!game) return;
    if (msg.action === "discard") {
      discardTile(game, seat, msg.tile);
      pushState();
      void runLoop();
    } else if (msg.action === "claim") {
      humanClaim(game, game.activeHumanSeat ?? seat, msg.claim);
      pushState();
      void runLoop();
    } else if (msg.action === "zimo") {
      declareZimo(game, seat);
      pushState();
    } else if (msg.action === "angang") {
      doAnGang(game, seat, msg.tile);
      pushState();
    } else if (msg.action === "jiagang") {
      doJiaGang(game, seat, msg.tile);
      pushState();
    } else if (msg.action === "next") {
      nextRound(game);
      pushState();
      void runLoop();
    }
  }

  channel.onPeerJoin = (peerName) => {
    if (peerName) names[2] = peerName;
    if (game) pushState();
    else pushLobby();
  };

  channel.onPeerLeave = () => {
    guestReady = false;
    if (!game) pushLobby();
    else onError?.("队友已断开");
  };

  channel.onMessage = (msg) => {
    if (!msg || typeof msg !== "object") return;
    if (msg.type === "ready") {
      guestReady = true;
      if (msg.name) names[2] = msg.name;
      maybeStart();
      return;
    }
    if (msg.type === "action") applyAction(2, msg);
  };

  return {
    role: "host",
    code,
    async start() {
      await channel.start();
      pushLobby();
      return { code };
    },
    setReady(n) {
      hostReady = true;
      if (n) names[0] = n;
      maybeStart();
    },
    localAction(msg) {
      applyAction(0, msg);
    },
    destroy() {
      alive = false;
      try {
        channel.close();
      } catch {}
    },
  };
}

export function createGuestRoom({ name, channel, onState, onLobby, onError }) {
  let alive = true;

  channel.onMessage = (msg) => {
    if (msg?.type === "room") onLobby?.(msg.room, msg.seat ?? 2);
    if (msg?.type === "state") onState?.(msg.state, msg.room, msg.seat ?? 2);
    if (msg?.type === "error") onError?.(msg.message);
  };

  channel.onPeerLeave = () => {
    if (alive) onError?.("与房主连接已断开");
  };

  return {
    role: "guest",
    async start() {
      return channel.start();
    },
    setReady(n) {
      channel.send({ type: "ready", name: n || name });
    },
    sendAction(msg) {
      channel.send({ type: "action", ...msg });
    },
    destroy() {
      alive = false;
      try {
        channel.close();
      } catch {}
    },
  };
}
