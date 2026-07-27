# 生产运行说明

## 运行结构

- 小程序通过 HTTPS 域名访问 Node 服务。
- Nginx 只开放 `80` 和 `443`，将请求转发到服务器本机 `127.0.0.1:5177`。
- Docker 容器使用宿主机 `/opt/lottery-tool/data` 保存运行数据。
- `scripts/backup-data.sh` 每次备份都会生成独立 SHA256 校验文件。

## MySQL 数据库

生产 Compose 会启动私有 MySQL 8.4 服务，数据库不映射宿主机端口。首次启用 `DATABASE_URL` 时，应用将当前 `data/db.json` 导入 MySQL 的活动、奖品、参与者、中奖记录、会员、会话、订阅、订单和优惠券数据表；JSON 文件继续保留为迁移前数据副本。

MySQL 凭据只保存在服务器 `/opt/lottery-tool/.env`，其中包括：

```dotenv
MYSQL_DATABASE=lottery_tool
MYSQL_USER=lottery_app
MYSQL_PASSWORD=设置随机高强度密码
MYSQL_ROOT_PASSWORD=设置独立随机高强度密码
HIDE_SAMPLE_DATA=true
```

启用 `HIDE_SAMPLE_DATA=true` 后，交接包附带的样例活动不会出现在公开小程序页面，后台仍可查询并按运营决定处理。

## 微信小程序入口

公开入口页只展示服务器实时活动数据；真正的创建、参与、打卡和开奖操作在微信小程序内完成。配置微信平台生成的正式小程序入口链接：

```dotenv
MINIPROGRAM_LAUNCH_URL=https://填写微信小程序正式入口链接
```

配置完成后，`/mini` 会显示真实入口链接；未配置时不会呈现可误触的伪操作按钮。

## 微信订阅消息

在微信公众平台分别选用活动开奖、开奖结果和红包到账模板后，将模板 ID 同时配置到小程序和服务器。服务器端 `.env` 需要包含：

```dotenv
WECHAT_APP_SECRET=填写微信小程序 AppSecret
WECHAT_DRAW_TEMPLATE_ID=填写开奖结果通知模板ID
WECHAT_DRAW_TEMPLATE_DATA={"thing10":{"value":"{{activityTitle}}"},"thing2":{"value":"{{prizeName}}"},"thing4":{"value":"{{result}}"},"time7":{"value":"{{drawAt}}"},"thing1":{"value":"请进入小程序查看详情"}}
WECHAT_DRAW_REMINDER_TEMPLATE_ID=填写活动开奖通知模板ID
WECHAT_DRAW_REMINDER_TEMPLATE_DATA={"thing1":{"value":"{{activityTitle}}"},"time6":{"value":"{{drawAt}}"},"thing5":{"value":"{{reminderText}}"}}
WECHAT_CASH_TEMPLATE_ID=填写红包到账通知模板ID
WECHAT_CASH_TEMPLATE_DATA={"date1":{"value":"{{cashReceivedAt}}"},"thing4":{"value":"{{cashDescription}}"},"amount5":{"value":"{{cashAmount}}"}}
WECHAT_COMMENT_TEMPLATE_ID=填写留言回复通知模板ID
WECHAT_COMMENT_TEMPLATE_DATA={"thing1":{"value":"{{commenterName}}"},"thing2":{"value":"{{commentAt}}"},"thing3":{"value":"{{commentContent}}"},"thing4":{"value":"请进入小程序查看并回复"}}
WECHAT_NOTIFY_PAGE=pages/records/records
WECHAT_MINIPROGRAM_STATE=formal
ADMIN_SESSION_LIFETIME_MS=28800000
LOGIN_RATE_LIMIT_WINDOW_MS=600000
LOGIN_RATE_LIMIT_MAX=20
ACTIVITY_ACTION_RATE_LIMIT_WINDOW_MS=60000
ACTIVITY_ACTION_RATE_LIMIT_MAX=90
NOTIFICATION_MAX_ATTEMPTS=5
NOTIFICATION_RETRY_DELAYS_MS=60000,300000,1800000,7200000
DRAW_REMINDER_LEAD_MS=1800000
```

模板数据字段名应以微信公众平台选定模板展示的字段为准。可用变量包括 `{{activityTitle}}`、`{{prizeName}}`、`{{drawAt}}`、`{{result}}`、`{{reminderText}}`、`{{cashReceivedAt}}`、`{{cashDescription}}` 和 `{{cashAmount}}`。每个业务通知必须使用其对应模板，不做跨模板回退。

用户在活动详情点击“开奖提醒”并接受微信授权后，服务端保存该次授权，并在开奖前 `DRAW_REMINDER_LEAD_MS` 时间窗内发送提醒。参与活动后用户可选择开启开奖结果通知；红包活动中奖用户可授权并收到红包到账通知。失败记录写入 `notificationLogs` 并按配置进行有限次数重试。

## 抽奖免费发布

所有抽奖类型和高级功能均免费开放。服务器 `/opt/lottery-tool/.env` 保持：

```dotenv
ADVANCED_FEATURE_PRICE_CENTS=0
```

小程序发布页面不显示价格，不创建支付订单，也不调用 `wx.requestPayment`。服务端活动创建接口不以订单状态作为发布条件；订单模块保留给商城等独立业务使用。

## 自动开奖

- 按时间开奖：后台每 30 秒检查一次到期开奖时间的活动并执行开奖。
- 按人数开奖：达到创建人设置的目标人数时执行开奖。
- 即抽即中：用户参与后立即按剩余奖品执行一次开奖。
- 后台手动开奖仍保留，用于运营人员补开奖和分批开奖。

