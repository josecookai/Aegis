# OpenClaw REST API 直连指南

> 当 OpenClaw 的 MCP bridge 无法使用（如「Server not initialized」）时，直接调用 Aegis 后端 REST API 即可。REST API 无状态、单次 HTTP 请求，无需 MCP 会话。

---

## 1. 为什么用 REST 而不是 MCP

MCP Streamable HTTP 需要：
- 持久连接（SSE）
- 会话状态（initialize → initialized → 工具调用）
- 顺序消息

OpenClaw 的 `openclaw-mcp-bridge` 每次发起独立 HTTP 请求，无法维持 MCP 会话，会返回「Server not initialized」。

**解决方案**：Aegis 后端已暴露完整 REST API，每个请求独立、无状态。OpenClaw 只需配置 HTTP 工具，直接调用后端 Base URL。

---

## 2. 固定配置

| 项目 | 值 |
|------|-----|
| **Base URL** | `https://aegis-production-7cee.up.railway.app` |
| **Headers** | `X-Aegis-API-Key: aegis_demo_agent_key` |
| | `Content-Type: application/json` |
| **用户 ID** | `usr_demo`（测试用户） |

---

## 3. 端点速查表

| 操作 | 方法 | 路径 | 说明 |
|------|------|------|------|
| 查询能力 | GET | `/v1/payment_methods/capabilities?end_user_id=usr_demo` | 返回 rails、methods |
| 创建支付 | POST | `/v1/request_action` | 需 idempotency_key、details、callback_url |
| 查询状态 | GET | `/v1/actions/:actionId` | 轮询用 |
| 取消支付 | POST | `/v1/actions/:actionId/cancel` | 可选 |

---

## 4. curl 示例

### 步骤 1：查询支付能力

```bash
curl -s "https://aegis-production-7cee.up.railway.app/v1/payment_methods/capabilities?end_user_id=usr_demo" \
  -H "X-Aegis-API-Key: aegis_demo_agent_key" \
  -H "Content-Type: application/json"
```

**响应示例：**

```json
{
  "end_user_id": "usr_demo",
  "rails": ["card", "crypto"],
  "methods": [
    {"id": "pm_card_demo", "rail": "card", "alias": "Visa **** 4242", "is_default": true},
    {"id": "pm_crypto_demo", "rail": "crypto", "alias": "Base USDC Wallet", "is_default": true}
  ]
}
```

### 步骤 2：创建支付请求

```bash
curl -s -X POST "https://aegis-production-7cee.up.railway.app/v1/request_action" \
  -H "X-Aegis-API-Key: aegis_demo_agent_key" \
  -H "Content-Type: application/json" \
  -d '{
  "idempotency_key": "openclaw-smoke-003",
  "end_user_id": "usr_demo",
  "action_type": "payment",
  "callback_url": "https://example.com/aegis-callback",
  "details": {
    "amount": "129.99",
    "currency": "USD",
    "recipient_name": "OpenClaw Test Merchant",
    "description": "OpenClaw smoke test via REST API",
    "payment_rail": "card",
    "payment_method_preference": "card_default",
    "recipient_reference": "merchant_api:openclaw_demo"
  }
}'
```

**响应示例（201）：**

```json
{
  "action": {
    "action_id": "act_xxxxxxxx",
    "status": "awaiting_approval",
    "action_type": "payment",
    "end_user_id": "usr_demo",
    "details": {
      "amount": "129.99",
      "currency": "USD",
      "recipient_name": "OpenClaw Test Merchant",
      "description": "OpenClaw smoke test via REST API",
      "payment_rail": "card",
      "payment_method_preference": "card_default",
      "recipient_reference": "merchant_api:openclaw_demo"
    },
    "expires_at": "...",
    "created_at": "..."
  },
  "links": {
    "approval_url": "https://aegis-production-7cee.up.railway.app/approve/mltok_xxxxxxxx"
  }
}
```

**重要**：用户需点击 `approval_url` 完成审批，审批前不要假设状态已变更。

### 步骤 3：查询状态（轮询）

```bash
curl -s "https://aegis-production-7cee.up.railway.app/v1/actions/act_xxxxxxxx" \
  -H "X-Aegis-API-Key: aegis_demo_agent_key"
```

**状态枚举**：`awaiting_approval` → `approved` → `executing` → `succeeded` / `denied` / `expired` / `failed`

### 步骤 4：取消支付（可选）

```bash
curl -s -X POST "https://aegis-production-7cee.up.railway.app/v1/actions/act_xxxxxxxx/cancel" \
  -H "X-Aegis-API-Key: aegis_demo_agent_key" \
  -H "Content-Type: application/json" \
  -d '{"reason": "用户取消"}'
```

---

## 5. OpenClaw HTTP 工具配置

若 OpenClaw 支持自定义 HTTP 工具，可配置以下 4 个工具：

| 工具名 | 方法 | URL 模板 | Body（POST） |
|--------|------|----------|--------------|
| `aegis_list_capabilities` | GET | `{BASE_URL}/v1/payment_methods/capabilities?end_user_id=usr_demo` | — |
| `aegis_request_payment` | POST | `{BASE_URL}/v1/request_action` | 见下方 schema |
| `aegis_get_payment_status` | GET | `{BASE_URL}/v1/actions/{action_id}` | — |
| `aegis_cancel_payment` | POST | `{BASE_URL}/v1/actions/{action_id}/cancel` | `{"reason": "可选"}` |

**aegis_request_payment 请求体 schema：**

```json
{
  "idempotency_key": "唯一字符串，如 openclaw-{timestamp}-{random}",
  "end_user_id": "usr_demo",
  "action_type": "payment",
  "callback_url": "https://your-agent.com/aegis-callback",
  "details": {
    "amount": "金额字符串，如 20.00",
    "currency": "USD",
    "recipient_name": "收款方名称",
    "description": "付款说明",
    "payment_rail": "card",
    "payment_method_preference": "card_default",
    "recipient_reference": "merchant_api:openclaw"
  }
}
```

**Headers（所有请求）：**

```
X-Aegis-API-Key: aegis_demo_agent_key
Content-Type: application/json
```

---

## 6. 典型流程

1. 调用 `GET /v1/payment_methods/capabilities` 确认用户有可用支付方式
2. 调用 `POST /v1/request_action` 创建支付请求
3. 从响应中取出 `action_id`、`approval_url`
4. **暂停**，提醒用户点击 `approval_url` 审批
5. 用户审批后，轮询 `GET /v1/actions/{action_id}` 直到 `status` 为 `succeeded`、`denied` 或 `failed`
6. 根据终态告知用户结果

---

## 7. 相关文档

- [Aegis-API-Spec.md](Aegis-API-Spec.md) — 完整 REST API 规格
- [OpenClaw-Setup.md](OpenClaw-Setup.md) — MCP 配置（当 MCP 可用时）
- [DEPLOYMENT.md](DEPLOYMENT.md) — 部署与 URL 说明
