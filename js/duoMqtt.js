/**
 * 双人联机：公共 MQTT 中继（EMQX，国内可直连、无休眠）
 * 房主仍是权威端，MQTT 只负责转发消息。
 */
import { createHostRoom, createGuestRoom } from "./duoRoom.js";

/** MQTT 房间码以 1 开头（服务端房间码不含 0/1） */
export const MQTT_CODE_PREFIX = "1";

export function isMqttCode(code) {
  return String(code || "").trim().startsWith(MQTT_CODE_PREFIX);
}

const BROKERS = ["wss://broker-cn.emqx.io:8084/mqtt", "wss://broker.emqx.io:8084/mqtt"];

let mqttLib = null;

async function loadMqtt() {
  if (mqttLib) return mqttLib;
  if (globalThis.mqtt) {
    mqttLib = globalThis.mqtt;
    return mqttLib;
  }
  await new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = new URL("../vendor/mqtt.min.js", import.meta.url).href;
    s.onload = resolve;
    s.onerror = () => reject(new Error("联机组件加载失败"));
    document.head.appendChild(s);
  });
  mqttLib = globalThis.mqtt;
  if (!mqttLib) throw new Error("联机组件未就绪");
  return mqttLib;
}

function makeCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = MQTT_CODE_PREFIX;
  for (let i = 0; i < 5; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function clientId(role) {
  return `mj-${role}-${Math.random().toString(36).slice(2, 10)}`;
}

async function connectBroker({ role, subTopic, willTopic }) {
  const mqtt = await loadMqtt();
  let lastErr;
  for (const url of BROKERS) {
    try {
      const client = await new Promise((resolve, reject) => {
        const c = mqtt.connect(url, {
          clientId: clientId(role),
          keepalive: 30,
          connectTimeout: 8000,
          reconnectPeriod: 2000,
          clean: true,
          will: {
            topic: willTopic,
            payload: JSON.stringify({ type: "bye" }),
            qos: 0,
            retain: false,
          },
        });
        const timer = setTimeout(() => {
          try {
            c.end(true);
          } catch {}
          reject(new Error("连接联机服务超时"));
        }, 9000);
        c.once("connect", () => {
          clearTimeout(timer);
          resolve(c);
        });
        c.once("error", (e) => {
          clearTimeout(timer);
          try {
            c.end(true);
          } catch {}
          reject(e instanceof Error ? e : new Error("联机服务连接失败"));
        });
      });
      await new Promise((resolve, reject) => {
        client.subscribe(subTopic, { qos: 0 }, (err) => (err ? reject(err) : resolve()));
      });
      return client;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error("无法连接联机服务");
}

/** 房主：等待队友通过同一房间码接入 */
export function createDuoHost({ name, onState, onLobby, onError }) {
  const code = makeCode();
  const base = `mj/v1/${code}`;
  let client = null;
  let peerOpen = false;

  const channel = {
    onMessage: null,
    onPeerJoin: null,
    onPeerLeave: null,
    async start() {
      client = await connectBroker({
        role: "host",
        subTopic: `${base}/g`,
        willTopic: `${base}/h`,
      });
      client.on("message", (_topic, payload) => {
        let msg;
        try {
          msg = JSON.parse(payload.toString());
        } catch {
          return;
        }
        if (msg.type === "hello") {
          peerOpen = true;
          channel.onPeerJoin?.(msg.name);
          return;
        }
        if (msg.type === "bye") {
          peerOpen = false;
          channel.onPeerLeave?.();
          return;
        }
        channel.onMessage?.(msg);
      });
    },
    send(msg) {
      if (client?.connected) client.publish(`${base}/h`, JSON.stringify(msg), { qos: 0 });
    },
    isOpen() {
      return Boolean(peerOpen && client?.connected);
    },
    close() {
      try {
        client?.publish(`${base}/h`, JSON.stringify({ type: "bye" }), { qos: 0 });
        client?.end(true);
      } catch {}
      client = null;
      peerOpen = false;
    },
  };

  return createHostRoom({ code, name, channel, onState, onLobby, onError });
}

/** 队友：连到同一房间码，等房主回状态 */
export function createDuoGuest({ code, name, onState, onLobby, onError }) {
  const roomCode = String(code || "").trim().toUpperCase();
  const base = `mj/v1/${roomCode}`;
  let client = null;
  let gotHost = false;

  const channel = {
    onMessage: null,
    onPeerJoin: null,
    onPeerLeave: null,
    async start() {
      client = await connectBroker({
        role: "guest",
        subTopic: `${base}/h`,
        willTopic: `${base}/g`,
      });
      client.on("message", (_topic, payload) => {
        let msg;
        try {
          msg = JSON.parse(payload.toString());
        } catch {
          return;
        }
        if (msg.type === "bye") {
          channel.onPeerLeave?.();
          return;
        }
        gotHost = true;
        channel.onMessage?.(msg);
      });

      const hello = () => channel.send({ type: "hello", name });
      hello();
      await new Promise((resolve, reject) => {
        const started = Date.now();
        const timer = setInterval(() => {
          if (gotHost) {
            clearInterval(timer);
            resolve();
            return;
          }
          if (Date.now() - started > 12000) {
            clearInterval(timer);
            reject(new Error("没找到这个房间：请确认房间码，并让房主停在等待室"));
            return;
          }
          hello();
        }, 1200);
      });
    },
    send(msg) {
      if (client?.connected) client.publish(`${base}/g`, JSON.stringify(msg), { qos: 0 });
    },
    isOpen() {
      return Boolean(client?.connected);
    },
    close() {
      try {
        client?.publish(`${base}/g`, JSON.stringify({ type: "bye" }), { qos: 0 });
        client?.end(true);
      } catch {}
      client = null;
    },
  };

  return createGuestRoom({ name, channel, onState, onLobby, onError });
}
