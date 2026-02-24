# Agent C 指令模板

> **状态：已完成**（2026-02-23）  
> 下方为原始任务指令，供参考与复盘。

---

```
你负责 Aegis 项目的 **Agent C：Mobile、MCP、SDK 测试与覆盖率审计**。

## 任务目标
请检查现在的测试覆盖率，确保所有的主要功能和模块都被测试覆盖到。你负责移动端逻辑、MCP client、SDK 的测试，以及整体覆盖率审计与报告。

## 必读文档
- [Aegis-Implementation-Todos.md](../../Aegis-Implementation-Todos.md) — 功能与 Phase 对照
- [mcp-server/README.md](../../mcp-server/README.md) — MCP 架构
- [mcp-server/SKILL.md](../../mcp-server/SKILL.md) — MCP 工具定义

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
