---
doc_type: plan
version: "1.0"
status: draft
last_updated: "2026-02-23"
author: "Manus AI"
tags:
  - dev-plan
  - 24h
  - sprint
related_docs:
  - Aegis-Implementation-Todos.md
  - Aegis-API-Spec.md
  - Aegis-App-Flow-Spec.md
quick_ref: |
  24 小时内可完成的开发计划：Phase 1 收口、MVP 与 Spec 对齐（幂等 Header、GET 别名）、API Spec 文档补充、验收与提交。
---

# Aegis: 24 小时开发计划

**时间范围：** 从当前起 24 小时内  
**目标：** 收口 Phase 1、完成 MVP 与 Spec 关键对齐、更新文档与清单，便于后续 Phase 2/3 或对外交付。

---

## 总览

| 时段 | 主题 | 产出 |
|------|------|------|
| 0～4h | Phase 1 收口 + 幂等 Header | P1-1～P1-3 勾选；支持 `Idempotency-Key` Header |
| 4～8h | GET 别名 + 响应兼容 Spec | `GET /v1/requests/:request_id`；可选 `request_id` 响应字段 |
| 8～12h | API Spec 与 OpenAPI 更新 | Spec 补充 MVP 端点；openapi.yaml 与实现一致 |
| 12～16h | Webhook 签名与文档 | 回调增加 `X-Aegis-Signature`；Spec §3.2 与实现说明一致 |
| 16～20h | 测试与回归 | 单测/集成测试覆盖变更；README 快速验证步骤 |
| 20～24h | 清单更新与提交 | Implementation Todos §5 对齐状态更新；git 提交与 tag |

---

## 0～4 小时：Phase 1 收口 + 幂等 Header

### 任务

1. **Implementation Todos 更新**
   - 将 P1-1、P1-2、P1-3 标为 ✅，备注「MVP 已实现；Spec 对齐见 §5 及本 24h 计划」。
   - 在 [Aegis-Implementation-Todos.md](Aegis-Implementation-Todos.md) §4 将 Phase 1 已完成改为 3，进度 100%（若本次只做「收口」不写代码，可先标 P1-1 为「已实现」，P1-2/P1-3 待下面时段做完再勾）。

2. **支持 `Idempotency-Key` Header**
   - 在 `POST /v1/request_action` 中：若请求头存在 `Idempotency-Key`，则优先使用其值作为幂等键；若不存在，再使用 body 中的 `idempotency_key`（保持兼容）。
   - 修改位置建议：`src/routes/api.ts` 或 `src/schemas.ts` 解析 header；`src/services/aegis.ts` 的 `createActionRequest` 入参支持从 header 传入的 key。
   - 验收：同一 `Idempotency-Key`（Header）两次 POST 返回同一 `action_id`，且只发一封邮件/只创建一条 action。

### 验收标准

- [ ] P1-1～P1-3 在 Todos 中已勾选或备注明确。
- [ ] `Idempotency-Key` Header 生效且与 body `idempotency_key` 兼容。
- [ ] `npm test` 通过。

---

## 4～8 小时：GET 别名 + 响应兼容 Spec

### 任务

1. **新增 `GET /v1/requests/:request_id`**
   - 行为与现有 `GET /v1/actions/:actionId` 一致（同一套业务逻辑，仅路由与参数名不同）。
   - 实现：在 `src/routes/api.ts` 增加 `router.get('/v1/requests/:request_id', ...)`，内部调用同一 service 方法，传入 `request_id`（即 action id）。
   - 鉴权：与现有 `/v1/actions/:actionId` 相同（同一 middleware）。

2. **创建请求响应兼容 Spec（可选）**
   - 在 201 响应中增加顶层字段 `request_id`（值与 `action.action_id` 相同），便于按 Spec 的 `request_id` 称呼使用。
   - 保留现有 `action`、`links` 结构，不破坏现有 SDK/示例。

### 验收标准

- [ ] `GET /v1/requests/:id` 与 `GET /v1/actions/:id` 返回同一 action 数据。
- [ ] `POST /v1/request_action` 的 201 响应中包含 `request_id`（与 `action.action_id` 一致）。
- [ ] 现有 `GET /v1/actions/:actionId` 行为不变；`npm test` 通过。

---

## 8～12 小时：API Spec 与 OpenAPI 更新

### 任务

1. **Aegis-API-Spec.md 补充**
   - 在「核心端点」或「附录」中补充 MVP 已有端点：
     - `GET /v1/requests/{request_id}`（与 `GET /v1/actions/:id` 等价，注明 alias）。
     - `POST /v1/actions/:actionId/cancel`（取消请求）。
     - `GET /v1/payment_methods/capabilities`（能力查询，参数 `end_user_id`）。
     - `POST /v1/webhooks/test`（测试 Webhook 投递）。
   - 注明：`request_id` 与 `action_id` 同义；创建请求时返回的 `request_id` 即后续查询/取消用的 id。

