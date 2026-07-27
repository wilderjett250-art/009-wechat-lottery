# 抽奖工具服务器配置

## 1. 服务器准备

推荐配置：

- 系统：Ubuntu 22.04 LTS
- CPU/内存：2 核 4G 起步，正式运营建议 4 核 8G
- 磁盘：40G 起步
- 域名：`lottery.example.com`
- 安全组：开放 `80`、`443`，管理端口只允许你的办公 IP

安装基础组件：

```bash
apt update
apt install -y git curl nginx
curl -fsSL https://get.docker.com | bash
systemctl enable --now docker
```

## 2. 上传并启动服务

把项目目录上传到服务器：

```bash
mkdir -p /opt/lottery-tool
cd /opt/lottery-tool
```

复制本项目文件到 `/opt/lottery-tool` 后执行：

```bash
docker compose up -d --build
docker compose ps
curl http://127.0.0.1:5177/api/health
```

健康检查返回 `status: up` 后，说明后端和页面已经启动。

生产环境建议配置后台访问密钥：

```bash
read -rsp 'Admin token: ' ADMIN_TOKEN
export ADMIN_TOKEN
export WECHAT_APPID=wxexampleappid0001
read -rsp 'WeChat AppSecret: ' WECHAT_APP_SECRET
export WECHAT_APP_SECRET
docker compose up -d --build
```

正式运行使用 `.env` 文件保存配置：

```bash
cp .env.example .env
chmod 600 .env
mkdir -p secrets
```

填写 `.env` 后即可启动。当前所有抽奖均免费发布，不需要准备微信支付商户私钥或平台公钥；`secrets/` 目录仅为后续独立订单业务预留。

访问后台时使用：

```text
https://lottery.example.com/admin
```

页面会先验证后台访问密钥并建立 HttpOnly 会话 Cookie。脚本调用可继续使用 `Authorization: Bearer`，不要把访问密钥拼入 URL。

## 3. Nginx 反向代理

创建 `/etc/nginx/conf.d/lottery-tool.conf`：

```nginx
server {
    listen 80;
    server_name lottery.example.com;

    location / {
        proxy_pass http://127.0.0.1:5177;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

检查并重载：

```bash
nginx -t
systemctl reload nginx
```

## 4. HTTPS 证书

使用 Certbot：

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d lottery.example.com
```

证书签发完成后访问：

- 小程序入口页：`https://lottery.example.com/mini`
- 网页后台：`https://lottery.example.com/admin`
- 健康检查：`https://lottery.example.com/api/health`

## 5. 微信小程序后台配置

在微信公众平台小程序后台配置：

- 开发管理 -> 开发设置 -> 服务器域名
- request 合法域名：`https://lottery.example.com`
- uploadFile 合法域名：`https://lottery.example.com`
- downloadFile 合法域名：`https://lottery.example.com`
- 开发管理 -> 开发设置 -> AppSecret：用于服务端 `code2session`
- 订阅消息：配置开奖提醒和现金红包提醒模板

然后修改小程序生产接口地址：

```js
// miniprogram/utils/request.js
const PROD_BASE_URL = 'https://lottery.example.com';
```

订阅模板配置位置：

```js
// miniprogram/config/subscribe.js
module.exports = {
  drawReminderTemplateId: '开奖提醒模板 ID',
  drawResultTemplateId: '开奖结果通知模板 ID',
  cashReminderTemplateId: '现金红包到账通知模板 ID',
  commentReplyTemplateId: '留言回复模板 ID'
};
```

小程序端点击预约/提醒时会调用 `wx.requestSubscribeMessage`；模板 ID 配置完成后，真机会弹出微信订阅授权。开奖前提醒、开奖结果和红包到账分别使用独立模板，通知发送失败时会按 `.env` 中的重试间隔再次发送。开奖前提醒的发送时间由 `DRAW_REMINDER_LEAD_MS` 控制，默认提前 30 分钟。

## 6. 抽奖免费发布配置

生产环境保持以下配置：

```dotenv
ADVANCED_FEATURE_PRICE_CENTS=0
```

奖品、优惠券、红包、商城奖品及高级功能活动均直接创建，不拉起微信支付，也不依赖商户号、商户证书或支付回调。后台订单模块用于其他独立业务，不作为抽奖发布条件。

## 7. MySQL 数据存储与备份

正式环境已经使用 MySQL 8.4。服务首次启动时会自动创建活动、奖品、参与者、中奖、订单、优惠券、钱包、订阅和通知日志等业务表，并从已有数据文件完成一次性迁移。

数据库只通过 Docker 内部网络提供给后端，不对公网开放端口。备份使用：

```bash
cd /opt/lottery-tool
bash scripts/backup-data.sh
```

服务器已配置每日 `03:20` 自动备份。上线后应定期抽查 SQL 备份文件及其 SHA256 校验文件，并执行恢复演练。
