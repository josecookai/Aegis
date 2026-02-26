# Aegis E2E 验收 Checklist 与结果

> OpenClaw/Manus 接入端到端验收记录。  
> 执行日期：2026-02-23 | 负责人：Agent C

---

## 1. 验收范围

| 阶段 | 说明 | 依赖 |
|------|------|------|
| **G1** | 部署与公网可达 | Agent A |
| **G2** | 网页添加信用卡（Stripe Elements） | Agent B |
| **E2E** | 全流程：MCP 配置 → 添加卡 → 发起支付 → 审批 → 扣款 | G1 + G2 |

当前 MVP 状态：**G1 已完成**（Railway 后端已部署）；E2E 可在 **生产环境** 或本地 mock 模式下验证。

---

## 2. E2E 验收 Checklist

### E2E-1：OpenClaw 配置 MCP

| 检查项 | 预期 | 结果 | 备注 |
|--------|------|------|------|
| MCP HTTP Server 启动 | `http://localhost:8080/mcp` 可访问 | ✅ | `npm run start:http` |
| `/health` 健康检查 | 返回 `{"status":"ok"}` | ✅ | |
| openclaw-mcp-bridge 配置 | `servers[].url` 指向 MCP Base URL | 📋 | 见 [OpenClaw-Setup.md](OpenClaw-Setup.md) |
| Tools 可见 | `aegis_request_payment` 等 4 个工具 | 📋 | 需 OpenClaw 实际运行验证 |

**结论：** MCP Server 与配置文档已就绪；需在真实 OpenClaw 环境中验证 tools 可见性。

---

### E2E-2：用户在网页添加卡

| 检查项 | 预期 | 结果 | 备注 |
|--------|------|------|------|
| 添加卡路由 | `/dev/add-card` | 📋 | 见 Implementation Todos G2-1 |
| Stripe Elements | 前端收集卡号，不落库 | 📋 | G2-2 |
| 保存 PaymentMethod | `POST /api/dev/payment-methods` 接收 pm_ | ✅ | 后端已实现 |
| 展示已添加卡（掩码） | `Visa **** 4242` | 📋 | G2-6 |

**替代：** `POST /api/dev/stripe/setup-test-card` 可在配置 `STRIPE_SECRET_KEY` 后绑定 Stripe 测试卡（`tok_visa`），无需前端。仅用于开发测试。

**结论：** 若 G2 前端已实现（Implementation Todos 标记 ✅），则 E2E-2 可验收。

---

### E2E-3：OpenClaw 发起 aegis_request_payment

| 检查项 | 预期 | 结果 | 备注 |
|--------|------|------|------|
| REST API 创建请求 | 201，返回 `action_id`、`approval_url` | ✅ | curl 验证通过 |
| MCP 工具调用 | `aegis_request_payment` 成功 | ✅ | MCP client 自动填充 `idempotency_key`、`recipient_reference` |
| 必填字段 | `idempotency_key`、`recipient_reference` | ✅ | API 校验通过 |

**验证命令：**

```bash
curl -X POST http://localhost:3000/v1/request_action \
  -H 'X-Aegis-API-Key: aegis_demo_agent_key' \
  -H 'Content-Type: application/json' \
  -d '{
    "idempotency_key": "e2e-001",
    "action_type": "payment",
    "end_user_id": "usr_demo",
    "details": {
      "amount": "20.00",
      "currency": "USD",
      "recipient_name": "Cursor",
      "description": "Cursor Pro 月费",
      "payment_rail": "card",
      "payment_method_preference": "card_default",
      "recipient_reference": "merchant_api:cursor"
    },
    "callback_url": "https://httpbin.org/post"
  }'
```

**结论：** E2E-3 通过（REST + MCP 均可）。

---

### E2E-4：用户审批

| 检查项 | 预期 | 结果 | 备注 |
|--------|------|------|------|
| 邮件触达 | `/dev/emails` 可见 magic link | ✅ | MVP 邮件落 dev outbox |
| Web 审批页 | `/approve/:token` 展示详情，批准/拒绝 | ✅ | |
| App 审批 | 首页 pending 卡片 → 审批详情 → Face ID 批准 | ✅ | 见 [Aegis-E2E-Demo-Script.md](Aegis-E2E-Demo-Script.md) |
| 批准后状态 | `approved` → `executing` → `succeeded` | ✅ | mock 执行 |

