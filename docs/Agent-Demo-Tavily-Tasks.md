# Demo Stage + Tavily 式流程 — 3 Agent 分工与指令

> 将 Demo Stage Checklist 与 Tavily 式自助流程合并为统一任务文档，拆给 3 个 Agent 并行执行。每个 Agent 的 Checklist 包含功能验收、测试与覆盖率验证。

**状态：** 待执行（2026-02-23）

---

## 1. 总览

### 1.1. 目标

| 类别 | 目标 |
|------|------|
| **Demo Stage** | 完成 [Aegis-Implementation-Todos.md §7](../Aegis-Implementation-Todos.md) 的 D1～D3 验收：OpenClaw 学会 Skill、用户添加卡、支付 Cursor 扣款 |
| **Tavily 式流程** | OAuth 登录、支付方式正式路径、Plan、API Key 自助生成、Dashboard（Phase T1～T5） |
| **测试与覆盖率** | 每个 Agent 负责的模块需有对应测试，并运行 `npm run test -- --coverage` 验证 |

### 1.2. 合并任务表

| 阶段 | 任务 ID | 说明 | 负责 Agent |
|------|---------|------|------------|
| **Demo** | G1-1～G1-5 | 部署状态确认（Railway/Vercel 已部署，更新文档） | A |
| **Demo** | D1-1～D1-3 | OpenClaw REST 验收（按 REST API 文档执行） | A |
| **Demo** | D2-1～D2-5 | 网页添加卡验收 | C |
| **Demo** | D3-1～D3-4 | 支付流程验收 | C |
| **Tavily** | T1-1～T1-3 | OAuth（Google/GitHub）、Session | B |
| **Tavily** | T2-1～T2-3 | 支付方式正式路径（非 dev） | B |
| **Tavily** | T3-1～T3-3 | Plan 表与选择 | B |
| **Tavily** | T4-1～T4-3 | API Key 自助生成 | B |
| **Tavily** | T5-1～T5-3 | Dashboard UI、支付方式管理 | C |
| **测试** | — | E2E 脚本、单元/集成测试、覆盖率 ≥ 70% | A/B/C |

---

## 2. Agent A 指令模板

**复制以下整段，粘贴给 Agent A：**

```
你负责 Aegis 项目的 **Agent A：部署 + Demo 验收**。

## 任务目标
1. 确认 G1 部署状态（Railway/Vercel 已部署），更新文档
2. 执行 D1 OpenClaw REST 验收（按 REST API 文档）
3. 编写/更新 `scripts/e2e-demo-verify.sh`，可一键跑 Demo 流程

## 必读文档
- [Aegis-Implementation-Todos.md](../Aegis-Implementation-Todos.md) — §6 OpenClaw 测试、§7 Demo Stage Checklist
- [E2E-Verification-Checklist.md](E2E-Verification-Checklist.md) — 验收清单
- [DEPLOYMENT.md](DEPLOYMENT.md) — 部署说明

## Todo List（按顺序执行）

| ID | Task | 状态 |
|----|------|------|
| A1 | G1-1：确认 Aegis 后端已部署到公网（Vercel/Railway），记录 BASE_URL | ⬜ |
| A2 | G1-2：确认 BASE_URL、STRIPE_SECRET_KEY 等环境变量已配置 | ⬜ |
| A3 | G1-3～G1-4：确认 MCP HTTP Server 已部署，AEGIS_API_URL 指向后端 | ⬜ |
| A4 | G1-5：验证 OpenClaw 可访问（curl 或配置后能列出 tools） | ⬜ |
| A5 | D1-1：OpenClaw 可发现 Aegis 工具（aegis_request_payment、aegis_get_payment_status 等） | ⬜ |
| A6 | D1-2：OpenClaw 能正确调用 aegis_request_payment 并传入 amount、recipient、description | ⬜ |
| A7 | D1-3：OpenClaw 能轮询 aegis_get_payment_status，识别 succeeded、denied、expired | ⬜ |
| A8 | 编写/更新 `scripts/e2e-demo-verify.sh`，覆盖 G1 + D1 验收项，可一键执行 | ⬜ |
| A9 | 运行 `npm run test -- --coverage`，确认无回归 | ⬜ |

## Checklist（完成一项勾选一项）

### 功能验收
- [ ] G1-1～G1-5 部署状态确认完成
- [ ] D1-1～D1-3 OpenClaw REST 验收通过
- [ ] `scripts/e2e-demo-verify.sh` 可一键跑 Demo 流程

### 测试
- [ ] E2E 脚本执行通过（本地或公网）
- [ ] `npm run test` 全部通过

### 覆盖率
- [ ] `npm run test -- --coverage` 通过，无回归

## 产出
1. 更新 DEPLOYMENT.md 或相关文档，记录部署 URL、环境变量
2. 更新/新建 `scripts/e2e-demo-verify.sh`
3. 在 E2E-Verification-Checklist.md 中勾选 D1 项
```

