/**
 * WebSocket 双人联机（对接 local-server.mjs / Render）
 */

export function createDuoWs({ url, onLobby, onState, onError, onStatus }) {
  let ws = null;
  let closed = false;
  let keepAlive = null;

  function send(msg) {
    if (ws?.readyState === 1) ws.send(JSON.stringify(msg));
  }

  /** 对局期间定期发包，免费实例就不会中途休眠 */
  function startKeepAlive() {
    stopKeepAlive();
    keepAlive = setInterval(() => send({ type: "ping" }), 240000);
  }

  function stopKeepAlive() {
    if (keepAlive) clearInterval(keepAlive);
    keepAlive = null;
  }

  function connectOnce(timeoutMs) {
    return new Promise((resolve, reject) => {
      let settled = false;
      const socket = new WebSocket(url);
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        try {
          socket.close();
        } catch {}
        reject(new Error("连接超时"));
      }, timeoutMs);
      socket.addEventListener("open", () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        ws = socket;
        resolve();
      });
      socket.addEventListener("error", () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(new Error("无法连接联机服务"));
      });
      socket.addEventListener("close", () => {
        if (ws === socket) ws = null;
        if (!closed && !settled) {
          settled = true;
          clearTimeout(timer);
          reject(new Error("联机服务未就绪"));
        } else if (!closed && settled) {
          onError?.("与联机服务断开，请重新加入");
        }
      });
      socket.addEventListener("message", (ev) => {
        let msg;
        try {
          msg = JSON.parse(ev.data);
        } catch {
          return;
        }
        if (msg.type === "error") onError?.(msg.message);
        if (msg.type === "room") onLobby?.(msg.room, msg.seat);
        if (msg.type === "state") onState?.(msg.state, msg.room, msg.seat);
      });
    });
  }

  async function connect() {
    let lastErr;
    for (let i = 0; i < 3; i++) {
      try {
        await connectOnce(10000);
        startKeepAlive();
        return;
      } catch (e) {
        lastErr = e;
        onStatus?.(`正在重试连接…（${i + 1}/3）`);
        await new Promise((r) => setTimeout(r, 1200));
      }
    }
    throw lastErr || new Error("无法连接联机服务，请稍后重试");
  }

  return {
    role: "ws",
    async create(name, blunderRate) {
      await connect();
      send({ type: "create", mode: "duo", name, blunderRate });
    },
    async join(code, name) {
      await connect();
      send({ type: "join", code: String(code).trim().toUpperCase(), name });
    },
    setReady(name) {
      send({ type: "ready", name });
    },
    sendAction(payload) {
      send({ type: "action", ...payload });
    },
    localAction(payload) {
      send({ type: "action", ...payload });
    },
    destroy() {
      closed = true;
      stopKeepAlive();
      try {
        send({ type: "leave" });
      } catch {}
      try {
        ws?.close();
      } catch {}
      ws = null;
    },
  };
}
