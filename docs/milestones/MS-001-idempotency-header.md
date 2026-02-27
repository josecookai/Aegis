# Milestone: MS-001 Idempotency Header Alignment

## Priority Source

来源：`/Users/bowenwang/Holdis/repo/Aegis-Implementation-Todos.md` §5.1  
差异项：Spec 推荐使用 `Idempotency-Key` header，MVP 当前以 body `idempotency_key` 为主。

## Acceptance Criteria

1. `POST /v1/request_action` 支持仅通过 `Idempotency-Key` 请求头提交幂等键（不传 body 字段也可成功）。
2. 当请求头与 body 同时存在时，以请求头值为准，并在响应头 `Idempotency-Key` 中回显生效值。
3. 兼容旧调用：仅传 body `idempotency_key` 的现有请求与测试不回归。
4. 新增/更新测试覆盖 header-only 与 header 优先级场景。
5. 通过门禁命令：`npm run build`、`npm test`、`npm run test:coverage`（替代 `make ci` 流程）。

## Scope

- 最小改动：仅调整 API 路由解析逻辑与测试。
- 非目标：不改动存储模型、状态机与执行引擎。
