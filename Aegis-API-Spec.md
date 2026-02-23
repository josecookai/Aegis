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
- 移动端拉取详情、提交审批使用 **App 侧 API**（§9），以 magic link `token` 鉴权，与 Agent API Key 区分。

---

## 9. App 侧 API（移动端）

移动端通过以下两种方式鉴权（无 Agent API Key），**二选一**：

1. **Magic link token**（从邮件/推送深链进入）：Deep Link 格式 `aegis://approve?token=<token>`
2. **Action ID + User ID**（从 App 内待审批列表点击进入）：无需 token，直接用列表中的 `action_id` 配合当前用户 `user_id`

### 9.1. GET /api/app/approval

拉取审批上下文（用于展示审批详情页）。支持两种鉴权路径，**二选一**：

**Request — 路径 A：Magic Link Token（从邮件/推送深链进入）**

| 方式 | 参数 | 必填 | 说明 |
|------|------|------|------|
| Query | `token` | 是 | Magic link token（邮件或推送中的审批链接所含） |

示例：`GET /api/app/approval?token=mltok_xxx`

**Request — 路径 B：Action ID + User ID（从待审批列表点击进入）**

| 方式 | 参数 | 必填 | 说明 |
|------|------|------|------|
| Query | `action_id` | 是 | Action ID（从 `GET /api/app/pending` 列表获取） |
| Query | `user_id` | 是 | 用户 ID（与 pending 列表请求一致） |

示例：`GET /api/app/approval?action_id=act_xxx&user_id=usr_demo`

> **优先级：** 若同时传入 `token` 和 `action_id`，以 `token` 为准。

**Response — 200 OK**

```json
{
  "valid": true,
  "token": "mltok_xxx",
  "already_decided": false,
  "decision": null,
  "action": {
    "action_id": "act_xxx",
    "status": "awaiting_approval",
    "action_type": "payment",
    "end_user_id": "usr_demo",
    "details": {
      "amount": "19.99",
      "currency": "USD",
      "recipient_name": "Demo Merchant",
      "description": "Test payment"
    },
    "callback_url": "https://...",
    "created_at": "2026-02-23T10:00:00Z",
    "expires_at": "2026-02-23T11:00:00Z"
  },
  "end_user": {
    "id": "usr_demo",
    "email": "user@example.com",
    "display_name": "Demo User"
  }
}
```

| Action 字段 | 类型 | 说明 |
|-------------|------|------|
| `created_at` | string | ISO 8601 请求创建时间 |
| `expires_at` | string | ISO 8601 审批过期时间 |

当 `valid: false` 或 token/action_id 无效/过期时，返回 200 且 `valid: false`、`reason` 说明原因。路径 B 中 `user_id` 与 action 所属用户不匹配时返回 `400`。

### 9.2. POST /api/app/approval/decision

提交批准或拒绝。支持两种鉴权路径，**二选一**：

**Request Body — 路径 A：Magic Link Token**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `token` | string | 是 | 同 GET 的 token |
| `decision` | string | 是 | `approve` \| `deny` |
| `decision_source` | string | 否 | 默认 `app_biometric`；可选 `app_biometric`、`web_magic_link` |

**Request Body — 路径 B：Action ID + User ID（从待审批列表进入时使用）**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `action_id` | string | 是 | Action ID |
| `user_id` | string | 是 | 用户 ID（后端校验与 action 所属用户一致） |
| `decision` | string | 是 | `approve` \| `deny` |
| `decision_source` | string | 否 | 默认 `app_biometric`；可选 `app_biometric`、`web_magic_link` |

> **优先级：** 若 body 中同时传入 `token` 和 `action_id`，以 `token` 为准。

**Response — 200 OK**

```json
{
  "ok": true,
  "action_id": "act_xxx",
  "request_id": "act_xxx",
  "status": "approved"
}
```

**Error Responses**

- `400` — token/action_id 缺失、decision 非法、decision_source 非法、user_id 与 action 不匹配
- `409` — 请求已非 awaiting_approval 状态
- `410` — 审批已过期

### 9.3. GET /api/app/pending

获取当前用户所有待审批的请求列表（状态为 `awaiting_approval`），供首页展示。

**Request**

| 方式 | 参数 | 必填 | 类型 | 说明 |
|------|------|------|------|------|
| Query | `user_id` | 是 | string | 用户 ID（如 `usr_demo`） |

**Response — 200 OK**

