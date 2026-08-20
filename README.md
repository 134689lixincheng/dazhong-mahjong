# 大众麻将

浏览器可玩的大众麻将：拟真牌面、四向牌桌、建议出牌。

牌面素材：[lietxia/mahjong_graphic](https://github.com/lietxia/mahjong_graphic)

## 在线游玩

部署在 Vercel 后，打开站点即可 **单人 vs 电脑**。

> 双人异地组队依赖 WebSocket，需本机或其它 Node 主机运行 `npm start`，Vercel 静态托管不支持。

## 本地运行

```bash
npm install
npm start
```

打开 http://localhost:5173

- 单人：纯前端也可玩（不连服务器）
- 双人：需上述 Node 服务，创建/加入房间

## 部署 Vercel

```bash
npx vercel --prod
```

或连接 GitHub 仓库后在 Vercel 控制台一键部署（Framework Preset: Other，根目录即静态资源）。

## 后台管理

单独打开：http://localhost:5173/admin.html（上线后为 `/admin`）

默认密码 `8888`，用于调整人机昏棋率。与游戏大厅分开访问。
