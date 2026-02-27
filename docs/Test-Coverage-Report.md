# Aegis 测试覆盖率报告

> 最后更新：2026-02-24 | 负责人：Agent C

---

## 1. 总体概况

| 指标 | 覆盖率 | 目标 |
|------|--------|------|
| 语句 (Stmts) | 72.74% | 80% |
| 分支 (Branch) | 59.74% | 80% |
| 函数 (Funcs) | 80.24% | 80% |
| 行 (Lines) | 75.41% | 80% |

**生成命令：** `npm run test -- --coverage`

---

## 2. 各模块覆盖率

### 2.1. 已达标（≥80%）

| 模块 | Stmts | Branch | Funcs | Lines |
|------|-------|--------|-------|-------|
| `mcp-server/src/client.ts` | 100% | 100% | 100% | 100% |
| `sdk/typescript/src/index.ts` | 97.43% | 87.5% | 90% | 97.22% |
| `src/mobile/apiError.ts` | 100% | 100% | 100% | 100% |
| `src/mobile/approvalDecision.ts` | 100% | 100% | 100% | 100% |
| `src/lib/crypto.ts` | 100% | 100% | 100% | 100% |
| `src/lib/time.ts` | 100% | 100% | 100% | 100% |
| `src/schemas.ts` | 100% | 100% | 100% | 100% |
| `src/stateMachine.ts` | 100% | 75% | 100% | 100% |
| `src/services/adminAuth.ts` | 94.28% | 95% | 100% | 96.42% |
| `src/services/notifications.ts` | 100% | 50% | 100% | 100% |
| `src/services/sandboxFaults.ts` | 96.87% | 86.36% | 100% | 96.66% |
| `src/services/webhookSender.ts` | 92.3% | 62.5% | 66.66% | 100% |

### 2.2. 低于 80% 的模块

| 模块 | Stmts | Branch | Funcs | Lines | 缺口说明 |
|------|-------|--------|-------|-------|----------|
| `src/workers.ts` | 27.27% | 0% | 20% | 42.85% | 定时任务逻辑，需 mock 时间/队列 |
| `src/services/webauthn.ts` | 14.1% | 2.5% | 16.66% | 17.18% | WebAuthn 注册/认证，需 mock `@simplewebauthn/server` |
| `src/routes/api.ts` | 64.8% | 44.82% | 78.57% | 66.81% | 大量 dev/Stripe 端点、错误分支 |
| `src/routes/app.ts` | 71.64% | 61.7% | 91.3% | 72.34% | 部分审批/设备注册分支 |
| `src/routes/web.ts` | 62.96% | 39.2% | 68.29% | 65.5% | 页面渲染、Passkey 脚本 |
| `src/services/execution.ts` | 73.91% | 66.66% | 83.33% | 73.13% | Stripe 真实执行路径（mock 需修复） |
| `src/services/aegis.ts` | 76.26% | 69.43% | 96.77% | 78.68% | 部分边界与错误路径 |
| `src/services/store.ts` | 81.44% | 71.35% | 85% | 86.69% | 部分审计/分页分支 |
| `src/app.ts` | 69.11% | 46.15% | 62.5% | 69.23% | 中间件、cron、错误处理 |
| `src/views.ts` | 84.12% | 50.57% | 79.16% | 83.87% | 大量 HTML 模板 |
| `src/db.ts` | 96.92% | 52.17% | 100% | 98.3% | 迁移分支 |
| `src/config.ts` | 85.71% | 86.66% | 100% | 83.33% | 环境变量分支 |

---

## 3. 缺口与建议

### 3.1. 高优先级（影响核心流程）

| 模块 | 建议 |
|------|------|
| `src/workers.ts` | 增加对 `processApprovedActions`、`executeExpired`、`dispatchDueWebhooks` 的单元测试，mock 定时器与 store |
| `src/services/webauthn.ts` | 使用 vi.mock 模拟 `@simplewebauthn/server`，覆盖注册选项生成、认证验证流程 |
| `src/routes/api.ts` | 补充 Stripe 相关端点（`setup-test-card`、`payment-methods`）的集成测试；覆盖 400/401/404 等错误分支 |

### 3.2. 中优先级（扩展覆盖）

| 模块 | 建议 |
|------|------|
| `src/services/execution.ts` | 修复 Stripe mock 的 `vi.mock('stripe')` 写法，使 `execution.test.ts` 中 Stripe 相关用例通过 |
| `src/routes/web.ts` | 对关键路由（`/approve/:token`、`/login`）做快照或 HTML 结构断言 |
| `src/services/aegis.ts` | 补充 `createWebhookTest`、`validateCallbackUrl` 等边界场景 |

### 3.3. 低优先级（可选）

| 模块 | 建议 |
|------|------|
| `src/views.ts` | 模板渲染测试成本高，可优先保证核心逻辑 |
| `src/db.ts` | 迁移逻辑可单独做集成测试 |

---

## 4. 测试文件索引

| 测试文件 | 覆盖模块 |
|----------|----------|
| `tests/unit/approvalDecision.test.ts` | `src/mobile/approvalDecision.ts` |
| `tests/unit/apiError.test.ts` | `src/mobile/apiError.ts` |
| `tests/mcp-client.test.ts` | `mcp-server/src/client.ts` |
| `tests/sdk.test.ts` | `sdk/typescript/src/index.ts` |
| `tests/mobile-api.test.ts` | mobile + approvalDecision 集成 |
| `tests/mcp.test.ts` | MCP 集成、API 可选字段 |
| `tests/app.test.ts` | 端到端、HTTP 路由 |
| `tests/unit/*.test.ts` | 各服务单元 |

---

## 5. 运行说明

```bash
# 运行所有测试
npm test

# 生成覆盖率报告
npm run test -- --coverage

# 覆盖率报告输出
# - 终端：text
# - 文件：coverage/index.html
```

---

## 6. 相关文档

- [Aegis-Implementation-Todos.md](Aegis-Implementation-Todos.md) — 功能与 Phase 对照
- [mcp-server/README.md](../mcp-server/README.md) — MCP 架构
- [mcp-server/SKILL.md](../mcp-server/SKILL.md) — MCP 工具定义
