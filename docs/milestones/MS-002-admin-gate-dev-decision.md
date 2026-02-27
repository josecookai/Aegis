# Milestone: MS-002 Admin Gate for Dev Decision Endpoint

## Priority Source

来源：`/Users/bowenwang/Holdis/repo/Aegis-Implementation-Todos.md` §6.6 Bug 列表 #3。  
目标：确保 `POST /api/dev/actions/:actionId/decision` 必须通过 admin 登录。

## Acceptance Criteria

1. 未携带 admin session cookie 调用 `POST /api/dev/actions/:actionId/decision` 返回 `401`。
2. 携带有效 admin session cookie 调用同端点可正常执行决策（200）。
3. 增加回归测试，覆盖“未登录拒绝 + 已登录放行”两种行为。
4. `make test`、`make coverage`、`make ci` 全绿。

## Scope

- 只做回归保障，不改变业务行为与权限模型。
