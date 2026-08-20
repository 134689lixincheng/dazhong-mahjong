# 大众麻将

浏览器可玩的大众麻将：拟真牌面、四向牌桌、建议出牌。

牌面素材：[lietxia/mahjong_graphic](https://github.com/lietxia/mahjong_graphic)

## 怎么玩

打开 https://dazhong-mahjong.vercel.app

| 模式 | 操作 |
|------|------|
| 单人 | 点「开桌」 |
| 双人 | 选双人 → **创建房间** → 把房间码发给队友 → **加入** → 双方点「准备」 |
| 后台 | [/admin](https://dazhong-mahjong.vercel.app/admin)（密码 `8888`） |

不用手动 `npm start`。双人会先连云端联机服，失败则自动改用点对点。

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
| 2026-08-21 | 单人 `createLocalSolo` | ✅ PASS | `phase=draw`，手牌 13 |
| 2026-08-21 | `verify-duo.mjs` → `ws://127.0.0.1:5173` | ✅ PASS | create + join seat 2 |
| 2026-08-21 | 浏览器本机：创建房间 | ✅ PASS | 等待室出现房间码 |
| 2026-08-21 | 浏览器房主 + 脚本加入 | ✅ PASS | 双方 `online=true` |
| 2026-08-21 | `https://dazhong-mahjong.onrender.com` | ❌ 超时 | 本机网络 90s 无响应；需在 Render 控制台确认服务为 Live |
| 2026-08-21 | Vercel 站点（本机 curl） | ❌ 超时 | 浏览器侧此前可打开；以 Vercel 控制台为准 |

> 若队友仍进不去：双方强制刷新同一网站；房主先创建并保持等待室；确认 Render 若已部署则处于未休眠状态。本机联机链路已验证正常。

## 结构说明

- `js/localSolo.js`：单人纯前端
- `js/duoWs.js`：双人 WebSocket
- `js/duoP2p.js`：双人 PeerJS 备用
- `js/netConfig.js`：默认节点 / 唤醒
- `local-server.mjs`：联机权威服（Render 或 `npm start`）
- `scripts/verify-duo.mjs`：联机自测
