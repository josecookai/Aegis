# AI Agent Usage Guide (Team Pilot)

- 适用范围: 团队试点（10人、自批、自有信用卡）
- 最后更新时间: 2026-02-23

## Purpose

给 AI agent/OpenClaw 提供稳定、可执行的调用规范，降低 prompt 漂移与错误假设。

## In Scope

- 团队试点支付请求创建（card）
- self-approval 引导
- 状态轮询与终态处理
- 常见错误恢复动作

## Out Of Scope

- 管理员代审批
- 多级审批策略
- 生产环境风控策略

## Assumptions And Defaults

- 当前用户是团队成员，且有自己的 `AEGIS_USER_ID`
- 默认支付通道为 `card`
- 默认支付方式偏好为 `card_default`
- 审批策略固定为 `self`

## Preflight Checks (Before Calling Payment)

1. 确认当前会话绑定了正确成员 `AEGIS_USER_ID`（不是管理员账号）。
2. 确认该成员属于团队（否则会触发 `USER_NOT_IN_TEAM`）。
3. 确认该成员已配置至少一张卡，且有默认卡（否则会触发 `NO_DEFAULT_PAYMENT_METHOD`）。
4. 为本次请求生成新的幂等键（不要复用旧任务的 key）。

## Recommended Call Sequence

1. 调用 `aegis_request_payment`（或 `POST /v1/request_action`）。
2. 记录 `action_id`、`approval_url`、初始 `status`。
3. 明确提示用户需要本人完成审批（self approval）。
4. 在用户确认已审批后，开始调用 `aegis_get_payment_status(action_id)` 轮询。
5. 遇到终态后停止轮询，并输出结果与下一步建议。

## Payment Request Payload (REST Example)

```json
{
  "idempotency_key": "agent_task_20260223_001",
  "end_user_id": "usr_team_01",
  "action_type": "payment",
  "details": {
    "amount": "20.00",
    "currency": "USD",
    "recipient_name": "Cursor",
    "description": "Cursor Pro monthly subscription",
    "payment_rail": "card",
    "payment_method_preference": "card_default",
    "recipient_reference": "merchant_api:mcp"
  }
}
```

## What To Do After Receiving approval_url (Self Approval)

1. 向用户展示/发送 `approval_url`。
2. 明确说明“需要你本人（当前成员账号）批准”。
3. 不要声称管理员会处理审批。
4. 若用户无法完成审批，提供取消/稍后重试选项，而不是无限轮询。

## Polling Strategy (aegis_get_payment_status)

## Polling Rhythm

1. 创建后立即读取一次状态（确认 `action_id` 有效）。
2. 用户尚未审批阶段：每 5 秒轮询一次，最多 12 次（约 60 秒）。
3. 进入 `approved` / `executing` 后：每 2-3 秒轮询一次，最多 20 次。
4. 达到终态立即停止轮询。
5. 超时未终态时，向用户报告当前状态并建议稍后继续查询。

## Terminal State Handling

- `succeeded`: 告知支付成功，附 `action_id`
- `failed`: 告知支付失败，建议重试或检查支付方式
- `denied`: 告知用户已拒绝，不自动重试
- `expired`: 告知审批已过期，需重新发起请求
- `canceled`: 告知请求已取消

## Error Handling And Recovery

| Error Code | Meaning | Recovery Action |
|---|---|---|
| `NO_DEFAULT_PAYMENT_METHOD` | 成员无默认卡 | 引导用户先添加卡并设默认，再用新幂等键重试 |
| `USER_NOT_IN_TEAM` | 成员不在团队或配置串号 | 校验 `AEGIS_USER_ID` 映射，切换到正确成员账号 |
| `MISSING_USER_ID` / `INVALID_USER` | App 侧 user_id 无效 | 补齐/更换有效 `user_id` |
| `APPROVAL_NOT_ASSIGNED_TO_USER` | 用错审批用户 | 使用 action 的 `approval_target_user_id` 完成审批 |
| `INVALID_REQUEST` | payload 字段错误 | 对照 API 文档修正字段名/类型/枚举 |

## Do Not Assume (Critical)

1. 不要假设管理员会审批（团队试点是 self-approval）。
2. 不要假设所有成员都有默认卡。
3. 不要假设 `AEGIS_USER_ID` 永远正确（经常会串号）。
4. 不要在收到 `approval_url` 后直接宣称“支付成功”。
5. 不要无限轮询；必须有超时与终态停止条件。
6. 不要复用旧 `Idempotency-Key` 发起新业务意图。

## Minimal Success Response Pattern (Agent To User)

1. 已创建支付请求（含 `action_id`）。
2. 请本人打开审批链接完成批准。
3. 审批完成后我会继续查询状态。
4. 返回终态结果（成功/失败/拒绝/过期）。

## References

- `docs/team-pilot/API.md`
- `docs/OpenClaw-Setup.md`
- `mcp-server/src/tools/requestPayment.ts`
- `mcp-server/src/tools/getPaymentStatus.ts`
