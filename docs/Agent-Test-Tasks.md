# Aegis 测试覆盖率任务 — 3 Agent 分工与指令模板

> 协调 Agent 将测试覆盖率任务拆给 3 个 Agent 并行执行。每个 Agent 使用下方对应的「指令模板」整段复制粘贴即可开始工作。

**状态：** 任务已完成（2026-02-23）

---

## 1. 当前测试覆盖概览

| 模块 | 文件 | 当前覆盖 | 状态 |
|------|------|----------|------|
| 集成测试 | `tests/app.test.ts` | 约 25+ 个用例，覆盖 API、审批、webhook、sandbox、dev、capabilities、payment-methods | ✅ |
| 移动端 | `tests/mobile-api.test.ts` | 3+ 个用例（token、biometric、deny、apiError、approvalDecision） | ✅ |
| MCP | `tests/mcp.test.ts` | 6+ 个用例，含 callback_url 可选、recipient_reference | ✅ |
| 单元测试 | `tests/unit/*.test.ts` | stateMachine、crypto、time、schemas、store、aegis、execution、adminAuth、webhookSender、notifications、sandboxFaults、approvalDecision、apiError | ✅ |
| MCP Client | `mcp-server` / `tests` | client 单元测试 | ✅ |
| SDK | `sdk/typescript` 或 `tests` | AegisClient 单元测试 | ✅ |
| 覆盖率 | vitest | 已配置 coverage | ✅ |

---

## 2. 执行顺序与 Peer Review

| 顺序 | Agent | 依赖 | Peer Review |
|------|-------|------|--------------|
| 1 | Agent A | 无 | B 审 A 的 store/aegis 测试 |
| 2 | Agent B | 无（可与 A 并行） | A 审 B 的 adminAuth/webhookSender 测试 |
| 3 | Agent C | A、B 完成后 | C 审 A、B 的测试结构，汇总覆盖率 |

---

## 3. Agent A 指令模板

**复制以下整段，粘贴给 Agent A：**

```
你负责 Aegis 项目的 **Agent A：后端核心服务单元测试与覆盖率**。

## 任务目标
请检查现在的测试覆盖率，确保所有的主要功能和模块都被测试覆盖到。你负责后端核心服务（store、aegis、execution、stateMachine、schemas）的单元测试。

## 必读文档
- [Aegis-Implementation-Todos.md](../Aegis-Implementation-Todos.md) — 功能与 Phase 对照
- [Aegis-API-Spec.md](../Aegis-API-Spec.md) — API 规格
- [Aegis-App-Flow-Spec.md](../Aegis-App-Flow-Spec.md) — 审批状态机与流程

## Todo List（按顺序执行）

| ID | Task | 状态 |
|----|------|------|
| A1 | 在 `vitest.config.ts` 中启用 `@vitest/coverage-v8`，配置 `coverage.reporter: ['text','html']`、`coverage.include: ['src/**/*.ts']`、`coverage.exclude: ['**/*.test.ts','**/types.ts']` | ✅ |
| A2 | 为 `src/stateMachine.ts` 编写单元测试：`canTransition`、`assertTransition`、`isTerminalStatus` 覆盖所有合法/非法状态转换 | ✅ |
| A3 | 为 `src/lib/crypto.ts` 编写单元测试：`sha256`、`hmacSha256Hex`、`randomToken`、`randomId`、`safeJsonParse` | ✅ |
| A4 | 为 `src/lib/time.ts` 编写单元测试（如有 `addMinutesIso`、`nowIso`、`unixTsSeconds` 等） | ✅ |
| A5 | 为 `src/schemas.ts` 编写单元测试：`requestActionSchema` 校验（必填、可选、非法值）、`webhookTestSchema` | ✅ |
| A6 | 为 `src/services/store.ts` 编写单元测试：`getAgentByApiKey`、`getEndUserById`、`isAgentLinkedToUser`、`createAction`、`transitionActionStatus`、`listPaymentMethodsForUser` 等核心方法（可用 `:memory:` DB） | ✅ |
| A7 | 为 `src/services/aegis.ts` 编写单元测试：`authenticateAgent`、`createActionRequest` 的校验逻辑（无链接用户、无支付方式等错误分支） | ✅ |
| A8 | 为 `src/services/execution.ts` 编写单元测试：mock Stripe，覆盖 card/crypto 执行路径、fault 注入 | ✅ |
| A9 | 运行 `npm run test -- --coverage`，确认上述模块覆盖率 ≥ 80%，并修复失败用例 | ✅ |

## Checklist（完成一项勾选一项）

- [x] `vitest.config.ts` 已配置 coverage
- [x] `stateMachine.ts` 单元测试通过
- [x] `lib/crypto.ts` 单元测试通过
- [x] `lib/time.ts` 单元测试通过（如存在）
- [x] `schemas.ts` 单元测试通过
- [x] `store.ts` 核心方法有单元测试
- [x] `aegis.ts` 关键校验逻辑有单元测试
- [x] `execution.ts` 有 mock 单元测试
- [x] `npm run test -- --coverage` 通过，覆盖率报告可生成
- [x] 所有新增测试与现有 `tests/app.test.ts` 不冲突

## 产出
1. 新增测试文件：`tests/unit/stateMachine.test.ts`、`tests/unit/crypto.test.ts`、`tests/unit/schemas.test.ts`、`tests/unit/store.test.ts`、`tests/unit/aegis.test.ts`、`tests/unit/execution.test.ts`（或按项目约定组织）
2. 更新 `vitest.config.ts`
3. 在 `Aegis-Implementation-Todos.md` 或新建 `docs/Test-Coverage-Report.md` 中记录覆盖率结果
```