---

## 3. Agent B 指令模板

**复制以下整段，粘贴给 Agent B：**

```
你负责 Aegis 项目的 **Agent B：Tavily 后端（OAuth、Plan、API Key）**。

## 任务目标
实现 Tavily 式自助流程的后端：OAuth 登录、支付方式正式路径、Plan 表、API Key 自助生成。

## 必读文档
- [Aegis-Implementation-Todos.md](../Aegis-Implementation-Todos.md) — 功能与 Phase
- [Aegis-API-Spec.md](../Aegis-API-Spec.md) — API 规格
- [.cursor/plans/api_key_与用户身份模型](.cursor/plans/) — Tavily 式流程计划（如有）

## Todo List（按顺序执行）

| ID | Task | 状态 |
|----|------|------|
| B1 | T1-1：集成 OAuth（Google 或 GitHub），实现 `/auth/google`、`/auth/callback` | ⬜ |
| B2 | T1-2：Session 管理（登录态、cookie/session 存储） | ⬜ |
| B3 | T1-3：用户表 `end_users` 扩展（oauth_provider、oauth_id、email） | ⬜ |
| B4 | T2-1：新增 `POST /api/app/payment-methods` 正式路径（需登录） | ⬜ |
| B5 | T2-2：`GET /api/app/payment-methods` 正式路径，返回当前用户支付方式 | ⬜ |
| B6 | T2-3：支付方式与 end_user 关联，支持 Stripe Customer 绑定 | ⬜ |
| B7 | T3-1：新增 `plans` 表（id、name、price、interval、features） | ⬜ |
| B8 | T3-2：`GET /api/app/plans` 返回可选计划列表 | ⬜ |
| B9 | T3-3：`subscriptions` 表或 agent 表扩展，关联 plan | ⬜ |
| B10 | T4-1：`POST /api/app/agents` 创建 Agent，返回 api_key | ⬜ |
| B11 | T4-2：`GET /api/app/agents` 列出当前用户的 Agent | ⬜ |
| B12 | T4-3：API Key 生成、存储、与 agent 关联 | ⬜ |
| B13 | 为 OAuth 回调、`POST /api/app/agents`、plans/subscriptions 写单元或集成测试 | ⬜ |
| B14 | 运行 `npm run test -- --coverage`，新增代码有测试覆盖 | ⬜ |

## Checklist（完成一项勾选一项）

### 功能验收
- [ ] T1-1～T1-3 OAuth + Session 完成
- [ ] T2-1～T2-3 支付方式正式路径完成
- [ ] T3-1～T3-3 Plan 表与选择完成
- [ ] T4-1～T4-3 API Key 自助生成完成

### 测试
- [ ] OAuth 回调有测试
- [ ] `POST /api/app/agents` 有集成测试
- [ ] plans/subscriptions 有单元或集成测试
- [ ] `npm run test` 全部通过

### 覆盖率
- [ ] `npm run test -- --coverage` 通过，新增模块有测试

## 产出
1. 新增 OAuth 路由、Session 中间件
2. 新增 `POST/GET /api/app/payment-methods`、`/api/app/plans`、`/api/app/agents`
3. 数据库迁移（plans、subscriptions、end_users 扩展）
4. 新增测试文件
```

---

## 4. Agent C 指令模板

**复制以下整段，粘贴给 Agent C：**

