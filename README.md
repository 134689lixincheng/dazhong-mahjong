# 大众麻将

浏览器可玩的大众麻将：拟真牌面、四向牌桌、建议出牌。

牌面素材：[lietxia/mahjong_graphic](https://github.com/lietxia/mahjong_graphic)

## 在线游玩

打开 https://dazhong-mahjong.vercel.app 即可：

- **单人**：浏览器本地对战 AI
- **双人**：创建/加入房间，点对点联机（PeerJS），**无需** `npm start`

后台：https://dazhong-mahjong.vercel.app/admin （默认密码 `8888`）

## 本地运行

直接用静态服务器打开即可，例如：

```bash
npx --yes serve -l 5173 .
```

可选：`npm start` 仍可启动旧版 WebSocket 服（一般已不需要）。

## 部署 Vercel

```bash
npx vercel --prod
```

或连接 GitHub 仓库后在 Vercel 控制台一键部署（Framework Preset: Other，根目录即静态资源）。

## 后台管理

单独打开：http://localhost:5173/admin.html（上线后为 `/admin`）

默认密码 `8888`，用于调整人机昏棋率。与游戏大厅分开访问。
