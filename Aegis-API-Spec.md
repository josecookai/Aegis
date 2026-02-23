---
doc_type: api
version: "1.0"
status: stable
last_updated: "2026-02-23"
author: "Manus AI"
tags:
  - api
  - rest
  - webhook
dependencies:
  - Aegis_ AI Agent Consumption Authorization Protocol - Product Specification.md
related_docs:
  - Aegis-App-Flow-Spec.md
  - Aegis-Mobile-UX-Spec.md
  - Aegis-Glossary.md
quick_ref: |
  Aegis 面向 Agent 的 REST API：POST /v1/request_action 提交支付请求，GET /v1/requests/{id} 查询状态，Webhook 回调通知结果。鉴权：API Key 或 OAuth。Base URL: https://api.aegis.com/v1
---

# Aegis: API Specification

---

## 0. Quick Reference（快速参考）

### 核心端点

| 端点 | 方法 | 用途 | 认证 |
|------|------|------|------|
| `/v1/request_action` | POST | 提交支付请求 | API Key / OAuth |
| `/v1/requests/{request_id}` | GET | 查询请求状态 | API Key / OAuth |

### 鉴权方式

```http
Authorization: Bearer <api_key>
# 或
X-Api-Key: <api_key>
```

### Base URL

- **Production:** `https://api.aegis.com`
- **Sandbox:** `https://api.sandbox.aegis.com`

### 请求状态枚举

`created` | `pending` | `approved` | `denied` | `expired` | `executing` | `executed` | `failed`

### 最小示例

```bash
curl -X POST https://api.aegis.com/v1/request_action \
  -H 'Authorization: Bearer YOUR_API_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "action_type": "payment",
    "details": {
      "amount": "149.99",
      "currency": "USD",
      "recipient_name": "United Airlines"
    },
    "callback_url": "https://your-agent.com/webhook"
  }'
```

**完整文档：** 见下方各章节

---

## 1. 概述

### 1.1. Base URL

- **Production:** `https://api.aegis.com`
- **Sandbox:** `https://api.sandbox.aegis.com`

所有端点均以 `/v1` 为前缀（如 `/v1/request_action`）。

### 1.2. 鉴权

Agent 必须在请求中携带有效凭证，否则返回 `401 Unauthorized`。

**方式一：API Key（推荐）**

```http
Authorization: Bearer <api_key>
```

或：

```http
X-Api-Key: <api_key>
```

**方式二：OAuth 2.0**

```http
Authorization: Bearer <access_token>
```

（具体 OAuth 的 token 获取流程另文档说明；本 spec 仅约定请求头格式。）

- API Key 或 OAuth 与某一「Agent 注册主体」及可选「用户绑定」关联；后端据此校验是否有权代表对应用户发起请求。
- 若请求针对的用户与 token 不匹配或未绑定，返回 `403 Forbidden`。

### 1.3. 通用约定

- **Content-Type:** 请求体为 JSON 时使用 `Content-Type: application/json`。
- **响应体：** 成功时返回 JSON 业务数据；错误时返回统一错误体（见下）。
- **字符编码：** UTF-8。

### 1.4. 通用错误响应

所有错误响应采用统一结构：

```json
{
  "error": {
    "code": "string",
    "message": "string",
    "request_id": "string"
  }
}
```

| HTTP Status | code 示例 | 说明 |
|-------------|-----------|------|
| 400 | `invalid_request` | 请求参数不合法（如缺少必填字段、格式错误） |
| 401 | `unauthorized` | 未提供或无效的鉴权凭证 |
| 403 | `forbidden` | 无权限代表该用户或执行该操作 |
| 404 | `not_found` | 资源不存在（如 request_id 无效） |
| 409 | `conflict` | 冲突（如重复提交同一请求的最终决策） |
| 429 | `rate_limit_exceeded` | 超过限流阈值 |
| 500 | `internal_error` | 服务器内部错误 |

---

## 2. 核心端点

### 2.1. POST /v1/request_action

Agent 提交一条待用户审批的「动作请求」（如支付）。

**Request Headers**

