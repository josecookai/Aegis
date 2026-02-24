# Agent B 完整实现规格 — Demo + Tavily

> **任务：** Tavily 后端（Magic Link、Plan、API Key）  
> **主文档：** [Agent-Demo-Tavily-Tasks.md](../Agent-Demo-Tavily-Tasks.md)

---

## 1. 实现概览

Demo 使用 **Magic Link** 登录（优先于 OAuth），通过 `email_outbox` 发送登录链接。正式路径使用 `requireAppSession` 中间件，基于 `aegis_app_session` cookie。

---

## 2. 数据库 Schema

### 2.1 app_sessions

```sql
CREATE TABLE app_sessions (
  id TEXT PRIMARY KEY,
  end_user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (end_user_id) REFERENCES end_users(id)
);
```

### 2.2 plans

```sql
CREATE TABLE plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  price_cents INTEGER NOT NULL DEFAULT 0,
  interval TEXT NOT NULL DEFAULT 'month',
  features_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL
);
```

### 2.3 user_plans

```sql
CREATE TABLE user_plans (
  end_user_id TEXT NOT NULL,
  plan_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (end_user_id, plan_id),
  FOREIGN KEY (end_user_id) REFERENCES end_users(id),
  FOREIGN KEY (plan_id) REFERENCES plans(id)
);
```

### 2.4 agents 扩展

- 新增列 `owner_user_id TEXT REFERENCES end_users(id)`

---

## 3. API 规格

### 3.1 Magic Link 登录

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/auth/magic-link/request` | Body: `{ email }`，发送登录链接到 email_outbox |
| GET | `/auth/magic-link/verify?token=xxx` | 验证 token，创建 session，设置 cookie，重定向 |
| POST | `/auth/logout` | 清除 app session cookie |

### 3.2 Session 保护路由

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/app/plans` | 公开，返回计划列表 |
| GET | `/api/app/me` | 需 session，返回当前用户 + plan |
| POST | `/api/app/agents` | 需 session，创建 Agent，返回 api_key |
| GET | `/api/app/agents` | 需 session，列出当前用户的 Agent |
| DELETE | `/api/app/agents/:id` | 需 session，删除 owned Agent |
| POST | `/api/app/payment-methods` | 需 session，添加 Stripe 卡 |
| GET | `/api/app/payment-methods` | 需 session，列出支付方式 |
| DELETE | `/api/app/payment-methods/:id` | 需 session，删除支付方式 |
| POST | `/api/app/payment-methods/:id/default` | 需 session，设默认 |

### 3.3 配置

- `APP_SESSION_COOKIE_NAME`：默认 `aegis_app_session`
- `APP_SESSION_TTL_MINUTES`：默认 10080（7 天）

---

## 4. 向后兼容

- `requireValidUser` 保留，用于仍支持 `user_id` 的旧端点（如 approval 的 action_id+user_id 分支）
- `/api/dev/*` 不变，继续使用 `user_id` 参数
- 新增 `/api/app/*` 正式路径使用 `requireAppSession`

---

## 5. 测试

- `tests/app.test.ts`：Magic link 流程、`/api/app/plans`、`/api/app/agents` CRUD
- `POST /_test/app-session`：测试专用，创建 app session（仅 NODE_ENV=test）

---

## 6. B1-B14 任务状态

| ID | Task | 状态 |
|----|------|------|
| B1 | Magic Link 登录 | ✅ |
| B2 | Session 管理 | ✅ |
| B3 | 用户表 | ✅ |
| B4 | requireAppSession | ✅ |
| B5-B6 | 支付方式正式路径 | ✅ |
| B7-B9 | plans + user_plans | ✅ |
| B10-B12 | agents.owner_user_id + CRUD | ✅ |
| B13-B14 | 测试 + 覆盖率 | ✅ |
