import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer } from "ws";
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
} from "./js/game.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 5173;
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

const rooms = new Map(); // code -> Room

function makeCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 5; i++) s += chars[Math.floor(Math.random() * chars.length)];
  if (rooms.has(s)) return makeCode();
  return s;
}

function send(ws, msg) {
  if (ws.readyState === 1) ws.send(JSON.stringify(msg));
}

function broadcastRoom(room, exceptSeat = null) {
  for (const [seat, client] of room.clients) {
    if (exceptSeat != null && seat === exceptSeat) continue;
    if (!room.game) {
      send(client.ws, { type: "room", room: roomPublic(room), seat });
      continue;
    }
    send(client.ws, {
      type: "state",
      room: roomPublic(room),
      seat,
      state: publicState(room.game, seat),
    });
  }
}

function roomPublic(room) {
  return {
    code: room.code,
    mode: room.mode,
    status: room.status,
    players: [0, 1, 2, 3].map((i) => {
      const c = room.clients.get(i);
      const slot = room.slots[i];
      return {
        seat: i,
        name: slot.name,
        isHuman: slot.isHuman,
        ready: !!c?.ready,
        online: !!c,
        team: room.mode === "duo" ? i % 2 : i,
      };
    }),
  };
}

function createRoom(mode, hostName, blunderRate = 0.12) {
  const code = makeCode();
  const isDuo = mode === "duo";
  const room = {
    code,
    mode,
    status: "lobby", // lobby | playing | result
    blunderRate: Math.min(1, Math.max(0, Number(blunderRate) || 0)),
    slots: [0, 1, 2, 3].map((i) => ({
      isHuman: isDuo ? i === 0 || i === 2 : i === 0,
      name: isDuo
        ? ["主机", "电脑·南", "队友", "电脑·北"][i]
        : ["你", "电脑·南", "电脑·西", "电脑·北"][i],
    })),
    clients: new Map(),
    game: null,
    running: false,
  };
  room.slots[0].name = hostName || (isDuo ? "主机" : "你");
  rooms.set(code, room);
  return room;
}

function attachClient(room, seat, ws, name) {
  const prev = room.clients.get(seat);
  if (prev && prev.ws !== ws) {
    try {
      send(prev.ws, { type: "error", message: "座位被重新连接占用" });
      prev.ws.close();
    } catch {}
  }
  if (name) room.slots[seat].name = name;
  room.clients.set(seat, { ws, ready: false, name: room.slots[seat].name });
  ws.roomCode = room.code;
  ws.seat = seat;
}

