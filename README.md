# 大众麻将

浏览器可玩的大众麻将：拟真牌面、四向牌桌、建议出牌。

牌面素材：[lietxia/mahjong_graphic](https://github.com/lietxia/mahjong_graphic)

## 进度快照（2026-08-21）

| 项 | 状态 |
|----|------|
| 线上 | https://dazhong-mahjong.vercel.app |
| 双人 | **默认国内 MQTT 中继**（`broker-cn.emqx.io`），不用 Render、不用唤醒 |
| 房间码 | 以 `1` 开头 = 公共中继；以 `0` 开头 = 点对点 |
| 手牌 / 弃牌 | 自己手牌和自己弃牌放大；对手弃牌小、会换行 |

## 怎么玩

打开 https://dazhong-mahjong.vercel.app

| 模式 | 操作 |
|------|------|
| 单人 | 点「开桌」 |
| 双人 | 选双人 → **创建房间** → 把房间码发给队友 → **加入** → 双方点「准备」 |
| 后台 | [/admin](https://dazhong-mahjong.vercel.app/admin)（密码 `8888`） |

不用手动 `npm start`。双人默认走国内公共中继，创建房间即可，**不用填地址、不用先打开 Render**。

## 本地运行（可选）

```bash
npm install
npm start
```

打开 http://localhost:5173  
本机开服时双人自动走同源 WebSocket（自测通过）。

联机自测脚本：

```bash
node scripts/verify-duo.mjs ws://127.0.0.1:5173
```

## 改进日志

### 2026-08-21（国内联机）

- 默认不再走 Render（国外、会休眠）。双人改用 EMQX 国内 MQTT（`broker-cn.emqx.io`）
- 房间码以 `1` 开头锁定中继通道，避免房主/队友走两条路
- 本机浏览器实测：创建 `1RHXZP`，第二标签加入，双方「在线」

### 2026-08-21（弃牌分区）

- 仅自己打出的牌保持放大；其余三人恢复小尺寸
- 弃牌区按行换行（对手约 6 张/行，自己约 8 张/行）

### 2026-08-21（弃牌放大）

- 打出的牌单独加大（`--tile-discard-w`），中心刚出的牌再略大一截

### 2026-08-21（手牌放大）

- 参考欢乐麻将：自己手牌加大（约 `6.8vw`，末张摸进略分开），底栏通栏排开
- 对手/弃牌保持较小，避免桌面挤满

### 2026-08-21（更新联机节点）

- 默认 WSS 改为 `wss://dazhong-mahjong-dwkm.onrender.com`
- 自测：对该地址 create + join **PASS**

### 2026-08-21（联机进不去 / 自测规范）

- **根因**：默认联机地址与点对点混用，双方可能不在同一通道；且本机也被误指到云端。
- **修复**：本机优先同源 WS；线上先云端再自动回退 PeerJS；加入重试与更清晰报错。
- **约定**：功能改完必须自测，并把结果写进下方「验证记录」；改进同步记入本日志。

### 2026-08-21（体验简化）

- 大厅去掉「加速节点」填写；打开网站即可创建/加入。
- 去掉 Google Fonts / esm.sh；PeerJS 本地 `vendor/`。
- 单人纯前端；双人默认不依赖本机 `npm start`。

## 验证记录

| 日期 | 项目 | 结果 | 备注 |
|------|------|------|------|
| 2026-08-21 | 国内 MQTT 建房+加入（本机双标签） | ✅ | 房间 `1RHXZP`，双方在线 |
| 2026-08-21 | `wss://broker-cn.emqx.io:8084/mqtt` | ✅ | 本机 OPEN |
| 2026-08-21 | Render 默认节点（国内） | ❌ | 休眠/超时；已不再作为默认 |
| 2026-08-21 | 弃牌：仅自己放大 + 换行 | ✅ | 底家 discard 大牌；上/左/右 xs；flex-wrap |
| 2026-08-21 | 弃牌放大 CSS | ✅ | discard ~32–48px 宽，last-discard ×1.35 |
| 2026-08-21 | 手牌放大（1280×720） | ✅ | 手牌约 79–88×110+，底栏通栏无横向滚动条 |
| 2026-08-21 | `verify-duo.mjs` → `wss://dazhong-mahjong-dwkm.onrender.com` | ✅ PASS | create `BXG8T` + join seat 2 |
| 2026-08-21 | 单人 `createLocalSolo` | ✅ PASS | `phase=draw`，手牌 13 |
| 2026-08-21 | `verify-duo.mjs` → `ws://127.0.0.1:5173` | ✅ PASS | create + join seat 2 |
| 2026-08-21 | 浏览器本机：创建房间 | ✅ PASS | 等待室出现房间码 |
| 2026-08-21 | 浏览器房主 + 脚本加入 | ✅ PASS | 双方 `online=true` |
| 2026-08-21 | `https://dazhong-mahjong.onrender.com`（旧） | ❌ 超时 | 已弃用 |
| 2026-08-21 | Vercel 站点（本机 curl） | ❌ 超时 | 浏览器侧可打开；以 Vercel 控制台为准 |

> 双方强制刷新 https://dazhong-mahjong.vercel.app 后再试双人。

## 结构说明

- `js/localSolo.js`：单人纯前端
- `js/duoWs.js`：双人 WebSocket
- `js/duoP2p.js`：双人 PeerJS 备用
- `js/netConfig.js`：默认节点 / 唤醒
- `local-server.mjs`：联机权威服（Render 或 `npm start`）
- `scripts/verify-duo.mjs`：联机自测