---

## 4. Agent B 指令模板

**复制以下整段，粘贴给 Agent B：**

```
你负责 Aegis 项目的 **Agent B：API/Web 路由集成测试与 Dev 端点覆盖**。

## 任务目标
请检查现在的测试覆盖率，确保所有的主要功能和模块都被测试覆盖到。你负责 API 路由、Web 路由、Dev 端点的集成测试补充。

## 必读文档
- [Aegis-Implementation-Todos.md](../Aegis-Implementation-Todos.md) — 功能与 Phase 对照
- [Aegis-API-Spec.md](../Aegis-API-Spec.md) — API 规格
- [OpenClaw-REST-API.md](OpenClaw-REST-API.md) — REST 端点速查

## Todo List（按顺序执行）

| ID | Task | 状态 |
|----|------|------|
| B1 | 在 `tests/app.test.ts` 中补充 `GET /v1/payment_methods/capabilities?end_user_id=xxx` 的测试：返回 `rails`、`methods`，无支付方式时返回空或错误 | ✅ |
| B2 | 补充 `POST /api/dev/payment-methods` 的测试：添加卡、关联 user_id、Stripe 未配置时的行为 | ✅ |
| B3 | 补充 `GET /api/dev/payment-methods`、`DELETE /api/dev/payment-methods/:id`、`POST /api/dev/payment-methods/:id/default` 的测试 | ✅ |
| B4 | 补充 `/dev/add-card` 页面的测试：需 admin 登录、页面渲染、Stripe Elements 占位（若可测） | ✅ |
| B5 | 补充 `adminAuth.ts` 单元测试：`validateSession`、`createSession`、无效 token 拒绝 | ✅ |
| B6 | 补充 `webhookSender.ts` 单元测试：mock fetch，验证签名头、payload 格式、重试逻辑（如有） | ✅ |
| B7 | 补充 `notifications.ts` 单元测试：`sendApprovalEmail` 的入参校验、outbox 写入 | ✅ |
| B8 | 补充 `sandboxFaults.ts` 单元测试：preset 解析、fault 模式切换 | ✅ |
| B9 | 运行 `npm run test`，确保 `tests/app.test.ts`、`tests/mobile-api.test.ts` 全部通过 | ✅ |

## Checklist（完成一项勾选一项）

- [x] `GET /v1/payment_methods/capabilities` 有测试
- [x] `POST/GET/DELETE /api/dev/payment-methods` 有测试
- [x] `POST /api/dev/payment-methods/:id/default` 有测试
- [x] `/dev/add-card` 路由有测试（至少鉴权与渲染）
- [x] `adminAuth.ts` 有单元测试
- [x] `webhookSender.ts` 有单元测试
- [x] `notifications.ts` 有单元测试
- [x] `sandboxFaults.ts` 有单元测试
- [x] 所有现有测试仍通过
- [x] 无新增 lint 错误

## 产出
1. 更新 `tests/app.test.ts` 或新建 `tests/api-dev.test.ts`
2. 新建 `tests/unit/adminAuth.test.ts`、`tests/unit/webhookSender.test.ts`、`tests/unit/notifications.test.ts`、`tests/unit/sandboxFaults.test.ts`
3. 在 `Aegis-Implementation-Todos.md` 的 §6 或新建文档中记录新增测试用例列表
```

