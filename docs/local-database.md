# 本地数据说明

当前服务默认使用项目内的 JSON 本地库：

```text
E:\workproject\lottery-tool-optimized-20260630\data\db.json
```

服务启动后会读取 `data/db.json`。如果文件不存在，会从 `data/seed.json` 初始化。读取数据时会自动补齐运行所需集合，确保本地库包含以下结构：

- `activities`：抽奖活动
- `prizes`：奖项和库存
- `participants`：参与记录
- `winners`：中奖记录
- `shares`：分享记录
- `memberStats`：个人中心统计
- `wallet`：红包余额和流水
- `coupons`：优惠券
- `orders`：订单

当前小程序调用关系：

- 首页、详情页、记录页读取 `/api/activities` 和 `/api/activities/:id`
- 发起抽奖页提交 `/api/activities`，写入 `activities`、`prizes`，同步更新 `memberStats`
- 参与抽奖提交 `/api/activities/:id/join`，写入 `participants`
- 个人中心读取 `/api/me/overview`
- 红包余额读取 `/api/me/wallet`
- 优惠券读取 `/api/me/coupons`
- 订单读取 `/api/me/orders`

本地库写入采用临时文件加原子重命名，避免写入一半时损坏 `db.json`。备份脚本：

```powershell
.\scripts\backup-data.ps1
```

正式部署时可把这层 JSON 存储替换成 MySQL 或 PostgreSQL；接口层已经集中在 `server.js`，小程序端不需要跟着改接口路径。
