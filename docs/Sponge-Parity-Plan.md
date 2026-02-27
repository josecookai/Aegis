# Sponge Wallet 功能对齐开发计划（Aegis）

Last updated: 2026-02-27
Owner: Coordination
Status: In Progress

## 1. 目标定义

目标：让 Aegis 在核心钱包能力上与 Sponge Wallet 达到同等级可用性，优先覆盖“可支付、可管控、可审计、可集成”四条主线。

范围说明：

- In scope：账户、支付方式、交易执行、审批策略、控制面、审计、OpenAPI、E2E
- Out of scope（当前阶段）：复杂投资/理财能力、跨产品增长运营工具

## 2. 对标维度

采用以下 8 个维度做 parity：

1. 账户与身份
2. 资产与支付方式管理
3. 交易发起与执行
4. 审批与风控控制
5. 交易历史与可观测性
6. 管理控制面（Admin Control Plane）
7. 开发者集成（API/OpenAPI/MCP）
8. 发布与自动化（CI/CD/Issue→PR→Merge）

## 3. Gap Matrix（Aegis vs Sponge）

> 状态定义：
> - ✅ 已有
> - 🟡 部分支持
> - ❌ 缺失
> - ⛔ 本阶段不做

| 能力 | Sponge 目标能力 | Aegis 当前 | Gap | 优先级 |
|------|------------------|------------|-----|--------|
| 账户体系 | 完整 end-user 登录会话 | 🟡 已有 auth + app session | 需统一权限边界，减少 query user_id 回退路径 | P0 |
| 支付方式管理 | 成员独立支付方式（卡/链） | 🟡 卡管理已具备，链上管理弱 | 补链上资产/地址管理与统一 UX | P1 |
| 交易发起 | 稳定请求入口 + 幂等 | ✅ `/v1/request_action` | 补更完整 pre-check 与策略返回 | P0 |
| 交易执行 | 真执行 + 错误恢复 | 🟡 Stripe + mock | 补真实链上执行与重试策略 | P1 |
| 审批策略 | self/admin/分级 | 🟡 self + 部分 admin 只读 | 补分级策略与策略引擎配置化 | P1 |
| 风控能力 | 限额/频率/allowlist | ❌ 文档有，执行弱 | 落地规则执行与拒绝原因标准化 | P0 |
| 历史与审计 | 可追踪可筛选 | 🟡 已有审计与历史 | 补团队维度筛选与报表导出 | P1 |
| 管理控制面 | key/limits/rotation 实操 | 🟡 文档已建 | 落地接口与最小 UI | P0 |
| 开发者集成 | OpenAPI 完整映射 | 🟡 已覆盖核心 | 补 admin/control 全映射与示例 | P0 |
| 自动化发布 | issue→PR→merge + CI/CD | 🟡 已新增 workflows | 需实测仓库权限与分支保护配置 | P0 |

## 4. 分阶段执行计划

## Phase 1（P0，1-2 天）

目标：把“上线阻塞项”补齐。

- 统一 app auth 边界（优先 session，限制 query user_id 回退）
- 落地风控最小策略：
  - 单笔金额上限
  - 日累计上限
  - recipient allowlist（可选开关）
- admin control plane 最小接口：
  - key 状态（active/disabled）
  - per-key 限流策略读取
  - allowlist 读取与更新
- OpenAPI/admin-control 映射补齐并与实现一致
- 验证 issue→PR→automerge 自动化可用

完成标准（DoD）：

- `npm run build` + `vitest` 全通过
- 关键 E2E（请求→审批→执行→历史）通过
- admin/control 最小操作可用且有审计

## Phase 2（P1，2-4 天）

目标：补“交易与钱包体验差距”。

- 交易 pre-check API（返回可执行性与阻塞原因）
- 统一交易状态机对外字段
- 链上执行通道最小可用
- 成员端钱包体验完善（资产/历史/失败恢复）

## Phase 3（P1+，后续）

目标：策略化、规模化。

- 分级审批策略（金额阈值）
- 团队多角色策略（admin/operator/auditor）
- 报表导出与高级审计查询

## 5. 3 个 Agent 并行分工（当前轮）

## Agent A（后端内核）

- 实现风控策略执行（限额/频率/allowlist）
- 补 admin/control 服务层与错误码标准化
- 补单元与集成测试

交付文件重点：`src/services/*`, `src/routes/app.ts|api.ts`, `tests/*`

## Agent B（前端与用户流）

- 支付方式与交易历史页面统一到 session 模式
- pre-check 结果与失败恢复 UI
- 操作态、错误态一致性

交付文件重点：`src/views.ts`, `src/routes/web.ts`, `app/*`（如涉及）

## Agent C（平台与文档）

- OpenAPI 与实现对齐（admin/control）
- GitHub automation 落地验证与文档
- E2E 运行手册更新

交付文件重点：`docs/openapi.yaml`, `docs/*.md`, `.github/workflows/*`

## 6. 测试策略

## Unit Tests（必须）

- 风控规则服务：阈值、allowlist、拒绝原因
- 审批权限判断：self/admin/非目标用户
- 状态机转换合法性

## Integration Tests（必须）

- `/v1/request_action` + 风控拦截
- `/api/app/approval/decision` 权限边界
- `/api/app/admin/history` 管理员可见性

## E2E（发布前）

- 成功路径：发起 -> 审批 -> 执行成功 -> 历史可见
- 失败路径：无支付方式 / 超限 / 非目标审批
- 自动化路径：issue->auto-pr->automerge 演练

## 7. 今日启动清单（立即执行）

- [ ] A: 提交 P0 风控与 admin/control 接口设计草案
- [ ] B: 提交 session 优先 UI 改造清单
- [ ] C: 提交 OpenAPI 与 workflow 实测清单
- [ ] 协调: 合并顺序与每日回归基线锁定

