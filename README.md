# 大众麻将

浏览器可玩的大众麻将：拟真牌面、四向牌桌、建议出牌。

牌面素材：[lietxia/mahjong_graphic](https://github.com/lietxia/mahjong_graphic)

## 在线游玩

打开 https://dazhong-mahjong.vercel.app 即可：

- **单人**：浏览器本地对战 AI
- **双人**：创建/加入房间；默认点对点（PeerJS）。国内延迟高时请用「加速节点」

后台：https://dazhong-mahjong.vercel.app/admin （默认密码 `8888`）

## 国内延迟（没有 VPS）

不用买服务器。用 **Render 免费档 · 新加坡** 即可：

1. 打开一键部署（用 GitHub 登录）：  
   https://render.com/deploy?repo=https://github.com/134689lixincheng/dazhong-mahjong
2. 等部署完成，复制网站地址，把 `https://` 改成 `wss://`  
   例如：`wss://dazhong-mahjong-xxxx.onrender.com`
3. 在游戏大厅「加速节点」里填入并保存（双方填同一个）  
   或把地址发给我，我可以写成网站默认节点

说明：Render 免费实例会休眠，久不用首次连接可能要等几十秒唤醒。

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