**结论：** E2E-4 通过（Web + App 审批流程已可演示）。

---

### E2E-5：确认扣款成功

| 检查项 | 预期 | 结果 | 备注 |
|--------|------|------|------|
| `aegis_get_payment_status` | 返回 `succeeded` | ✅ | mock 模式 |
| Stripe Dashboard | 可见 charge | ⬜ | 需 G2 + STRIPE_SECRET_KEY + 真实/测试卡 |
| Webhook 回调 | `callback_url` 收到终态 | ✅ | mock 模式 |

**结论：** mock 模式下 E2E-5 通过；真实 Stripe 扣款需 G2 完成。

---

## 2B. 团队试点 E2E Checklist（团队版增量）

> 目标：最小回归覆盖 **2 成员 + 1 管理员**，审批策略为「成员自批」，管理员仅查看历史。

### 测试角色（最小集合）

| 角色 | 示例 ID | 用途 |
|------|---------|------|
| 成员 A | `usr_team_01` | 发起并自批成功路径 |
| 成员 B | `usr_team_02` | 权限失败路径（不可审批成员 A） |
| 管理员 | `usr_team_admin` | 查看团队历史（只读） |

### 团队试点执行前检查（建议先做）

```bash
# Backend / MCP 健康检查
curl http://localhost:3000/healthz
curl http://localhost:8080/health

# 管理员历史接口权限检查（管理员）
curl "http://localhost:3000/api/app/admin/history?user_id=usr_team_admin&limit=5"

# 管理员历史接口权限检查（普通成员，应失败）
curl "http://localhost:3000/api/app/admin/history?user_id=usr_team_01&limit=5"
```

检查点：

- 成员使用的 `AEGIS_USER_ID` 来自当前 seed：`usr_team_01..usr_team_10`
- 管理员使用 `usr_team_admin`
- 成员 A 已有默认卡；成员 B 无默认卡（用于失败路径）

### Team-E2E-1：成功路径（成员 A 自批成功）

| 检查项 | 预期 | 结果 | 备注 |
|--------|------|------|------|
| 成员 A 使用 OpenClaw 发起支付 | 返回 `action_id` | 📋 | 记录 action_id_A |
| action 响应字段存在性 | `team_id`、`requested_by_user_id`、`approval_target_user_id`、`approval_policy` 存在 | 📋 | 记录响应 JSON |
| self-approval 字段值校验 | `requested_by_user_id == approval_target_user_id == usr_team_01` | 📋 | `approval_policy` 为成员自批策略值（以实际返回为准） |
| 成员 A 本人审批 | 审批成功 | 📋 | App/Web 任一方式 |
| OpenClaw 轮询状态 | `approved` -> `executing` -> `succeeded` | 📋 | `aegis_get_payment_status` |

**通过标准：** 成员 A 可独立完成「发起 -> 本人审批 -> 成功」闭环，无需管理员审批。

可执行操作（示例）：

1. 在成员 A 的 OpenClaw 环境设置 `AEGIS_USER_ID=usr_team_01`
2. 发起 `aegis_request_payment`（或用 REST `POST /v1/request_action`）并记录 `action_id_A`
3. 检查响应 JSON 中 `requested_by_user_id` 与 `approval_target_user_id` 是否都为 `usr_team_01`
4. 用成员 A 本人完成审批
5. 轮询 `aegis_get_payment_status(action_id_A)` 直到终态

### Team-E2E-2：权限失败（成员 B 不可审批成员 A）

| 检查项 | 预期 | 结果 | 备注 |
|--------|------|------|------|
| 成员 A 发起 action | 创建成功 | 📋 | 使用 action_id_A |
| 成员 B 尝试审批 action_id_A | 返回拒绝（如 403 / 审批失败） | 📋 | 具体错误文案以实际接口返回为准 |
| 成员 B 越权审批后状态不变 | `action_id_A` 仍为待审批（或原状态） | 📋 | 防止越权审批 |

**通过标准：** 非 `approval_target_user_id` 的成员无法审批他人请求。

可执行操作（示例）：

1. 保持成员 A 创建的 `action_id_A` 处于待审批
2. 切换到成员 B 身份（`AEGIS_USER_ID=usr_team_02`）尝试审批同一 action
3. 记录失败响应（403/审批失败）
4. 再次查询 `action_id_A` 状态，确认未变为 `approved` / `succeeded`

