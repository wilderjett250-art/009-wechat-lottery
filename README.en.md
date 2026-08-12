# 009 WeChat Campaign Platform

> A configurable platform for campaign rules, eligibility, draws, redemption, and operations review.

## Problem

Campaign rules, winners, redemption codes, and operations review are scattered, making changes expensive.

## Demo

~~~mermaid
flowchart LR
 A[Campaign config] --> B[Web / Mini Program]
 B --> C[Eligibility]
 C --> D[Draw and notification]
 D --> E[Redemption and records]
~~~

Operations configuration and user participation share one rules, draw, and record pipeline.

## Highlights

- Scheduled, threshold-based, instant, and manual draw modes.
- Eligibility rules for region, questionnaires, review, and assistance.
- Operations console, comment review, partner applications, and result queries.
- Docker/Node.js local deployment with API tests.

## Tech

`Node.js · Express · WeChat Mini Program · MySQL/SQLite · Docker`

## Reproduce from ZIP

1. Extract the ZIP and prepare Node.js, a database, and WeChat sandbox settings.
2. Copy `.env.example` to `.env` and use local test values only.
3. Run `npm install`.
4. Run `npm start` or use `docker-compose.yml`, then verify participation and draw flows with a test campaign.

**Expected result:** After these steps, you should see the project's page, window, device output, or test result.

## Scope and Safety

Use authorized sandbox environments for payment, SMS, WeChat AppID, and databases; never commit real redemption codes.

## Contact

Open to technical exchange.
