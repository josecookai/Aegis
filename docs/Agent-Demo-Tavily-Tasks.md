# Agent Demo — Tavily 式任务总览

> **目标：** 实现 Tavily 式自助流程：用户 OAuth 登录 → 选择 Plan → 添加支付方式 → 自助生成 API Key。

---

## 任务分解（B1～B14）

### T1: OAuth + Session（B1～B4）

| ID | Task | 说明 | 状态 |
|----|------|------|------|
| B1 | app_sessions 表 | user_id, token_hash, expires_at | ✅ |
| B2 | POST /auth/magic-link/request | 按 email 发送登录链接到 email_outbox | ✅ |
| B3 | GET /auth/magic-link/verify | 校验 token、创建 session、设置 aegis_app_session cookie | ✅ |
| B4 | POST /auth/logout | 清除 app session cookie | ✅ |

### T2: 支付方式正式路径（B5～B6）

| ID | Task | 说明 | 状态 |
|----|------|------|------|
| B5 | requireAppSession 中间件 | 从 session cookie 解析 user_id | ✅ |
| B6 | /api/app/* 使用 session | payment-methods、me、agents 等改用 requireAppSessionOrUser | ✅ |

### T3: Plan 表（B7～B9）

| ID | Task | 说明 | 状态 |
|----|------|------|------|
| B7 | plans 表 | id, name, slug, price_cents, interval, features_json | ✅ |
| B8 | user_plans 表 | user_id, plan_id, status | ✅ |
| B9 | GET /api/app/plans | 返回计划列表；GET /api/app/me 含当前 plan | ✅ |

### T4: API Key 自助生成（B10～B12）

| ID | Task | 说明 | 状态 |
|----|------|------|------|
| B10 | agents.owner_user_id | 扩展 agents 表 | ✅ |
| B11 | POST /api/app/agents | 创建 Agent，返回 api_key（仅展示一次） | ✅ |
| B12 | GET /api/app/agents、DELETE /api/app/agents/:id | 列出/删除用户 Agent | ✅ |

### 测试与覆盖率（B13～B14）

| ID | Task | 说明 | 状态 |
|----|------|------|------|
| B13 | OAuth、plans、agents 集成测试 | tests/app.test.ts | ✅ |
| B14 | npm run test -- --coverage 通过 | 覆盖率验证 | ✅ |

---

## 验收 Checklist

- [x] T1～T4 功能完成
- [x] OAuth、/api/app/agents、plans 有测试
- [x] npm run test -- --coverage 通过
