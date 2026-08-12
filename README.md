# 009 微信活动运营平台 / WeChat Campaign Platform

> 把活动规则、参与条件、开奖、兑换和运营审核集中到一个可配置的平台。
>
> **English:** A configurable platform for campaign rules, eligibility, draws, redemption, and operations review.

## 解决什么问题 / Problem

活动规则、中奖结果、兑换码和运营审核分散管理，活动调整需要反复改代码。

**English:** Campaign rules, winners, redemption codes, and operations review are scattered, making changes expensive.

## 项目展示 / Demo

~~~mermaid
flowchart LR
 A[活动配置] --> B[网页 / 小程序入口]
 B --> C[参与条件校验]
 C --> D[开奖与通知]
 D --> E[兑换 / 审核 / 记录]
~~~

运营配置和用户参与共享同一条规则、开奖和记录链路。

**English:** Operations configuration and user participation share one rules, draw, and record pipeline.

## 高光亮点 / Highlights

- 定时开奖、人数开奖、即抽即中和手动补开奖。
  **English:** Scheduled, threshold-based, instant, and manual draw modes.
- 区域、问卷、审核、助力等参与条件。
  **English:** Eligibility rules for region, questionnaires, review, and assistance.
- 运营后台、评论审核、合作申请和结果查询。
  **English:** Operations console, comment review, partner applications, and result queries.
- Docker/Node.js 本地部署与 API 测试。
  **English:** Docker/Node.js local deployment with API tests.

## 技术名词 / Tech

`Node.js · Express · WeChat Mini Program · MySQL/SQLite · Docker`

## 从 ZIP 开始复现 / Reproduce from ZIP

1. 解压 ZIP，准备 Node.js、数据库和微信平台测试配置。
2. 复制 `.env.example` 为 `.env`，只填写本地测试值。
3. 执行 `npm install`。
4. 执行 `npm start` 或按 `docker-compose.yml` 启动，再用测试活动验证参与和开奖流程。

**Expected result:** 完成上述步骤后，应能看到项目的页面、窗口、设备输出或测试结果。

**Expected result:** After these steps, you should see the project's page, window, device output, or test result.

## 范围与安全 / Scope and Safety

支付、短信、微信 AppID 和生产数据库必须使用授权的测试环境；不要把真实兑换码提交到仓库。

**English:** Use authorized sandbox environments for payment, SMS, WeChat AppID, and databases; never commit real redemption codes.

## 交流 / Contact

欢迎交流技术。

Open to technical exchange.

[English full version](README.en.md)