## 微信群参与校验

普通微信群限制使用微信群场景加密数据完成：小程序调用 `wx.getGroupEnterInfo`，服务端通过一次性 `wx.login` code 获取对应会话密钥，解密群标识并签发 15 分钟有效的群证明。活动创建时绑定群标识，参与时重新校验，原始群标识不返回小程序端。

企业微信客户群接入需要在企业微信管理后台创建自建应用并授予客户群相关权限，再将 CorpID、应用凭据和可选企业清单配置到运营后台。

## 真实参与条件

活动的区域、问卷、审核和助力条件均由服务端执行：

- 指定区域：创建活动时选择中心位置和允许半径；用户参与时由微信位置接口返回当前位置，服务端计算实际距离。
- 填写问卷：必答项由服务端校验，答案随审核申请或参与记录保存，可在后台参与名单查看。
- 先审核再参与：申请进入待审核名单，只有后台点击“通过”后才写入抽奖参与者表。
- 好友助力：分享链接携带参与者编号，同一微信用户在同一活动中只能助力一次，不能给自己助力。

小程序使用位置能力前，需要在微信公众平台的隐私保护指引中声明位置用途，并确认 `getLocation`、`chooseLocation` 接口审核状态正常。

## 公众号粉丝校验

公众号和小程序必须绑定到同一个微信开放平台账号，以便通过 UnionID 匹配同一微信用户。服务器 `.env` 配置：

```dotenv
OFFICIAL_ACCOUNT_APPID=公众号AppID
OFFICIAL_ACCOUNT_APP_SECRET=公众号AppSecret
OFFICIAL_ACCOUNT_TOKEN=消息回调校验Token
OFFICIAL_ACCOUNT_NAME=公众号显示名称
OFFICIAL_ACCOUNT_USERNAME=公众号原始ID
```

在公众号后台将消息服务器地址设置为：

```text
https://业务域名/api/wechat/official-account/callback
```

Token 必须与服务器 `OFFICIAL_ACCOUNT_TOKEN` 完全一致，消息模式使用明文模式。用户关注或取消关注后，微信事件会更新服务器记录；参与活动时，服务端同时校验公众号关注状态、公众号 AppID 和当前小程序用户 UnionID。环境变量不完整时，小程序禁止开启该条件。

如需让不同抽奖发起人从小程序内点击“添加新授权”并授权各自公众号，必须在微信开放平台创建、审核并发布公众号第三方平台。服务器配置：

```dotenv
WECHAT_OPEN_COMPONENT_APPID=第三方平台AppID
WECHAT_OPEN_COMPONENT_APP_SECRET=第三方平台AppSecret
WECHAT_OPEN_COMPONENT_TOKEN=第三方平台消息校验Token
WECHAT_OPEN_COMPONENT_AES_KEY=第三方平台43位消息加密密钥
WECHAT_OPEN_PUBLIC_BASE_URL=https://lottery.example.com
WECHAT_OPEN_AUTH_REDIRECT_URL=https://lottery.example.com/api/wechat/open-platform/authorization/callback
```

微信开放平台第三方平台填写：

```text
授权事件接收URL：https://lottery.example.com/api/wechat/open-platform/component/callback
消息与事件接收URL：https://lottery.example.com/api/wechat/open-platform/message/$APPID$
授权回调域名：lottery.example.com
```

消息校验 Token 和 EncodingAESKey 必须与服务器环境变量一致。小程序后台还需把 `lottery.example.com` 配置为业务域名，供授权页面在 `web-view` 中打开。收到 `component_verify_ticket` 后，服务端会生成预授权码、完成授权码交换，并按当前小程序用户保存公众号授权关系。

## 企业微信联系人校验

在企业微信管理后台创建具有客户联系权限的自建应用，服务器 `.env` 配置：

```dotenv
WECOM_CORP_ID=企业ID
WECOM_CONTACT_SECRET=客户联系Secret
WECOM_NAME=企业显示名称
```

配置完成后进入运营后台“微信能力”，点击“同步联系人”。服务器会同步外部联系人 UnionID、客户群及群成员清单：

- “加企业微信后参与”按外部联系人 UnionID 校验。
- “仅群成员可参与”选择企业微信客户群时，按所选客户群的成员 UnionID 校验。

联系人或客户群成员有变化时需再次同步，可配合定时任务定期调用后台同步接口。

## Linux 自动备份

部署目录更新后，在服务器执行：

```bash
cd /opt/lottery-tool
sudo chmod 755 scripts/backup-data.sh deploy/install-linux-backup.sh
sudo ./deploy/install-linux-backup.sh
systemctl list-timers lottery-tool-backup.timer
```

备份默认保存到 `/opt/lottery-tool/backups`，保留 30 天。MySQL 运行时备份文件为 `.sql`，JSON 本地模式备份文件为 `.json`。恢复前先停止抽奖工具容器，校验对应 SHA256 文件，再导入已校验的备份并重新启动服务。

## 域名接入

将业务域名解析到服务器公网 IP 后，根据 `deploy/nginx-lottery-tool.conf.template` 生成独立 Nginx 站点配置。证书签发完成后，依次验证：

```text
https://业务域名/api/health
https://业务域名/mini
https://业务域名/admin
```

最后将该 HTTPS 域名写入 `miniprogram/utils/request.js` 的 `PROD_BASE_URL`，并在微信公众平台配置为 request、uploadFile、downloadFile 合法域名。
