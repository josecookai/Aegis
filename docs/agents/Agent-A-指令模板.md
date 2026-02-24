# Agent A 指令模板

> **状态：已完成**（2026-02-23）  
> 下方为原始任务指令，供参考与复盘。

---

```
你负责 Aegis 项目的 **Agent A：后端核心服务单元测试与覆盖率**。

## 任务目标
请检查现在的测试覆盖率，确保所有的主要功能和模块都被测试覆盖到。你负责后端核心服务（store、aegis、execution、stateMachine、schemas）的单元测试。

## 必读文档
- [Aegis-Implementation-Todos.md](../../Aegis-Implementation-Todos.md) — 功能与 Phase 对照
- [Aegis-API-Spec.md](../../Aegis-API-Spec.md) — API 规格
- [Aegis-App-Flow-Spec.md](../../Aegis-App-Flow-Spec.md) — 审批状态机与流程

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
