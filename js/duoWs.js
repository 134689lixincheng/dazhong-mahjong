/**
 * WebSocket 双人联机（对接 local-server.mjs）
 * 适合香港/国内 VPS 反代，延迟远低于默认 PeerJS 云信令。
 */

export function createDuoWs({ url, onLobby, onState, onError }) {
  let ws = null;
  let closed = false;

  function send(msg) {
    if (ws?.readyState === 1) ws.send(JSON.stringify(msg));
  }

  function connect() {
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(url);
      const timer = setTimeout(() => {
        try {
          socket.close();
        } catch {}
        reject(new Error("连接加速节点超时"));
      }, 8000);
      socket.addEventListener("open", () => {
        clearTimeout(timer);
        ws = socket;
        resolve();
      });
      socket.addEventListener("error", () => {
        clearTimeout(timer);
        reject(new Error("无法连接加速节点"));
      });
      socket.addEventListener("close", () => {
        if (ws === socket) ws = null;
        if (!closed) onError?.("与加速节点断开");
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

  return {
    role: "ws",
    async create(name, blunderRate) {
      await connect();
      send({ type: "create", mode: "duo", name, blunderRate });
    },
    async join(code, name) {
      await connect();
      send({ type: "join", code, name });
    },
    setReady(name) {
      send({ type: "ready", name });
    },
    sendAction(payload) {
      send({ type: "action", ...payload });
    },
    /** 与 P2P host 接口对齐：WS 模式下双方都走 sendAction */
    localAction(payload) {
      send({ type: "action", ...payload });
    },
    destroy() {
      closed = true;
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
