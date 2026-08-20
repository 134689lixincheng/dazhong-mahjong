# 大众麻将

浏览器可玩的大众麻将：拟真牌面、四向牌桌、建议出牌。

牌面素材：[lietxia/mahjong_graphic](https://github.com/lietxia/mahjong_graphic)

## 在线游玩

打开 https://dazhong-mahjong.vercel.app 即可：

- **单人**：浏览器本地对战 AI
- **双人**：创建/加入房间；默认点对点（PeerJS）。国内延迟高时请用「加速节点」

后台：https://dazhong-mahjong.vercel.app/admin （默认密码 `8888`）

## 国内延迟 / 反代

Vercel + PeerJS 信令都在国外，大陆访问会慢。可选：

1. **香港/国内 VPS（推荐）**  
   - 服务器上运行 `npm start`  
   - 用 Nginx 反代（见 `deploy/nginx-china.conf`）  
   - 大厅填写加速节点：`wss://你的域名`（双方相同）  
   - 也可：`https://dazhong-mahjong.vercel.app/?ws=wss://你的域名`

2. **Render 新加坡一键部署**  
   - 连接本仓库，使用根目录 `render.yaml`（region: singapore）  
   - 部署后把 `wss://xxx.onrender.com` 填进加速节点

整站都跑在同一台近端机器上延迟最低（不必再用 Vercel）。

## 本地运行

```bash
npm install
npm start
```

打开 http://localhost:5173 （双人自动走本机 WebSocket）

仅静态预览：`npx --yes serve -l 5173 .`（双人需填加速节点或改用 PeerJS）

## 部署 Vercel

```bash
npx vercel --prod
```

或连接 GitHub 后在 Vercel 控制台部署（Framework Preset: Other）。

## 后台管理

单独打开：`/admin`（默认密码 `8888`），调整人机昏棋率。
