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

当前 MVP 状态：G1/G2 未完成；E2E 可在 **本地 mock 模式** 下部分验证。

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
| `BASE_URL` | 生产环境公网 URL，用于 approval_url、邮件链接 | ⬜ G1 未完成 |
| `STRIPE_SECRET_KEY` | Stripe 测试/生产 key；空则使用 mock | ⬜ |
| 持久化 DB | SQLite 文件或迁移至 Vercel Postgres | ⬜ |
| MCP HTTP 同域/子域 | 与后端同域或独立子域，便于 CORS | ⬜ |
| Admin 密码 | `ADMIN_PASSWORD` 生产环境强密码 | ⬜ |

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

### 6.1. 使用 e2e-verify.sh

```bash
# 本地（默认 http://localhost:3000）
./scripts/e2e-verify.sh
# 或
npm run e2e:verify

# 指定后端 + MCP URL
BACKEND_URL=https://aegis-xxx.vercel.app MCP_URL=https://mcp-xxx.railway.app ./scripts/e2e-verify.sh

# 完整流程（含 dev 批准，需 admin 密码）
E2E_FULL=1 E2E_ADMIN_PASSWORD=your_admin_pass \
  BACKEND_URL=https://aegis-xxx.vercel.app \
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
- [scripts/verify-deployment.sh](../scripts/verify-deployment.sh) — 部署健康检查（轻量）

---

## 7. 相关文档

- [OpenClaw-Setup.md](OpenClaw-Setup.md)
- [Manus-Setup.md](Manus-Setup.md)
- [Aegis-E2E-Demo-Script.md](Aegis-E2E-Demo-Script.md)
- [Aegis-Implementation-Todos.md](Aegis-Implementation-Todos.md) §6
