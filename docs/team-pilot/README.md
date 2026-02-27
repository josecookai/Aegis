# Team Pilot Documentation

- 适用范围: 团队试点（10人、自批、自有信用卡）
- 最后更新时间: 2026-02-23

## Purpose

为团队试点提供结构化、可索引、AI-friendly 的文档入口，覆盖角色模型、流程、接口、错误码、OpenClaw 配置与 E2E 验收。

## In Scope

- 团队试点角色与 self-approval 规则
- Agent/API/App 关键接口与错误码
- OpenClaw 团队配置模板（10 人）
- 手工 E2E 验收步骤
- AI agent 调用规范（顺序、轮询、恢复策略）

## Out Of Scope

- 生产级身份认证/权限系统设计（当前 app API 仍为 MVP）
- 非团队试点的多级审批策略
- 真实财务/风控/对账流程

## Assumptions And Defaults

- 单团队试点，约 10 名成员
- 每个成员使用自己的信用卡（`card` rail）
- 审批策略固定为 `self`（成员自己批准自己的请求）
- 管理员仅查看团队历史，不参与审批
- Agent 通过 REST 或 MCP（OpenClaw）调用 Aegis

## Recommended Reading Order

1. `ARCHITECTURE.md`
2. `API.md`
3. `AI_AGENT_USAGE.md`
4. `OPENCLAW_TEAM_SETUP.md`
5. `E2E_PLAYBOOK.md`

## Document Index

- `docs/team-pilot/ARCHITECTURE.md` - 团队试点组件、数据流、角色模型、self-approval 规则
- `docs/team-pilot/API.md` - 关键 API、请求响应示例、错误码表
- `docs/team-pilot/OPENCLAW_TEAM_SETUP.md` - OpenClaw 团队试点配置模板与排障
- `docs/team-pilot/E2E_PLAYBOOK.md` - 成功/失败路径手工验收步骤
- `docs/team-pilot/AI_AGENT_USAGE.md` - 给 AI agent 的调用规范与反模式

## Canonical References

- `docs/Team-Pilot-Contracts.md`（团队试点契约摘要）
- `docs/OpenClaw-Setup.md`（OpenClaw 接入细节）
- `Aegis-API-Spec.md`（通用 API 规格）
- `Aegis-App-Flow-Spec.md`（流程状态机与时序）
