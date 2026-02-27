# Team Pilot API Reference

- 适用范围: 团队试点（10人、自批、自有信用卡）
- 最后更新时间: 2026-02-23

## Scope

本文只覆盖团队试点最关键接口与 AI/新同事最常用调用路径。

## Out Of Scope

- 完整通用 API 规格（见 `Aegis-API-Spec.md`）
- Web UI HTML 页面接口细节

## Assumptions And Defaults

- `payment_rail = "card"`
- `payment_method_preference = "card_default"`
- `approval_policy = "self"`
- App API 通过 `user_id` 参数做 MVP 校验（不是生产级认证）

## API 1: POST /v1/request_action

### Purpose

Agent 发起支付审批请求（团队试点主入口）。

### Required Headers

```http
X-Aegis-API-Key: <api_key>
Content-Type: application/json
Idempotency-Key: <unique_key>   # 推荐
```

### Request Example (JSON)

```json
{
  "idempotency_key": "mcp_1700000000000_abcd",
  "end_user_id": "usr_team_01",
  "action_type": "payment",
  "callback_url": "https://agent.example.com/aegis/callback",
  "details": {
    "amount": "20.00",
    "currency": "USD",
    "recipient_name": "Cursor",
    "description": "Cursor Pro subscription",
    "payment_rail": "card",
    "payment_method_preference": "card_default",
    "recipient_reference": "merchant_api:mcp"
  }
}
```

### curl Example

```bash
curl -X POST http://localhost:3000/v1/request_action \
  -H 'X-Aegis-API-Key: aegis_demo_agent_key' \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: demo_team_01_001' \
  -d '{
    "idempotency_key": "demo_team_01_001",
    "end_user_id": "usr_team_01",
    "action_type": "payment",
    "callback_url": "https://agent.example.com/aegis/callback",
    "details": {
      "amount": "20.00",
      "currency": "USD",
      "recipient_name": "Cursor",
      "description": "Cursor Pro subscription",
      "payment_rail": "card",
      "payment_method_preference": "card_default",
      "recipient_reference": "merchant_api:mcp"
    }
  }'
```

### Success Response (201)

```json
{
  "action": {
    "action_id": "act_123",
    "status": "awaiting_approval",
    "action_type": "payment",
    "end_user_id": "usr_team_01",
    "team_id": "team_demo_01",
    "approval_policy": "self",
    "requested_by_user_id": "usr_team_01",
    "approval_target_user_id": "usr_team_01"
  },
  "links": {
    "approval_url": "http://localhost:3000/approve?token=..."
  }
}
```

## API 2: GET /v1/actions/:actionId (or /v1/requests/:id)

### Purpose

查询支付请求状态（Agent 轮询主接口）。

### curl Example

```bash
curl -X GET http://localhost:3000/v1/actions/act_123 \
  -H 'X-Aegis-API-Key: aegis_demo_agent_key'
```

### Terminal Statuses (Team Pilot Focus)

- `succeeded`
- `failed`
- `denied`
- `expired`
- `canceled`

### Non-Terminal Statuses

- `awaiting_approval`
- `approved`
- `executing`

## API 3: /api/app/payment-methods*

### Purpose

成员管理自己的信用卡（团队试点 prerequisite）。

### Endpoints

1. `POST /api/app/payment-methods` - 添加卡（body: `user_id`, `payment_method_id`）
2. `GET /api/app/payment-methods` - 列表（query: `user_id`）
3. `POST /api/app/payment-methods/:id/default` - 设默认卡（query/body: `user_id`）
4. `DELETE /api/app/payment-methods/:id` - 删除卡（query: `user_id`）

### List Response Example

```json
{
  "payment_methods": [
    {
      "payment_method_id": "pm_local_001",
      "alias": "Visa **** 4242",
      "brand": "visa",
      "last4": "4242",
      "exp_month": 1,
      "exp_year": 2030,
      "is_default": true,
      "created_at": "2026-02-23T10:00:00.000Z"
    }
  ]
}
```

## API 4: GET /api/app/admin/history

### Purpose

管理员只读查看团队 action 历史（用于运维/排错，不用于审批）。

### Query Params

- `user_id` (required): 管理员 user id
- `limit` (optional, default 50, max 200)
- `offset` (optional, default 0)

### curl Example

```bash
curl 'http://localhost:3000/api/app/admin/history?user_id=usr_team_admin&limit=50&offset=0'
```

## API 5: POST /api/app/approval/decision (Self Approval)

### Purpose

成员在 App/Web 中提交 approve/deny（可使用 `token` 或 `action_id+user_id`）。

### action_id + user_id Example

```json
{
  "action_id": "act_123",
  "user_id": "usr_team_01",
  "decision": "approve",
  "decision_source": "app_biometric"
}
```

### Success Response

```json
{
  "ok": true,
  "action_id": "act_123",
  "request_id": "act_123",
  "status": "approved"
}
```

## Error Codes (Team Pilot)

| Code | HTTP | Where | Meaning | Typical Recovery |
|---|---:|---|---|---|
| `NO_DEFAULT_PAYMENT_METHOD` | 400 | `POST /v1/request_action` | 成员没有默认卡 | 引导成员先添加卡并设为默认后重试 |
| `USER_NOT_IN_TEAM` | 403/404 | `POST /v1/request_action` | 用户不在团队或团队关系无效 | 检查 `end_user_id`/`AEGIS_USER_ID` 是否串号 |
| `MISSING_USER_ID` | 400 | App APIs | 缺少 `user_id` | 补齐 query/body `user_id` |
| `INVALID_USER` | 403 | App APIs | 用户不存在或已停用 | 使用有效成员 ID |
| `ADMIN_AUTH_REQUIRED` | 403 | `/api/app/admin/history` | 非管理员访问团队历史 | 改用管理员 user_id，或使用成员自己的历史接口 |
| `PAYMENT_METHOD_NOT_FOUND` | 404 | payment-method APIs | 卡不存在或不属于该用户 | 刷新列表后重试，避免跨用户操作 |
| `APPROVAL_NOT_ASSIGNED_TO_USER` | 403 | approval API | 该 action 不属于该成员审批 | 使用 action 的 `approval_target_user_id` 执行审批 |
| `INVALID_DECISION` | 400 | approval API | 决策值非法 | 使用 `approve` 或 `deny` |
| `INVALID_REQUEST` | 400 | Multiple | 请求体字段不符合 schema | 对照示例 payload 修正字段类型/枚举 |

## Related References

- `Aegis-API-Spec.md`
- `docs/Team-Pilot-Contracts.md`
- `docs/openapi.yaml`
