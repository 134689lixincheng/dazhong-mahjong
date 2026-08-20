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

function makeCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 5; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

/**
 * 房主端：在本机跑权威牌局，通过 PeerJS 把状态同步给队友。
 */
export function createDuoHost({ name, onState, onLobby, onError }) {
  const code = makeCode();
  const peerId = `mj-${code}`;
  let peer = null;
  let conn = null;
  let game = null;
  let running = false;
  let alive = true;
  const names = [name || "玩家甲", "电脑·南", "玩家乙", "电脑·北"];
  let guestReady = false;
  let hostReady = false;
  let guestName = "玩家乙";

  function lobbySnapshot() {
    return {
      code,
      mode: "duo",
      status: game ? (game.phase === "result" ? "result" : "playing") : "lobby",
      players: [
        { seat: 0, name: names[0], isHuman: true, ready: hostReady, online: true, team: 0 },
        { seat: 1, name: names[1], isHuman: false, ready: true, online: true, team: 1 },
        {
          seat: 2,
          name: names[2],
          isHuman: true,
          ready: guestReady,
          online: !!conn,
          team: 0,
        },
        { seat: 3, name: names[3], isHuman: false, ready: true, online: true, team: 1 },
      ],
    };
  }

  function pushLobby() {
    const room = lobbySnapshot();
    onLobby?.(room, 0);
    send({ type: "room", room, seat: 2 });
  }

  function pushState() {
    if (!game) return;
    const room = lobbySnapshot();
    onState?.(publicState(game, 0), room, 0);
    send({
      type: "state",
      room,
      seat: 2,
      state: publicState(game, 2),
    });
  }

  function send(msg) {
    if (conn?.open) conn.send(msg);
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
    if (hostReady && guestReady && conn?.open && !game) {
      game = createGame({
        mode: "duo",
        names,
        blunderRate: getBlunderRate(),
      });
      startRound(game);
      pushState();
      void runLoop();
    } else {
      pushLobby();
    }
  }

  function handleGuestMsg(msg) {
    if (!msg || typeof msg !== "object") return;
    if (msg.type === "ready") {
      guestReady = true;
      if (msg.name) {
        guestName = msg.name;
        names[2] = msg.name;
      }
      maybeStart();
      return;
    }
    if (msg.type === "action" && game) {
      const seat = 2;
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
  }

  async function start() {
    const { default: Peer } = await import("https://esm.sh/peerjs@1.5.4");
    peer = new Peer(peerId, { debug: 1 });
    await new Promise((resolve, reject) => {
      peer.on("open", resolve);
      peer.on("error", reject);
    });
    peer.on("connection", (c) => {
      conn = c;
      c.on("open", () => {
        pushLobby();
      });
      c.on("data", (data) => handleGuestMsg(data));
      c.on("close", () => {
        conn = null;
        guestReady = false;
        if (!game) pushLobby();
        else onError?.("队友已断开");
      });
    });
    pushLobby();
    return { code, peerId };
  }

  return {
    role: "host",
    code,
    async start() {
      return start();
    },
    setReady(n) {
      hostReady = true;
      if (n) names[0] = n;
      maybeStart();
    },
    localAction(msg) {
      if (!game) return;
      const seat = 0;
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
    },
    destroy() {
      alive = false;
      try {
        conn?.close();
      } catch {}
      try {
        peer?.destroy();
      } catch {}
    },
  };
}

/**
 * 队友端：连接房主 Peer，收状态、发操作。
 */
export function createDuoGuest({ code, name, onState, onLobby, onError }) {
  const peerIdHost = `mj-${String(code).trim().toUpperCase()}`;
  let peer = null;
  let conn = null;
  let alive = true;

  function send(msg) {
    if (conn?.open) conn.send(msg);
  }

  async function start() {
    const { default: Peer } = await import("https://esm.sh/peerjs@1.5.4");
    peer = new Peer({ debug: 1 });
    await new Promise((resolve, reject) => {
      peer.on("open", resolve);
      peer.on("error", reject);
    });
    conn = peer.connect(peerIdHost, { reliable: true });
    await new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error("连接房间超时，请确认房间码")), 12000);
      conn.on("open", () => {
        clearTimeout(t);
        resolve();
      });
      conn.on("error", (e) => {
        clearTimeout(t);
        reject(e);
      });
      peer.on("error", (e) => {
        clearTimeout(t);
        reject(e);
      });
    });
    conn.on("data", (msg) => {
      if (msg?.type === "room") onLobby?.(msg.room, msg.seat ?? 2);
      if (msg?.type === "state") onState?.(msg.state, msg.room, msg.seat ?? 2);
      if (msg?.type === "error") onError?.(msg.message);
    });
    conn.on("close", () => {
      if (alive) onError?.("与房主连接已断开");
    });
  }

  return {
    role: "guest",
    async start() {
      return start();
    },
    setReady(n) {
      send({ type: "ready", name: n || name });
    },
    sendAction(msg) {
      send({ type: "action", ...msg });
    },
    destroy() {
      alive = false;
      try {
        conn?.close();
      } catch {}
      try {
        peer?.destroy();
      } catch {}
    },
  };
}
