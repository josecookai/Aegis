# Aegis 测试覆盖率报告

> 基于 `npm run test -- --coverage` 生成，最后更新：2026-02-23

---

## 1. 概述

| 指标 | 值 |
|------|-----|
| 语句覆盖率 | 68.87% |
| 分支覆盖率 | 57.31% |
| 函数覆盖率 | 77.15% |
| 行覆盖率 | 71.6% |
| 测试文件数 | 18 |
| 测试用例数 | 161 |

---

## 2. 模块覆盖率

### 2.1 高覆盖率（≥ 80%）

| 模块 | 行覆盖率 | 说明 |
|------|----------|------|
| `src/lib/crypto.ts` | 100% | 单元测试完整 |
| `src/lib/time.ts` | 100% | 单元测试完整 |
| `src/schemas.ts` | 100% | 单元测试完整 |
| `src/stateMachine.ts` | 100% | 单元测试完整 |
| `src/types.ts` | 100% | 类型定义 |
| `src/mobile/apiError.ts` | 100% | 单元测试完整 |
| `src/mobile/approvalDecision.ts` | 100% | 单元测试完整 |
| `src/services/adminAuth.ts` | 96.42% | 单元测试完整 |
| `src/services/sandboxFaults.ts` | 93.33% | 单元测试完整 |
| `src/services/webhookSender.ts` | 100% | 单元测试完整 |
| `sdk/typescript/src/index.ts` | 94.44% | 单元测试完整 |
| `mcp-server/src/client.ts` | 84.61% | 单元测试完整 |

### 2.2 中等覆盖率（50% ~ 80%）

| 模块 | 行覆盖率 | 缺口 |
|------|----------|------|
| `src/services/aegis.ts` | 76.33% | 部分回调、webhook 分支 |
| `src/services/store.ts` | 79.55% | 复杂查询、审计 |
| `src/services/execution.ts` | 61.19% | Stripe 真实调用路径 |
| `src/services/notifications.ts` | 100% | 分支覆盖率 0 |
| `src/routes/app.ts` | 89.74% | 部分边界 |
| `src/routes/api.ts` | 51.12% | 多个 dev 端点 |
| `src/routes/web.ts` | 62.77% | 页面渲染 |
| `src/app.ts` | 69.23% | 路由、中间件 |
| `src/views.ts` | 85.45% | 部分模板分支 |

### 2.3 低覆盖率（< 50%）

| 模块 | 行覆盖率 | 缺口 |
|------|----------|------|
| `src/services/webauthn.ts` | 17.18% | WebAuthn 注册/认证流程 |
| `src/workers.ts` | 42.85% | Worker 调度逻辑 |

---

## 3. 缺口与建议

### 3.1 优先补充

1. **`src/routes/api.ts`**：补充 `POST /api/dev/payment-methods`、Stripe 相关端点、webhook 测试端点等集成测试。
2. **`src/services/execution.ts`**：Stripe 真实调用路径需 mock Stripe SDK 或使用 Stripe 测试模式。
3. **`src/routes/web.ts`**：关键页面渲染路径的集成测试。

### 3.2 可选补充

1. **`src/services/webauthn.ts`**：WebAuthn 流程依赖浏览器/设备，可考虑 mock `@simplewebauthn/server`。
2. **`src/workers.ts`**：Worker 逻辑依赖定时器，可单独做单元测试。

### 3.3 后续建议

- 将行覆盖率目标设为 80%，重点提升 `api.ts`、`execution.ts`、`web.ts`。
- 分支覆盖率 57% 偏低，可针对 `if/else`、`switch` 补充用例。
- 保持 CI 中运行 `npm run test -- --coverage`，并在 PR 中展示覆盖率变化。

---

## 4. 测试文件清单

| 文件 | 被测模块 | 测试数 |
|------|----------|--------|
| `tests/unit/stateMachine.test.ts` | stateMachine | 16 |
| `tests/unit/crypto.test.ts` | lib/crypto | 15 |
| `tests/unit/time.test.ts` | lib/time | 8 |
| `tests/unit/schemas.test.ts` | schemas | 13 |
| `tests/unit/store.test.ts` | store | 11 |
| `tests/unit/aegis.test.ts` | aegis | 5 |
| `tests/unit/execution.test.ts` | execution | 7 |
| `tests/unit/adminAuth.test.ts` | adminAuth | 11 |
| `tests/unit/webhookSender.test.ts` | webhookSender | 3 |
| `tests/unit/notifications.test.ts` | notifications | 1 |
| `tests/unit/sandboxFaults.test.ts` | sandboxFaults | 10 |
| `tests/unit/approvalDecision.test.ts` | approvalDecision | 6 |
| `tests/unit/apiError.test.ts` | apiError | 6 |
| `tests/mcp-client.test.ts` | mcp-server client | 5 |
| `tests/sdk.test.ts` | sdk typescript | 7 |
| `tests/app.test.ts` | 集成 | 27 |
| `tests/mobile-api.test.ts` | mobile helpers | 3 |
| `tests/mcp.test.ts` | MCP 集成 | 7 |

---

## 5. 相关文档

- [Agent-Test-Tasks.md](Agent-Test-Tasks.md) — 3 Agent 测试任务分工
- [Aegis-Implementation-Todos.md](../Aegis-Implementation-Todos.md) — 实施清单
