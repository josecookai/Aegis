# Team Pilot E2E Playbook

- 适用范围: 团队试点（10人、自批、自有信用卡）
- 最后更新时间: 2026-02-23

## Purpose

提供手工验收步骤，覆盖成功路径与常见失败路径，验证团队试点闭环可用性。

## Preconditions

- Aegis 后端已启动（`/healthz` 正常）
- 至少 1 名成员（如 `usr_team_01`）已配置默认卡
- OpenClaw/MCP 已配置并绑定该成员 `AEGIS_USER_ID`
- 已知管理员账号（如 `usr_team_admin`）用于只读历史查看

## Success Path: Member Self Approval (Card)

1. 在 OpenClaw 发起支付（或直接调用 `aegis_request_payment`）。
2. 确认返回包含 `action_id`、`status`、`approval_url`。
3. 打开 `approval_url`（或 App 审批页），以同一成员执行 `approve`。
4. 轮询 `aegis_get_payment_status(action_id)`。
5. 验证状态按预期推进：`awaiting_approval` -> `approved` -> `executing` -> `succeeded`（或跳过中间态快速到终态）。
6. 使用管理员 `GET /api/app/admin/history?user_id=usr_team_admin` 确认该 action 出现在团队历史中。

## Failure Path 1: No Default Card

1. 使用一个没有默认卡的成员 `AEGIS_USER_ID`。
2. 发起 `aegis_request_payment`。
3. 预期返回错误 `NO_DEFAULT_PAYMENT_METHOD`。
4. 为该成员添加卡并设默认。
5. 使用新的 `Idempotency-Key` 重试，预期创建成功。

## Failure Path 2: User Not In Team

1. 将 OpenClaw / MCP 的 `AEGIS_USER_ID` 配置成非团队成员。
2. 发起支付请求。
3. 预期返回 `USER_NOT_IN_TEAM`。
4. 改回有效团队成员 ID，重试成功。

## Failure Path 3: Wrong Approver (action_id + user_id)

1. 用成员 A 创建 action。
2. 调用 `POST /api/app/approval/decision`，故意使用成员 B 的 `user_id` 对同一 `action_id` 审批。
3. 预期返回 `APPROVAL_NOT_ASSIGNED_TO_USER`（若该硬化分支已启用）。
4. 改用 action 的 `approval_target_user_id` 再审批。

## Verification Checklist

- `approval_policy` 为 `self`
- `requested_by_user_id == approval_target_user_id == end_user_id`
- 管理员可读团队历史，但不参与审批
- Agent 侧最终能识别终态并给出用户反馈

## References

- `docs/E2E-Verification-Checklist.md`
- `docs/team-pilot/AI_AGENT_USAGE.md`
