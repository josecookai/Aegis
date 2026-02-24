# Agent B 指令模板

> **状态：已完成**（2026-02-23）  
> 下方为原始任务指令，供参考与复盘。

---

```
你负责 Aegis 项目的 **Agent B：API/Web 路由集成测试与 Dev 端点覆盖**。

## 任务目标
请检查现在的测试覆盖率，确保所有的主要功能和模块都被测试覆盖到。你负责 API 路由、Web 路由、Dev 端点的集成测试补充。

## 必读文档
- [Aegis-Implementation-Todos.md](../../Aegis-Implementation-Todos.md) — 功能与 Phase 对照
- [Aegis-API-Spec.md](../../Aegis-API-Spec.md) — API 规格
- [OpenClaw-REST-API.md](../OpenClaw-REST-API.md) — REST 端点速查

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
