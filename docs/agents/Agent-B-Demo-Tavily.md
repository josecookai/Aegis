# Agent B 指令 — Tavily 后端

> **任务：** OAuth、Plan、API Key 自助生成  
> **主文档：** [Agent-Demo-Tavily-Tasks.md](../../Agent-Demo-Tavily-Tasks.md)

---

## 职责

你负责 Aegis 项目的 **Agent B：Tavily 后端（OAuth、Plan、API Key）**。

## 任务目标

实现 Tavily 式自助流程的后端：OAuth 登录、支付方式正式路径、Plan 表、API Key 自助生成。

## Todo List（按顺序执行）

| ID | Task | 状态 |
|----|------|------|
| B1 | app_sessions 表 | ✅ |
| B2 | POST /auth/magic-link/request | ✅ |
| B3 | GET /auth/magic-link/verify | ✅ |
| B4 | POST /auth/logout | ✅ |
| B5 | requireAppSession 中间件 | ✅ |
| B6 | /api/app/* 使用 session | ✅ |
| B7 | plans 表 | ✅ |
| B8 | user_plans 表 | ✅ |
| B9 | GET /api/app/plans、/api/app/me | ✅ |
| B10 | agents.owner_user_id | ✅ |
| B11 | POST /api/app/agents | ✅ |
| B12 | GET/DELETE /api/app/agents | ✅ |
| B13 | 集成测试 | ✅ |
| B14 | 覆盖率验证 | ✅ |

## 相关端点

- `POST /auth/magic-link/request` — 请求 magic link（body: email）
- `GET /auth/magic-link/verify?token=xxx` — 验证并登录
- `POST /auth/logout` — 登出
- `GET /api/app/me` — 当前用户信息（含 plan）
- `GET /api/app/plans` — 计划列表
- `POST /api/app/agents` — 创建 Agent
- `GET /api/app/agents` — 列出 Agent
- `DELETE /api/app/agents/:id` — 删除 Agent