### Team-E2E-3：失败路径（成员无默认卡）

| 检查项 | 预期 | 结果 | 备注 |
|--------|------|------|------|
| 选取无默认卡成员（如成员 B） | 发起支付请求 | 📋 | 确保该成员未设置默认卡 |
| 调用返回错误 | `NO_DEFAULT_PAYMENT_METHOD` | 📋 | 若错误包装不同，至少要能识别“无默认卡” |
| 修复后重试（可选） | 配置默认卡后可正常发起 | 📋 | 验证恢复路径 |

**通过标准：** 无默认卡时明确失败，不进入错误审批流程。

可执行操作（示例）：

1. 使用成员 B（`usr_team_02`）发起支付
2. 确认返回 `NO_DEFAULT_PAYMENT_METHOD`
3. 打开 `/settings/payment-methods?user_id=usr_team_02` 添加并设默认卡（可选）
4. 重试发起支付，确认恢复

### Team-E2E-4：管理员只读历史可见

| 检查项 | 预期 | 结果 | 备注 |
|--------|------|------|------|
| 管理员访问团队历史页面 | 可加载团队 action 列表 | 📋 | `/admin/team-history?user_id=usr_team_admin` |
| 列表字段 | 显示 `action_id` / `requested_by_user_id` / amount/currency / `recipient_name` / `status` / `created_at` | 📋 | 只读展示 |
| 页面行为（只读） | 无审批按钮 | 📋 | 管理员仅查看历史 |
| 普通成员访问同 API | 被拒绝（API 返回错误） | 📋 | `/api/app/admin/history?user_id=usr_team_01` |

**通过标准：** 管理员可见团队历史；普通成员不能调用管理员历史接口。

可执行操作（示例）：

1. 浏览器打开 `/admin/team-history?user_id=usr_team_admin`
2. 确认页面表格展示团队 action 历史，且没有 approve/deny 按钮
3. 浏览器或 curl 访问 `/api/app/admin/history?user_id=usr_team_01`
4. 确认返回 403（权限拒绝）

### Team-E2E 通过标准（mock 模式 vs 真实 Stripe 模式）

| 模式 | 通过标准 |
|------|----------|
| mock 模式（未配置 `STRIPE_SECRET_KEY` 或走 mock 执行） | 成员 A 可完成自批并到达终态；无默认卡/越权审批/管理员只读权限校验全部通过；`succeeded` 可为 mock 执行结果 |
| 真实 Stripe 模式（配置 Stripe 且成员有测试/真实卡） | 除上述权限与流程校验外，还需在 Stripe 侧看到对应支付记录（测试模式可在 Dashboard 看到 test charge / payment intent） |

---

## 2C. End-user Auth（Google / GitHub / Email+Password）验收

> 新增终端用户门户入口：`/auth`。目标是验证三种登录/注册模式与 `app_session` 打通。

### Auth-E2E-1：入口与模式切换

| 检查项 | 预期 | 结果 | 备注 |
|--------|------|------|------|
| 打开 `/auth` | 显示注册页（signup） | 📋 | 标题 `Create your account` |
| 页面可见 3 种模式 | GitHub / Google / Email | 📋 | OAuth 未配置时可显示为禁用 |
| `mode=signin` | 切到登录态文案 | 📋 | 标题 `Welcome back` |

### Auth-E2E-2：Email+Password 注册/登录（本地最小闭环）

| 检查项 | 预期 | 结果 | 备注 |
|--------|------|------|------|
| `POST /auth/email/register` | 返回成功并设置 app session cookie | 📋 | 密码至少 8 位 |
| 注册后打开 `/auth` | 显示已登录态 | 📋 | Signed in as ... |
| `POST /auth/logout` | 清理 session | 📋 | 回到未登录 |
| `POST /auth/email/login` | 正确密码登录成功 | 📋 | 返回 `ok: true` |
| 错误密码 | `INVALID_CREDENTIALS` | 📋 | 不暴露“邮箱不存在/密码错误”细节 |
| 登录后访问 `/settings/payment-methods`（无 query） | 可正常加载（依赖 app session） | 📋 | session-first 门户行为 |

### Auth-E2E-2B：密码重置（最小闭环）

