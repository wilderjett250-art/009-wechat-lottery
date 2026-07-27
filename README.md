# Project 009 · WeChat Lottery Operations Platform

[中文说明](#中文说明) | [English Guide](#english-guide)

## 中文说明

### 项目概述

这是一个面向微信场景的全栈抽奖与运营平台，包含 Node.js 后端、网页运营后台、公开活动入口页和微信小程序源码。系统支持活动创建、参与条件校验、自动开奖、结果通知、评论审核、合作申请、会员中心、订单与钱包相关接口，并保留企业微信、公众号和开放平台授权接入能力。

### 主要能力

- 多种开奖模式：按时间开奖、按人数开奖、即抽即中、手动补开奖。
- 多种参与条件：区域限制、问卷、审核、好友助力、微信群、企业微信客户群、公众号粉丝等。
- 通知链路：开奖提醒、开奖结果、红包到账、留言回复。
- 运营后台：活动管理、评论审核、合作申请、集成配置、参与记录与中奖结果查询。
- 小程序端：活动浏览、参与、提醒订阅、个人中心、订单、地址、消息和钱包页面。
- 数据存储：本地 JSON 种子数据与 MySQL 生产模式双路线。

### 目录结构

- `server.js`：Node/Express 服务端与 API 聚合入口。
- `public/`：公开入口页与网页运营后台。
- `miniprogram/`：微信小程序完整源码。
- `tests/`：Node 原生测试，覆盖存储层、服务端接口和小程序静态行为。
- `docs/`：部署、生产运维和交付边界说明。
- `data/seed.json`：演示种子数据；运行期数据默认写入 `data/db.json`，该文件不纳入仓库。

### 本地启动

要求：

- Node.js 18 或更高版本
- PowerShell 5.1+ 或兼容终端

安装并启动：

```powershell
.\scripts\install.ps1
.\scripts\start.ps1
```

常用地址：

- `http://127.0.0.1:5177/mini`
- `http://127.0.0.1:5177/admin`
- `http://127.0.0.1:5177/api/health`

快速检查：

```powershell
npm run check
npm test
```

### 微信小程序配置

- `miniprogram/project.config.json` 使用通用占位 AppID `wxexampleappid0001`，导入微信开发者工具后按你的真实小程序 AppID 替换。
- `miniprogram/utils/request.js` 里保留了本地调试地址 `http://127.0.0.1:5177` 与生产地址 `https://lottery.example.com`，正式部署时替换为你的 HTTPS 业务域名。
- 微信登录、订阅消息、公众号粉丝校验、企业微信客户群校验与开放平台授权都通过环境变量启用，不在仓库中保存真实密钥。

### 部署说明

- 开发与单机联调可直接使用本地 JSON 数据模式。
- 生产环境建议使用 Docker Compose + MySQL。
- 后台访问保护、通知模板、公众号回调、开放平台授权与企业微信同步参数见 [docs/production-operations.md](docs/production-operations.md)。
- Nginx、HTTPS 与微信合法域名配置见 [docs/server-setup.md](docs/server-setup.md)。

### 发布边界

本仓库保留完整源码、测试、部署脚本与演示种子数据，不包含以下内容：

- 运行期数据库文件
- `node_modules`、临时发布目录和构建缓存
- 生产密钥、支付证书、服务器 `.env`
- 真实业务域名、真实 AppSecret、真实运营数据

发布边界细节见 [docs/PUBLICATION_SCOPE.md](docs/PUBLICATION_SCOPE.md)。

## English Guide

### Overview

This repository contains a full-stack WeChat lottery operations platform with a Node.js backend, a browser-based admin console, a public campaign entry page, and a complete WeChat Mini Program source tree. It supports campaign publishing, participation-rule enforcement, scheduled and instant draws, result notifications, moderation workflows, creator integrations, and production deployment with MySQL.

### Core Features

- Draw modes: scheduled draw, participant-threshold draw, instant draw, and manual redraw.
- Participation rules: geo fence, questionnaire, approval gate, assist sharing, WeChat group verification, WeCom customer group verification, and official account follower verification.
- Notification workflows: draw reminder, result notification, cash reward notification, and comment reply notification.
- Admin operations: activity management, comment moderation, partnership review, integration settings, participant records, and winner records.
- Mini Program client: activity feed, participation, reminder subscription, profile center, orders, address, messaging, and wallet pages.
- Storage modes: local JSON seed data for development and MySQL for production.

### Repository Layout

- `server.js`: main Node/Express application and API entry.
- `public/`: public landing page and browser admin console.
- `miniprogram/`: full WeChat Mini Program source.
- `tests/`: Node native tests for storage, backend APIs, and Mini Program behavior checks.
- `docs/`: deployment, operations, and publication-boundary notes.
- `data/seed.json`: demo seed data; runtime JSON state is intentionally excluded from version control.

### Local Run

Requirements:

- Node.js 18+
- PowerShell 5.1+ or a compatible terminal

Install and start:

```powershell
.\scripts\install.ps1
.\scripts\start.ps1
```

Useful endpoints:

- `http://127.0.0.1:5177/mini`
- `http://127.0.0.1:5177/admin`
- `http://127.0.0.1:5177/api/health`

Quick validation:

```powershell
npm run check
npm test
```

### Mini Program Configuration

- `miniprogram/project.config.json` uses the generic AppID `wxexampleappid0001`; replace it with your actual AppID in WeChat DevTools.
- `miniprogram/utils/request.js` keeps both the local backend URL and the sample production URL `https://lottery.example.com`. Replace the production URL with your own HTTPS domain before release.
- Login, subscription messages, official account verification, WeCom verification, and open-platform authorization are all environment-driven and do not store live secrets in the repository.

### Deployment

- Local development can run entirely in JSON-file mode.
- Production deployment is designed for Docker Compose plus MySQL.
- Admin access control, notification templates, official-account callbacks, open-platform authorization, and WeCom synchronization are documented in [docs/production-operations.md](docs/production-operations.md).
- Reverse proxy, HTTPS, and WeChat domain setup are documented in [docs/server-setup.md](docs/server-setup.md).

### Publication Boundary

This repository includes full source code, tests, deployment scripts, and demo seed data. It does not include runtime databases, dependency caches, temporary release folders, production secrets, payment certificates, live domains, or business data.

See [docs/PUBLICATION_SCOPE.md](docs/PUBLICATION_SCOPE.md) for the exact publication scope used for this repository.