| Header | 必填 | 说明 |
|--------|------|------|
| `Authorization` 或 `X-Api-Key` | 是 | 见 1.2 |
| `Content-Type` | 是 | `application/json` |
| `Idempotency-Key` | 否 | 幂等键，建议 UUID；相同 key 在有效期内返回同一 `request_id` |

**Request Body**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `action_type` | string | 是 | 固定为 `payment`（后续可扩展） |
| `details` | object | 是 | 见 ActionDetails |
| `callback_url` | string | 是 | 用户操作后 Aegis 将向该 URL 发送 POST 回调；须 HTTPS |
| `user_id` | string | 条件 | 若 Agent 与多用户绑定，需指定代表哪位用户；否则由 token 唯一绑定用户时可省略 |

**ActionDetails（payment）**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `amount` | string | 是 | 金额，如 `"149.99"` |
| `currency` | string | 是 |  ISO 4217，如 `USD`；加密货币可用 `USDT`、`USDC` 等 |
| `recipient_name` | string | 是 | 收款方名称，如 `United Airlines` |
| `description` | string | 否 | 描述，如 `Flight UA-241 SFO to LAX` |
| `payment_method_preference` | string | 否 | `credit_card` \| `crypto` \| 不传则由用户选择 |

**Request 示例**

```json
{
  "action_type": "payment",
  "details": {
    "amount": "149.99",
    "currency": "USD",
    "recipient_name": "United Airlines",
    "description": "Flight UA-241 SFO to LAX",
    "payment_method_preference": "credit_card"
  },
  "callback_url": "https://agent.example.com/payment_status"
}
```

**Response — 201 Created**

```json
{
  "request_id": "req_abc123xyz",
  "status": "pending"
}
```

**Error Responses**

- `400` — 参数校验失败（如 amount 非数字、callback_url 非 HTTPS）
- `401` — 鉴权失败
- `403` — 无权限为该用户发起请求
- `429` — 限流

**幂等：** 同一 `Idempotency-Key` 在有效时间窗内（如 24 小时）再次请求，返回相同 `request_id` 与 201，且不重复入队或推送。

---

### 2.2. GET /v1/requests/{request_id}

查询某条请求的当前状态（供 Agent 轮询或排查）。

**Request**

- Path: `request_id` 由 `POST /v1/request_action` 返回。

**Response — 200 OK**

```json
{
  "request_id": "req_abc123xyz",
  "status": "pending",
  "action_type": "payment",
  "details": { ... },
  "created_at": "2026-02-23T10:00:00Z",
  "updated_at": "2026-02-23T10:00:00Z"
}
```

`status` 枚举：`created` | `pending` | `approved` | `denied` | `expired` | `executing` | `executed` | `failed`（与 [App Flow Spec](Aegis-App-Flow-Spec.md) 状态机一致）。

**Error Responses**

- `401` — 鉴权失败
- `403` — 无权限查看该请求
- `404` — request_id 不存在

---

## 3. Webhook 回调

用户完成操作（批准/拒绝/超时）且后端完成处理后，Aegis 向 Agent 提供的 `callback_url` 发送 **POST** 请求。

### 3.1. Callback Payload

| 字段 | 类型 | 说明 |
|------|------|------|
| `request_id` | string | 对应请求 ID |
| `status` | string | 终态：`approved`（已批准，可能仍在执行）\| `denied` \| `expired` \| `executed` \| `failed` |
| `timestamp` | string | ISO 8601 事件时间 |
| `tx_hash` | string | 可选；加密货币交易成功时的链上 tx hash |
| `payment_id` | string | 可选；信用卡支付成功时网关返回的 payment/charge ID |
| `error_code` | string | 可选；`failed` 时的错误码 |
| `error_message` | string | 可选；人类可读的错误说明 |

**示例（成功）**

```json
{
  "request_id": "req_abc123xyz",
  "status": "executed",
  "timestamp": "2026-02-23T10:05:00Z",
  "payment_id": "ch_xxx"
}
```

**示例（拒绝）**

```json
{
  "request_id": "req_abc123xyz",
  "status": "denied",
  "timestamp": "2026-02-23T10:02:00Z"
}
```

**示例（执行失败）**