2. **openapi.yaml 更新**
   - 若仓库已有 `openapi.yaml`：更新路径、参数、请求/响应示例，使其与当前实现一致（含 `Idempotency-Key`、`request_id`、上述端点）。
   - 若没有：新增最小可用 `openapi.yaml`，至少覆盖 `POST /v1/request_action`、`GET /v1/requests/{request_id}`、`GET /v1/actions/{actionId}`，便于生成客户端或做契约测试。

### 验收标准

- [ ] API Spec 文档中可查上述端点及说明。
- [ ] openapi.yaml 与当前 API 行为一致（或注明「MVP 扩展」与 Spec 的差异）。
- [ ] 用 curl 或 Postman 按文档能复现请求与响应。

---

## 12～16 小时：Webhook 签名与文档

### 任务

1. **回调请求增加 `X-Aegis-Signature`**
   - 在 Webhook 发送处（如 `src/services/webhookSender.ts` 或调用处）：对 payload 做 HMAC-SHA256（使用 agent 的 `webhook_secret`），格式按 Spec 建议：`X-Aegis-Signature: t=<timestamp>,v1=<signature>`（timestamp 为当前 Unix 秒）。
   - Agent 端校验方式在 API Spec §3.2 中说明（校验时间戳防重放、校验 signature）。

2. **Aegis-API-Spec.md §3.2 与实现一致**
   - 写明 Header 名称、payload 编码方式（如 JSON 字符串）、签名算法与示例（伪代码或公式）。
   - 注明：MVP 使用现有 `webhook_secret`；生产环境需妥善分发与轮换。

### 验收标准

- [ ] 每次 Webhook 请求带 `X-Aegis-Signature`；用已知 secret 本地验签通过。
- [ ] API Spec 中 §3.2 描述与实现一致，便于接入方实现验签。

---

## 16～20 小时：测试与回归

### 任务

1. **单元/集成测试**
   - 为新增逻辑加测试：Idempotency-Key Header 幂等、`GET /v1/requests/:id` 与 actions 一致、Webhook 签名存在且格式正确。
   - 跑通现有测试：`npm test`。

2. **README 快速验证**
   - 在 README 的「快速开始」或「API 快速参考」中增加 1～2 条 curl 示例：使用 `Idempotency-Key` Header 创建请求、使用 `GET /v1/requests/:id` 查询（可选）。
   - 确保「创建请求 → 打开 approval_url → 审批 → 查看 callback」全流程在本地可一键复现（文档中已有则仅做检查）。

### 验收标准

- [ ] `npm test` 全部通过。
- [ ] 按 README 步骤可在 5 分钟内完成一次完整审批与回调验证。

---

## 20～24 小时：清单更新与提交

### 任务

1. **Implementation Todos §5 更新**
   - 在 [Aegis-Implementation-Todos.md](Aegis-Implementation-Todos.md) §5.1～5.3 中，将已完成的对齐项从 ⚠️ 改为 ✅，并简短注明（如「已支持 Idempotency-Key Header」「已提供 GET /v1/requests/:id」「Webhook 已带 X-Aegis-Signature」）。

2. **版本与提交**
   - 在 package.json 或文档中 bump 版本号（如 0.2.0 或保持 0.1.x，视你习惯而定）。
   - `git add`、`git commit`（建议 message 含「Phase 1 收口；Spec 对齐：Idempotency-Key, GET /v1/requests, Webhook signature」）。
   - 可选：`git tag v0.2.0`（或相应版本），便于后续对比与发布。

3. **本计划文档**
   - 将本文档开头 `status` 改为 `stable`，或在文末增加「执行记录」：完成项打勾、未完成项注明原因与后续安排。

### 验收标准

- [ ] §5 对齐表中已实现项已标为 ✅。
- [ ] 代码已提交；如需可打 tag。
- [ ] 24h 计划文档已更新（状态或执行记录）。

---

## 风险与缓冲

- **若 8h 内无法完成 GET 别名与响应兼容**：优先保证幂等 Header 与 Phase 1 收口，GET 别名可放到「下一轮 24h」。
- **若 OpenAPI 工作量大**：可只更新 API Spec 文档，openapi.yaml 仅做最小集或延后。
- **若 Webhook 签名涉及多处调用**：先在一个统一发送点加签名，再逐步替换其他调用。

---

## 执行记录（完成后填写）

| 时段 | 计划项 | 完成情况 | 备注 |
|------|--------|----------|------|
| 0～4h | Phase 1 收口 + 幂等 Header | ⬜ | |
| 4～8h | GET 别名 + 响应 request_id | ⬜ | |
| 8～12h | API Spec + OpenAPI | ⬜ | |
| 12～16h | Webhook 签名 + 文档 | ⬜ | |
| 16～20h | 测试与回归 | ⬜ | |
| 20～24h | 清单更新与提交 | ⬜ | |

**完成日期：** _____________  
**未完成项（后续计划）：** _____________