```
你负责 Aegis 项目的 **Agent C：Tavily 前端 + Demo 验收**。

## 任务目标
1. 完成 D2/D3 Demo 验收（添加卡页、支付流程）
2. 实现 T5 Dashboard UI、支付方式管理
3. 补充集成测试，覆盖率目标 ≥ 60%

## 必读文档
- [Aegis-Implementation-Todos.md](../Aegis-Implementation-Todos.md) — §7 Demo Stage、§6 网页添加卡
- [Aegis-Mobile-UX-Spec.md](../Aegis-Mobile-UX-Spec.md) — UX 规格

## Todo List（按顺序执行）

| ID | Task | 状态 |
|----|------|------|
| C1 | D2-1：用户可访问添加卡页面（`/dev/add-card` 或 `/settings/payment-methods`） | ⬜ |
| C2 | D2-2～D2-4：Stripe Elements 表单、提交保存、卡信息不落库 | ⬜ |
| C3 | D2-5：登录/身份（单用户 demo 可用 usr_demo） | ⬜ |
| C4 | D3-1～D3-4：OpenClaw 发起支付、用户审批、扣款成功、使用用户已添加的卡 | ⬜ |
| C5 | T5-1：Dashboard 首页（`/dashboard` 或 `/`），展示当前用户、计划、Agent 列表 | ⬜ |
| C6 | T5-2：支付方式管理页（`/settings/payment-methods`），正式路径 UI | ⬜ |
| C7 | T5-3：API Key 管理页（生成、复制、删除） | ⬜ |
| C8 | 补充 `/settings/payment-methods`、Dashboard 的集成测试 | ⬜ |
| C9 | 检查 `api.ts`、`web.ts` 覆盖率，目标 ≥ 60% | ⬜ |
| C10 | 运行 `npm run test -- --coverage`，确认通过 | ⬜ |

## Checklist（完成一项勾选一项）

### 功能验收
- [ ] D2-1～D2-5 网页添加卡验收通过
- [ ] D3-1～D3-4 支付流程验收通过
- [ ] T5-1～T5-3 Dashboard UI 完成

### 测试
- [ ] `/settings/payment-methods` 有集成测试
- [ ] Dashboard 相关路由有集成测试
- [ ] `npm run test` 全部通过

### 覆盖率
- [ ] `api.ts`、`web.ts` 行覆盖率 ≥ 60%（或维持现有）
- [ ] `npm run test -- --coverage` 通过

## 产出
1. 更新/新增添加卡页、Dashboard、API Key 管理页
2. 补充 `tests/app.test.ts` 或新建集成测试
3. 在 E2E-Verification-Checklist.md 中勾选 D2、D3 项
```

---

## 5. 执行顺序与 Peer Review

| 顺序 | Agent | 依赖 | Peer Review |
|------|-------|------|-------------|
| 1 | Agent A | 无 | C 审 A 的 E2E 验收脚本 |
| 2 | Agent B | 无（可与 A 并行） | A 审 B 的部署相关配置 |
| 3 | Agent C | B 的 API 就绪后 | B 审 C 的后端 API 调用 |

### 5.1. 验收依赖

```
Agent A (G1 + D1) ──┬──> Demo 部署就绪
                    │
Agent B (T1～T4) ───┼──> Tavily 后端就绪 ──> Agent C 依赖
                    │
Agent C (D2/D3 + T5) ─> 依赖 B 的 /api/app/* 端点
```

### 5.2. 建议执行顺序

1. **先 A**：确认部署，跑通 D1，产出 E2E 脚本
2. **并行 B**：实现 Tavily 后端
3. **后 C**：在 B 的 API 就绪后，实现前端 + 验收 D2/D3

---

## 6. Agent B B1-B14 详细任务分解

> Demo 使用 Magic Link 登录（优先）；正式路径使用 session cookie。

| ID | Task | 说明 |
|----|------|------|
| B1 | T1-1：Magic Link 登录 | `POST /auth/magic-link/request`、`GET /auth/magic-link/verify?token=xxx` |
| B2 | T1-2：Session 管理 | `app_session` 表、`aegis_app_session` cookie、`requireAppSession` 中间件 |
| B3 | T1-3：用户表 | `end_users` 已有 email，magic link 可查找/创建用户 |
| B4 | T2-1：`requireAppSession` | `/api/app/*` 使用 session cookie 替代 `user_id` 参数 |
| B5 | T2-2：`POST /api/app/payment-methods` | 需 session 登录，关联当前用户 |
| B6 | T2-3：`GET /api/app/payment-methods` | 返回当前 session 用户的支付方式 |
| B7 | T3-1：`plans` 表 | id、name、price_cents、interval、features_json |
| B8 | T3-2：`user_plans` 表 | 关联 end_user 与 plan |
| B9 | T3-3：`GET /api/app/plans` | 返回可选计划列表，seed free/pro |
| B10 | T4-1：`agents.owner_user_id` | 扩展 agents 表，关联 owner |
| B11 | T4-2：`POST /api/app/agents` | 创建 Agent，返回 api_key |
| B12 | T4-3：`GET /api/app/agents`、`DELETE /api/app/agents/:id` | 列出/删除当前用户的 Agent |
| B13 | 单元/集成测试 | Magic link 流程、`/api/app/agents`、plans |
| B14 | 覆盖率 | `npm run test -- --coverage` 通过 |

---

## 7. 相关文档

- [Aegis-Implementation-Todos.md](../Aegis-Implementation-Todos.md) — 主进度文档
- [Agent-B-Demo-Tavily.md](agents/Agent-B-Demo-Tavily.md) — Agent B 完整实现规格
- [Agent-Test-Tasks.md](Agent-Test-Tasks.md) — 测试覆盖率任务（已完成）
- [E2E-Verification-Checklist.md](E2E-Verification-Checklist.md) — Demo 验收清单