```json
{
  "items": [
    {
      "action_id": "act_xxx",
      "status": "awaiting_approval",
      "action_type": "payment",
      "end_user_id": "usr_demo",
      "details": {
        "amount": "19.99",
        "currency": "USD",
        "recipient_name": "Demo Merchant",
        "description": "Test payment"
      },
      "callback_url": "https://...",
      "created_at": "2026-02-23T10:00:00Z",
      "expires_at": "2026-02-23T11:00:00Z"
    }
  ],
  "count": 1
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `items` | array | Action 对象数组，按创建时间倒序；空列表时为 `[]` |
| `items[].created_at` | string | ISO 8601 请求创建时间（用于列表中显示时间） |
| `count` | number | items 数组长度 |

**Error Responses**

- `400`（`MISSING_USER_ID`）— 缺少 `user_id` 查询参数
- `500`（`INTERNAL_ERROR`）— 服务器内部错误

---

### 9.4. GET /api/app/history

获取当前用户所有请求的历史记录（所有状态），支持分页，供历史/审计页展示。

**Request**

| 方式 | 参数 | 必填 | 类型 | 默认值 | 说明 |
|------|------|------|------|--------|------|
| Query | `user_id` | 是 | string | — | 用户 ID |
| Query | `limit` | 否 | number | `50` | 每页返回条数，范围 1–200 |
| Query | `offset` | 否 | number | `0` | 偏移量（从 0 开始） |

**Response — 200 OK**

```json
{
  "items": [
    {
      "action_id": "act_xxx",
      "status": "approved",
      "action_type": "payment",
      "end_user_id": "usr_demo",
      "details": {
        "amount": "19.99",
        "currency": "USD",
        "recipient_name": "Demo Merchant",
        "description": "Test payment"
      },
      "callback_url": "https://...",
      "created_at": "2026-02-23T10:00:00Z",
      "expires_at": "2026-02-23T11:00:00Z"
    }
  ],
  "total": 42,
  "limit": 50,
  "offset": 0
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `items` | array | Action 对象数组，按创建时间倒序 |
| `items[].created_at` | string | ISO 8601 请求创建时间 |
| `total` | number | 该用户所有记录总数（用于分页计算） |
| `limit` | number | 本次请求的 limit 值 |
| `offset` | number | 本次请求的 offset 值 |

**Error Responses**

- `400`（`MISSING_USER_ID`）— 缺少 `user_id` 查询参数
- `500`（`INTERNAL_ERROR`）— 服务器内部错误

**分页示例：** 第 2 页（每页 20 条）→ `GET /api/app/history?user_id=usr_demo&limit=20&offset=20`

---

### 9.5. 与 Agent API 的区别

| 项目 | Agent API | App 侧 API |
|------|-----------|-------------|
| 鉴权 | API Key / OAuth | Magic link token 或 action_id+user_id（query/body） |
| 用途 | 创建请求、查询状态、取消 | 拉取审批详情、提交批准/拒绝、待审批列表、历史记录 |
| 端点前缀 | `/v1/request_action`、`/v1/actions/:id` | `/api/app/approval`、`/api/app/pending`、`/api/app/history` |

---

## 10. 设备注册 API（预留）

> **状态：草案** — 供后续 Agent A 实现时对照。当前 MVP 不要求设备注册；推送（FCM/APNs）集成时需要此 API。

移动端设备首次启动后注册推送 token，供后端向该设备发推送通知。

### 10.1. POST /api/app/devices

注册或更新设备推送 token。

**Request Body**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `user_id` | string | 是 | 用户 ID |
| `platform` | string | 是 | `ios` \| `android` |
| `push_token` | string | 是 | FCM registration token（Android）或 APNs device token（iOS） |
| `device_name` | string | 否 | 设备名称（如 `iPhone 15 Pro`），便于用户管理 |

**Response — 201 Created**

```json
{
  "device_id": "dev_xxx",
  "user_id": "usr_demo",
  "platform": "ios",
  "registered_at": "2026-02-23T10:00:00Z"
}
```

**幂等：** 同一 `user_id` + `push_token` 组合重复注册，更新 `device_name` 并返回已有 `device_id`。

**Error Responses**

- `400` — 缺少必填字段、platform 非法
- `500` — 内部错误

---

### 10.2. GET /api/app/devices

查询用户已注册的设备列表。

**Request**

| 方式 | 参数 | 必填 | 类型 | 说明 |
|------|------|------|------|------|
| Query | `user_id` | 是 | string | 用户 ID |

**Response — 200 OK**

```json
{
  "devices": [
    {
      "device_id": "dev_xxx",
      "platform": "ios",
      "device_name": "iPhone 15 Pro",
      "registered_at": "2026-02-23T10:00:00Z"
    }
  ],
  "count": 1
}
```

---

### 10.3. DELETE /api/app/devices/:device_id

注销设备（用户退出登录或移除设备时调用）。

**Request**

| 方式 | 参数 | 必填 | 说明 |
|------|------|------|------|
| Path | `device_id` | 是 | 设备 ID |
| Query | `user_id` | 是 | 用户 ID（校验归属） |

**Response — 200 OK**

```json
{
  "ok": true,
  "device_id": "dev_xxx",
  "deleted": true
}
```

**Error Responses**

- `400` — 缺少 user_id
- `403` — device_id 不属于该 user_id
- `404` — device_id 不存在

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
| GET /api/app/approval | §9.1 | App 拉取审批详情 |
| POST /api/app/approval/decision | §9.2 | App 提交批准/拒绝 |
| GET /api/app/pending | §9.3 | App 获取待审批列表 |
| GET /api/app/history | §9.4 | App 获取历史记录（分页） |
| POST /api/app/devices | §10.1 | 注册设备推送 token（草案） |
| GET /api/app/devices | §10.2 | 查询已注册设备（草案） |
| DELETE /api/app/devices/:id | §10.3 | 注销设备（草案） |