| 检查项 | 预期 | 结果 | 备注 |
|--------|------|------|------|
| Sign in 页点击 `Forgot password?` | 可发起请求 | 📋 | 请求重置链接 |
| `POST /auth/password-reset/request` | 返回统一成功文案 | 📋 | 避免账号枚举 |
| `/dev/emails` | 可看到 Password Reset 邮件 | 📋 | 含 `reset_url` |
| 打开 reset link | 显示重置密码表单 | 📋 | `/auth/password-reset?token=...` |
| 提交新密码 | 重置成功，可用新密码登录 | 📋 | 旧密码失效 |

### Auth-E2E-3：OAuth Provider 未配置（降级行为）

| 检查项 | 预期 | 结果 | 备注 |
|--------|------|------|------|
| `/auth` 页面按钮 | Google/GitHub 显示但不可用（或明确提示） | 📋 | 本轮默认显示+提示 |
| `GET /auth/oauth/google/start` | 返回 `OAUTH_PROVIDER_NOT_ENABLED` | 📋 | JSON 或页面错误均可 |

### Auth-E2E-4：Google / GitHub OAuth（配置后）

| 检查项 | 预期 | 结果 | 备注 |
|--------|------|------|------|
| 点击 Google/GitHub 登录 | 跳转 provider 授权页 | 📋 | 带 state |
| callback 成功 | 自动匹配/创建 `end_user`，并设置 app session | 📋 | 同邮箱自动匹配 |
| callback state 无效/过期 | 返回 `OAUTH_INVALID_STATE` / `OAUTH_STATE_EXPIRED` | 📋 | 可回跳 `/auth?error=...` |

### Auth 模式通过标准（本地 / 线上）

| 模式 | 通过标准 |
|------|----------|
| 本地最小闭环（无 OAuth secrets） | `/auth` 页面可用；Email+Password 注册/登录成功；OAuth 未配置时降级行为正确 |
| 完整模式（配置 Google/GitHub） | 在本地或线上均可完成 Google/GitHub OAuth 登录 callback 成功，并进入已登录态；密码重置最小闭环可用 |

---

## 3. 汇总

| E2E 步骤 | 状态 | 阻塞原因 |
|----------|------|----------|
| E2E-1 OpenClaw 配置 MCP | ✅ 文档就绪 | 需真实 OpenClaw 验证 tools |
| E2E-2 用户添加卡 | 📋 | 依赖 G2 前端（Todos 标记已完成） |
| E2E-3 发起支付 | ✅ | — |
| E2E-4 用户审批 | ✅ | — |
| E2E-5 扣款成功 | ✅ mock | 真实扣款需 G2 + Stripe |

**全流程（含真实 Stripe）阻塞点：** G1 部署 + G2 添加卡。

---

## 4. 发现的 Bug / 改进建议

| # | 类型 | 描述 | 建议 |
|---|------|------|------|
| 1 | 文档 | REST 直连示例缺少 `idempotency_key`、`recipient_reference` | 已在 OpenClaw/Manus 文档中补充；Landing 页 curl 示例可同步 |
| 2 | API | `idempotency_key` 仅 body，Spec 建议 Header | 见 Implementation Todos §5.1 |
| 3 | Dev | `POST /api/dev/actions/:id/decision` 需 admin 登录 | 自动化 E2E 可考虑增加无鉴权 dev-only 开关（仅本地） |
| 4 | MCP | MCP client 固定 `recipient_reference: merchant_api:mcp` | 可扩展为可选参数，便于区分不同商户 |

---

## 5. Peer Review：部署与 PCI 检查项

### 5.1. Agent A — 部署配置（G1）

| 检查项 | 说明 | 状态 |
|--------|------|------|
| `BASE_URL` | 生产环境公网 URL，用于 approval_url、邮件链接 | ✅ Railway 已配置 |
| `STRIPE_SECRET_KEY` | Stripe 测试/生产 key；空则使用 mock | ⬜ 可选 |
| 持久化 DB | SQLite 文件或迁移至 Vercel Postgres | ✅ Railway Volume |
| MCP HTTP 同域/子域 | 与后端同域或独立子域，便于 CORS | ⬜ 可选；REST 直连可用 |
| Admin 密码 | `ADMIN_PASSWORD` 生产环境强密码 | ⬜ 建议修改 |

