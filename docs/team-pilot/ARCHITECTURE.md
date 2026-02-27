# Team Pilot Architecture

- 适用范围: 团队试点（10人、自批、自有信用卡）
- 最后更新时间: 2026-02-23

## System Components

- Agent / OpenClaw: 发起支付请求并轮询状态
- Aegis Agent API (`/v1/*`): 接收请求、创建 action、返回审批链接
- Aegis App API (`/api/app/*`): 成员管理卡、查看历史、提交审批决策
- Approval Surface (App/Web): 成员执行 self-approval
- Execution Engine: 在批准后执行支付（MVP 可为 mock/Stripe）
- Callback/Webhook: 将状态变化回传给 agent 系统（如已配置）

## Data Flow (Team Pilot)

1. Agent 调用 `POST /v1/request_action`（指定 `end_user_id`）。
2. Aegis 校验 agent-user 绑定、团队成员资格、默认支付方式。
3. Aegis 创建 `action`，状态进入 `awaiting_approval`，返回 `action` 与 `approval_url`。
4. 成员（同一 `end_user_id`）在 App/Web 审批页执行批准或拒绝。
5. Aegis 更新状态为 `approved` 或 `denied`。
6. 若 `approved`，Execution Engine 执行支付，状态进入 `executing` 后到 `succeeded`/`failed`。
7. Agent 通过 `GET /v1/actions/:id` / MCP `aegis_get_payment_status` 轮询终态；可选接收 callback/webhook。

## Role Model

### Roles

- `member`: 可管理自己的支付方式、审批自己的请求、查看自己的历史
- `admin`: 在团队试点中仅增加“只读查看团队历史”能力（`/api/app/admin/history`）

### Role Constraints

- `admin` 不替他人审批（本试点明确 out of scope）
- `member` 不能读取团队历史（会被拒绝）
- 团队外用户不能发起团队试点支付（`USER_NOT_IN_TEAM`）

## Self Approval Rules

## Rule Summary

- `approval_policy = "self"`
- `requested_by_user_id = end_user_id`
- `approval_target_user_id = end_user_id`
- 团队试点不依赖管理员审批

## Practical Implications

1. Agent 必须使用正确的成员 `end_user_id` / `AEGIS_USER_ID`。
2. 审批动作必须由该成员本人（同一 user_id）完成。
3. Agent 收到 `approval_url` 后，应引导该成员审批，而不是等待管理员。

## Action Fields Relevant To Team Pilot

团队试点 action 响应（`/v1/request_action`、`/v1/actions/:id`）包含以下关键字段：

- `team_id`
- `requested_by_user_id`
- `approval_target_user_id`
- `approval_policy`（试点固定为 `self`）

## State Model (Operational)

常见状态流：

1. `received`
2. `awaiting_approval`
3. `approved` 或 `denied` / `expired` / `canceled`
4. （若批准）`executing`
5. `succeeded` 或 `failed`

完整状态机参考 `Aegis-App-Flow-Spec.md` 与 `src/stateMachine.ts`。