function detachClient(ws) {
  const room = rooms.get(ws.roomCode);
  if (!room) return;
  room.clients.delete(ws.seat);
  if (room.status === "lobby" && room.clients.size === 0) {
    rooms.delete(room.code);
    return;
  }
  broadcastRoom(room);
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * 推进到需要人类操作或终局为止。
 * 等待人类时必须 break，禁止空转广播（否则会 OOM）。
 */
async function runServerLoop(room) {
  if (room.running) return;
  room.running = true;
  try {
    while (room.game && room.status === "playing") {
      const g = room.game;

      if (g.phase === "result") {
        room.status = "result";
        broadcastRoom(room);
        break;
      }

      if (g.phase === "draw") {
        beginTurnDraw(g);
        broadcastRoom(room);
        if (g.phase === "result") {
          room.status = "result";
          broadcastRoom(room);
          break;
        }
        await sleep(280);
        continue;
      }

      if (g.phase === "discard") {
        const seat = g.turn;
        if (g.players[seat].isHuman) {
          broadcastRoom(room);
          break; // 等人出牌
        }
        await sleep(420);
        playAIDiscardPhase(g);
        broadcastRoom(room);
        if (g.phase === "result") {
          room.status = "result";
          broadcastRoom(room);
          break;
        }
        continue;
      }

      if (g.phase === "claim") {
        const waiting = resolveAndBroadcastClaims(room);
        if (room.status === "result") break;
        if (waiting) break; // 等人鸣牌，停住
        await sleep(220);
        continue;
      }

      // 未知阶段，避免死转
      console.warn("unknown phase", g.phase);
      break;
    }
  } finally {
    room.running = false;
  }
}

/** @returns {boolean} true = 正在等人类 */
function resolveAndBroadcastClaims(room) {
  const g = room.game;
  const r = resolveClaims(g);
  broadcastRoom(room);
  if (g.phase === "result") {
    room.status = "result";
    broadcastRoom(room);
    return false;
  }
  if (g.phase === "claim" && r.needHuman != null) return true;
  return false;
}

function resumeAfterAction(room) {
  if (room.status === "playing" && !room.running) {
    void runServerLoop(room);
  }
}

function startGame(room) {
  const names = room.slots.map((s) => s.name);
  room.game = createGame({
    mode: room.mode,
    names,
    blunderRate: room.blunderRate ?? 0.12,
  });
  startRound(room.game);
  room.status = "playing";
  broadcastRoom(room);
  void runServerLoop(room);
}

function handleAction(ws, msg) {
  const room = rooms.get(ws.roomCode);
  if (!room?.game) return;
  const seat = ws.seat;
  const g = room.game;

  if (msg.action === "discard") {
    if (g.phase !== "discard" || g.turn !== seat) return;
    const r = discardTile(g, seat, msg.tile);
    broadcastRoom(room);
    if (!r.ok) return;
    resumeAfterAction(room);
    return;
  }

  if (msg.action === "claim") {
    if (g.activeHumanSeat !== seat) return;
    humanClaim(g, seat, msg.claim);
    if (g.phase === "result") {
      room.status = "result";
    }
    broadcastRoom(room);
    resumeAfterAction(room);
    return;
  }

  if (msg.action === "zimo") {
    declareZimo(g, seat);
    room.status = "result";
    broadcastRoom(room);
    return;
  }

  if (msg.action === "angang") {
    doAnGang(g, seat, msg.tile);
    broadcastRoom(room);
    return;
  }

  if (msg.action === "jiagang") {
    doJiaGang(g, seat, msg.tile);
    broadcastRoom(room);
    return;
  }

  if (msg.action === "next") {
    if (room.status !== "result") return;
    nextRound(g);
    room.status = "playing";
    broadcastRoom(room);
    void runServerLoop(room);
  }
}

function findFreeHumanSeat(room) {
  for (let i = 0; i < 4; i++) {
    if (room.slots[i].isHuman && !room.clients.has(i)) return i;
  }
  return -1;
}

const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent(req.url.split("?")[0]);
  if (urlPath === "/") urlPath = "/index.html";
  const filePath = path.join(__dirname, urlPath);
  if (!filePath.startsWith(__dirname) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404);
    res.end("Not found");
    return;
  }
  const ext = path.extname(filePath);
  res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
  fs.createReadStream(filePath).pipe(res);
});

const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
  ws.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(String(raw));
    } catch {
      return;
    }

    if (msg.type === "create") {
      const mode = msg.mode === "duo" ? "duo" : "solo";
      const rate =
        msg.blunderRate != null ? Number(msg.blunderRate) : 0.12;
      const room = createRoom(mode, msg.name, rate);
      attachClient(room, 0, ws, msg.name);
      if (mode === "solo") {
        room.clients.get(0).ready = true;
        startGame(room);
      } else {
        send(ws, { type: "room", room: roomPublic(room), seat: 0 });
      }
      return;
    }

    if (msg.type === "join") {
      const code = String(msg.code || "")
        .trim()
        .toUpperCase();
      const room = rooms.get(code);
      if (!room) {
        send(ws, { type: "error", message: "房间不存在" });
        return;
      }
      if (room.mode !== "duo") {
        send(ws, { type: "error", message: "该房间不可加入" });
        return;
      }
      if (room.status !== "lobby") {
        // 允许断线重连
        const seat = findFreeHumanSeat(room);
        if (seat < 0) {
          send(ws, { type: "error", message: "对局已开始且座位已满" });
          return;
        }
      }
      let seat = findFreeHumanSeat(room);
      if (seat < 0) {
        send(ws, { type: "error", message: "房间已满" });
        return;
      }
      attachClient(room, seat, ws, msg.name);
      broadcastRoom(room);
      return;
    }

    if (msg.type === "ready") {
      const room = rooms.get(ws.roomCode);
      if (!room || room.status !== "lobby") return;
      const c = room.clients.get(ws.seat);
      if (c) c.ready = true;
      if (msg.name) room.slots[ws.seat].name = msg.name;
      broadcastRoom(room);
      const humans = room.slots.filter((s) => s.isHuman).length;
      const readyCount = [...room.clients.values()].filter((x) => x.ready).length;
      if (readyCount >= humans && room.clients.size >= humans) {
        startGame(room);
      }
      return;
    }

    if (msg.type === "action") {
      handleAction(ws, msg);
      return;
    }

    if (msg.type === "leave") {
      detachClient(ws);
    }
  });

  ws.on("close", () => detachClient(ws));
});

server.listen(PORT, () => {
  console.log(`大众麻将服务器 http://localhost:${PORT}`);
});