### 5.2. Agent B — Stripe 集成与 PCI

| 检查项 | 说明 | 状态 |
|--------|------|------|
| **卡数据不落库** | 仅存储 Stripe `pm_xxx`、`cus_xxx`；无卡号、CVV | ✅ `payment_methods.external_token` 存 pm_ id |
| **Stripe Elements** | 前端用 Stripe.js 收集卡信息，`createPaymentMethod()` 得 pm_ | 📋 `POST /api/dev/payment-methods` 已支持接收 pm_ |
| **添加卡页** | 需独立路由加载 Stripe Elements；G2-1 待实现 | ⬜ |
| **3DS / SCA** | `PaymentIntent.confirm` 若需 `requires_action`，MVP 未处理 | ⚠️ 见 execution.ts，返回 `PSP_REQUIRES_ACTION` |
| **密钥管理** | `STRIPE_SECRET_KEY` 仅服务端，不暴露前端 | ✅ |

**PCI 结论：** 当前实现符合「不接触原始卡数据」原则；添加卡需通过 Stripe Elements 生成 `pm_` 后传后端，不可在后端接收卡号/CVV。

---

## 6. 真实环境验收（G1 完成后）

G1 部署完成后，可使用实际 URL 执行 E2E 验收。

### 6.1. 使用 e2e-verify.sh / e2e-demo-verify.sh

```bash
# Demo 一键验收（默认生产环境 Railway）
./scripts/e2e-demo-verify.sh
# 或
npm run e2e:demo

# 本地（默认 http://localhost:3000）
./scripts/e2e-verify.sh
# 或
npm run e2e:verify

# 指定后端 + MCP URL
BACKEND_URL=https://aegis-xxx.vercel.app MCP_URL=https://mcp-xxx.railway.app ./scripts/e2e-verify.sh

# 完整流程（含 dev 批准，需 admin 密码）
E2E_FULL=1 E2E_ADMIN_PASSWORD=your_admin_pass \
  BACKEND_URL=https://aegis-production-7cee.up.railway.app \
  ./scripts/e2e-verify.sh
```

### 6.2. 环境变量

| 变量 | 说明 | 默认 |
|------|------|------|
| `BACKEND_URL` | 后端根地址 | `http://localhost:3000` |
| `MCP_URL` | MCP HTTP 服务根地址（可选） | — |
| `API_KEY` | Agent API Key | `aegis_demo_agent_key` |
| `USER_ID` | 审批用户 ID | `usr_demo` |
| `E2E_FULL` | 设为 `1` 时执行完整流程（登录 + dev 批准 + 轮询 succeeded） | — |
| `E2E_ADMIN_PASSWORD` | Admin 密码，`E2E_FULL=1` 时必填 | — |

### 6.3. 验收步骤对应

| 脚本步骤 | E2E 验收项 | 说明 |
|----------|------------|------|
| E2E-1 | 健康检查 | Backend `/healthz`、MCP `/health`、MCP tools 可见 |
| E2E-3 | 发起支付 | `POST /v1/request_action` 创建请求 |
| E2E-5 | 查询状态 | `GET /v1/actions/:id` 获取 status |
| E2E-FULL | 完整流程 | 登录 → dev 批准 → 轮询 `succeeded` |

E2E-2（添加卡）、E2E-4（用户审批）需人工在浏览器/App 完成；`E2E_FULL` 通过 dev 端点模拟批准，用于自动化验证执行与回调。

### 6.4. 参考脚本

- [scripts/e2e-verify.sh](../scripts/e2e-verify.sh) — E2E 验收脚本
- [scripts/e2e-demo-verify.sh](../scripts/e2e-demo-verify.sh) — Demo 一键验收（默认生产环境）
- [scripts/auth-e2e-smoke.sh](../scripts/auth-e2e-smoke.sh) — End-user Auth smoke（注册/登录/重置密码/session-first 门户）
- [scripts/verify-deployment.sh](../scripts/verify-deployment.sh) — 部署健康检查（轻量）

---

## 7. 相关文档

- [OpenClaw-Setup.md](OpenClaw-Setup.md)
- [Manus-Setup.md](Manus-Setup.md)
- [Aegis-E2E-Demo-Script.md](Aegis-E2E-Demo-Script.md)
- [Aegis-Implementation-Todos.md](Aegis-Implementation-Todos.md) §6
