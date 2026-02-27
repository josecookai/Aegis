# OpenClaw Team Pilot Setup

- 适用范围: 团队试点（10人、自批、自有信用卡）
- 最后更新时间: 2026-02-23

## Scope

在现有 `docs/OpenClaw-Setup.md` 基础上，补充团队试点（10 成员）配置模板与 `AEGIS_USER_ID` 管理方式。

## Primary Reference

- 先按 `docs/OpenClaw-Setup.md` 完成 MCP HTTP Server 与 `openclaw-mcp-bridge` 基础接入。
- 本文仅补充团队试点特有配置与排障。

## Assumptions And Defaults

- 所有成员共用同一 Aegis 后端与同一 Agent API Key（试点环境）
- 每个 OpenClaw 实例/机器人上下文绑定一个成员 `AEGIS_USER_ID`
- 支付通道默认使用 `card`

## 10-Person Configuration Template

### Environment Matrix (Example)

| Member | AEGIS_USER_ID | Role | Has Default Card | Notes |
|---|---|---|---|---|
| 1 | `usr_team_admin` | admin | yes | 仅用于查看团队历史；不要用于成员支付演示 |
| 2 | `usr_team_01` | member | yes | demo member |
| 3 | `usr_team_02` | member | yes | demo member |
| 4 | `usr_team_03` | member | yes | demo member |
| 5 | `usr_team_04` | member | yes | demo member |
| 6 | `usr_team_05` | member | yes | demo member |
| 7 | `usr_team_06` | member | yes | demo member |
| 8 | `usr_team_07` | member | yes | demo member |
| 9 | `usr_team_08` | member | yes | demo member |
| 10 | `usr_team_09` | member | yes | demo member |

### MCP Server Per-User Launch (Example)

```bash
AEGIS_API_URL=http://localhost:3000 \
AEGIS_API_KEY=aegis_demo_agent_key \
AEGIS_USER_ID=usr_team_01 \
MCP_HTTP_PORT=8081 \
npm run start:http
```

为不同成员启动多实例时，只变更：

- `AEGIS_USER_ID`
- `MCP_HTTP_PORT`

## Recommended Team Setup Procedure

1. 完成基础接入（见 `docs/OpenClaw-Setup.md`）。
2. 为每位成员确认 `AEGIS_USER_ID` 映射表。
3. 逐个成员检查是否已有默认卡（`/api/app/payment-methods?user_id=...`）。
4. 为每个 OpenClaw 实例配置对应 `AEGIS_USER_ID`。
5. 用 1 美元测试单验证 `aegis_request_payment` + `aegis_get_payment_status`。

## Common Troubleshooting

| Symptom | Likely Cause | Fix |
|---|---|---|
| `NO_DEFAULT_PAYMENT_METHOD` | 成员未配置默认卡 | 用 App/API 添加卡并设置默认后重试 |
| `USER_NOT_IN_TEAM` | `AEGIS_USER_ID` 不在团队/串号 | 校对环境变量与成员映射表 |
| OpenClaw 调到 admin 用户做支付 | 误用 `usr_team_admin` | 使用成员 user_id（如 `usr_team_01`） |
| 工具不可见 | MCP bridge /health 检查失败 | 先 `curl <mcp>/health` 再重启 OpenClaw |
| 状态一直 `awaiting_approval` | 成员未实际审批 | 打开返回的 `approval_url` 完成 self approval |

## Out Of Scope

- 多租户团队隔离策略
- 生产级凭据分发与密钥轮换