---

## 5. Agent C 指令模板

**复制以下整段，粘贴给 Agent C：**

```
你负责 Aegis 项目的 **Agent C：Mobile、MCP、SDK 测试与覆盖率审计**。

## 任务目标
请检查现在的测试覆盖率，确保所有的主要功能和模块都被测试覆盖到。你负责移动端逻辑、MCP client、SDK 的测试，以及整体覆盖率审计与报告。

## 必读文档
- [Aegis-Implementation-Todos.md](../Aegis-Implementation-Todos.md) — 功能与 Phase 对照
- [mcp-server/README.md](../mcp-server/README.md) — MCP 架构
- [mcp-server/SKILL.md](../mcp-server/SKILL.md) — MCP 工具定义

## Todo List（按顺序执行）

| ID | Task | 状态 |
|----|------|------|
| C1 | 为 `src/mobile/approvalDecision.ts` 编写单元测试：`requiresBiometricForApprove`、`determineDenyDecisionSource` 等分支 | ✅ |
| C2 | 为 `src/mobile/apiError.ts` 编写单元测试：错误码解析、用户可读消息 | ✅ |
| C3 | 为 `mcp-server/src/client.ts` 编写单元测试：mock fetch，覆盖 `capabilities`、`requestPayment`、`getStatus`、`cancel` 的成功与错误响应 | ✅ |
| C4 | 为 `sdk/typescript/src/index.ts` 编写单元测试：`AegisClient` 的 `requestPayment`、`getStatus`、`cancel`、webhook 签名校验（mock fetch） | ✅ |
| C5 | 补充 `tests/mobile-api.test.ts`：覆盖 `apiError` 的更多错误码、`approvalDecision` 的边界情况 | ✅ |
| C6 | 补充 `tests/mcp.test.ts`：`callback_url` 可选时的请求、`recipient_reference` 缺失时的行为 | ✅ |
| C7 | 运行 `npm run test -- --coverage`，生成覆盖率报告，识别仍低于 80% 的模块 | ✅ |
| C8 | 编写 `docs/Test-Coverage-Report.md`：列出各模块覆盖率、缺口、建议 | ✅ |

## Checklist（完成一项勾选一项）

- [x] `approvalDecision.ts` 有单元测试
- [x] `apiError.ts` 有单元测试
- [x] `mcp-server/src/client.ts` 有单元测试
- [x] `sdk/typescript` 有单元测试
- [x] `tests/mobile-api.test.ts` 用例扩充
- [x] `tests/mcp.test.ts` 用例扩充
- [x] `npm run test -- --coverage` 通过
- [x] `docs/Test-Coverage-Report.md` 已创建并记录覆盖率
- [x] 所有测试与 Agent A、B 的改动兼容

## 产出
1. 新建 `tests/unit/approvalDecision.test.ts`、`tests/unit/apiError.test.ts`
2. 新建 `mcp-server/tests/client.test.ts` 或 `tests/mcp-client.test.ts`
3. 新建 `sdk/typescript/tests/index.test.ts` 或 `tests/sdk.test.ts`
4. 更新 `tests/mobile-api.test.ts`、`tests/mcp.test.ts`
5. 新建 `docs/Test-Coverage-Report.md`
```

---

## 6. 各 Agent 指令模板文件

为便于复制粘贴，每个 Agent 的指令已单独成文件：

- [Agent A 指令模板](agents/Agent-A-指令模板.md)
- [Agent B 指令模板](agents/Agent-B-指令模板.md)
- [Agent C 指令模板](agents/Agent-C-指令模板.md)

---

## 7. 相关文档

- [Aegis-Implementation-Todos.md](../Aegis-Implementation-Todos.md) — 主实施清单
- [E2E-Verification-Checklist.md](E2E-Verification-Checklist.md) — E2E 验收
- [DEPLOYMENT.md](DEPLOYMENT.md) — 部署指南
