/**
 * 自测：国内公共 MQTT 中继 create + join
 * 用法：node scripts/verify-mqtt.mjs
 */
import mqtt from "mqtt";

const URL = process.env.MQTT_URL || "wss://broker-cn.emqx.io:8084/mqtt";
const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
let code = "1";
for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
const base = `mj/v1/${code}`;

function connect(role) {
  return new Promise((resolve, reject) => {
    const c = mqtt.connect(URL, {
      clientId: `mj-test-${role}-${Math.random().toString(36).slice(2, 8)}`,
      connectTimeout: 8000,
      reconnectPeriod: 0,
    });
    const t = setTimeout(() => reject(new Error(role + " timeout")), 9000);
    c.once("connect", () => {
      clearTimeout(t);
      resolve(c);
    });
    c.once("error", (e) => {
      clearTimeout(t);
      reject(e);
    });
  });
}

const host = await connect("host");
await new Promise((res, rej) => host.subscribe(`${base}/g`, (e) => (e ? rej(e) : res())));
console.log("OK host", URL);

const guest = await connect("guest");
const got = new Promise((resolve, reject) => {
  const t = setTimeout(() => reject(new Error("no hello")), 8000);
  host.on("message", (_tp, buf) => {
    const msg = JSON.parse(buf.toString());
    if (msg.type === "hello") {
      clearTimeout(t);
      resolve(msg);
    }
  });
});
await new Promise((res, rej) => guest.subscribe(`${base}/h`, (e) => (e ? rej(e) : res())));
guest.publish(`${base}/g`, JSON.stringify({ type: "hello", name: "测乙" }));
const hello = await got;
console.log("OK join", hello.name, "room", code);
host.end(true);
guest.end(true);
console.log("PASS mqtt create+join");
