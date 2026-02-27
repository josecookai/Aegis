# Admin Control Plane

Last updated: 2026-02-27

## 范围

本文件定义 Aegis 管理面控制基线：

- 管理员访问控制
- API key 管理（生成、限制、轮换）
- allowlist 与速率限制策略
- 运维执行与审计最小要求

## 1. 管理入口

当前主要入口：

- Web: `/admin`、`/admin/team-history`、`/dev/*`
- API: `/api/dev/*`、`/api/app/admin/history`

注意：`/api/app/admin/history` 是团队只读历史接口，必须限制在管理员上下文可用。

## 2. Key 管理基线

### 2.1 生成与归属

- 每个 Agent 使用独立 API key。
- key 必须绑定 owner（user/team/service），禁止共享同一 key 跨环境。
- key 只显示一次（创建时）；存储哈希，不存明文。

### 2.2 最小权限

- 生产 key 默认仅开放必要端点（优先 `/v1/*`）。
- 管理/调试端点（`/api/dev/*`）禁止对普通 key 开放。

### 2.3 轮换（Rotation）

推荐 30-90 天轮换一次，或在下列事件立即轮换：

- 泄漏怀疑
- 人员离职/权限变更
- 环境迁移（staging -> prod）

轮换流程：

1. 创建新 key 并灰度验证
2. 双 key 并行短窗口
3. 下线旧 key
4. 审计确认调用已切换

## 3. 限流（Limits）

建议最小限流策略（按 key 维度）：

- `POST /v1/request_action`: 60 req/min
- `GET /v1/actions/*`: 300 req/min
- `POST /v1/webhooks/test`: 10 req/min

管理端点建议更严格：

- `/api/dev/*`: 10-30 req/min + 必须管理员会话

## 4. Allowlist

建议两层 allowlist：

1. 出站回调 allowlist（callback_url）
2. 管理入口来源 allowlist（CIDR/IP）

最小规则：

- 生产回调仅允许 HTTPS。
- 禁止回调到内网/metadata 地址（如 `169.254.169.254`）。
- `/api/dev/*` 默认仅内网/VPN 可访问。

## 5. 审计与追踪

每个管理动作最少记录：

- actor（谁操作）
- action（做了什么）
- target（作用对象）
- timestamp
- request_id / action_id

对以下动作开启高优先级审计：

- key 创建/禁用/轮换
- admin 会话登录失败
- sandbox fault 注入
- webhook replay/requeue

## 6. 运行检查清单（上线前）

- [ ] 管理路由全部需要 admin session
- [ ] `/api/dev/*` 未暴露给公开客户端
- [ ] callback_url 校验与 allowlist 生效
- [ ] key 轮换流程有文档且可演练
- [ ] 关键管理动作可在审计日志检索

## 7. 与 OpenAPI/规格对齐

- 对外 Agent API：`docs/openapi.yaml` 中 `/v1/*`
- 管理/控制端点：`docs/openapi.yaml` 中 `admin-control` tags
- 规格映射：`Aegis-API-Spec.md` -> “OpenAPI Admin/Control 映射”