```json
{
  "request_id": "req_abc123xyz",
  "status": "failed",
  "timestamp": "2026-02-23T10:06:00Z",
  "error_code": "card_declined",
  "error_message": "Card was declined by issuer."
}
```

### 3.2. 回调签名（可选但推荐）

为防止伪造，Aegis 可在回调请求头中携带签名，Agent 端校验。例如：

- Header: `X-Aegis-Signature: t=<timestamp>,v1=<signature>`
- 签名方式：`HMAC-SHA256(payload_body, secret)`，secret 在 Agent 注册时下发。
- Agent 收到后应校验时间戳在合理窗口内并重放，并验证 signature。

（具体 key 名称与算法可在实现时统一，并在开发者文档中说明。）

### 3.3. 重试策略

- 若 Agent 返回 2xx，Aegis 视为送达，不再重试。
- 若超时或返回 4xx/5xx，Aegis 按指数退避重试（如 1min、5min、30min），总重试次数上限可配置（如 5 次）。
- 建议 Agent 端实现幂等：同一 `request_id` 可能被多次回调，只处理第一次终态即可。

---

## 4. 数据模型摘要

### 4.1. 枚举

**action_type**

- `payment`

**status**

- `created` | `pending` | `approved` | `denied` | `expired` | `executing` | `executed` | `failed`

**payment_method_preference**

- `credit_card` | `crypto`（或留空由用户选择）

### 4.2. TypeScript 类型参考

```ts
type ActionType = "payment";

type PaymentMethodPreference = "credit_card" | "crypto";

type RequestStatus =
  | "created"
  | "pending"
  | "approved"
  | "denied"
  | "expired"
  | "executing"
  | "executed"
  | "failed";

interface ActionDetails {
  amount: string;
  currency: string;
  recipient_name: string;
  description?: string;
  payment_method_preference?: PaymentMethodPreference;
}

interface RequestActionBody {
  action_type: ActionType;
  details: ActionDetails;
  callback_url: string;
  user_id?: string;
}

interface RequestActionResponse {
  request_id: string;
  status: "pending";
}

interface CallbackPayload {
  request_id: string;
  status: RequestStatus;
  timestamp: string;
  tx_hash?: string;
  payment_id?: string;
  error_code?: string;
  error_message?: string;
}
```

---

## 5. 限流与幂等

### 5.1. 限流

- 按 Agent（API Key / OAuth client）维度限流，例如：每分钟最多 N 次 `POST /v1/request_action`，每分钟最多 M 次 `GET /v1/requests/:id`。
- 超出时返回 `429 Too Many Requests`，Body 中可包含 `retry_after`（秒）。
- 具体 N、M 数值在部署或套餐中配置，文档中注明「以控制台/文档为准」。

### 5.2. 幂等

- **创建请求：** 使用 `Idempotency-Key` 头；相同 key 在有效期内返回同一 `request_id`，且不重复推送用户。
- **用户决策：** 同一 `request_id` 只接受一次批准或拒绝；后续重复提交返回 `409 Conflict`。

---

## 6. 与其它规格的对应关系

- 状态枚举与流程与 [Aegis-App-Flow-Spec.md](Aegis-App-Flow-Spec.md) 一致。
- 移动端拉取详情、提交审批等若需额外端点（如 App 专用 `GET /v1/me/requests`），可在本文档或 OpenAPI 中追加，与上述 Agent 端点区分鉴权方式（用户 token vs Agent API Key）。

---

## 7. OpenAPI 规范

完整 OpenAPI 3.0 定义见：`openapi.yaml`（如存在）

---

## 8. 代码示例索引

| 示例 | 位置 | 说明 |
|------|------|------|
| POST /v1/request_action | §2.1 | 提交支付请求 |
| GET /v1/requests/{id} | §2.2 | 查询请求状态 |
| Callback Payload（成功） | §3.1 | Webhook 回调示例 |
| Callback Payload（拒绝） | §3.1 | Webhook 回调示例 |
| Callback Payload（失败） | §3.1 | Webhook 回调示例 |
| TypeScript 类型 | §4.2 | 数据模型类型定义 |
