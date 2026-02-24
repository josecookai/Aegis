# Agent C 指令模板 — Demo + Tavily

> **任务：** Tavily 前端 + Demo 验收  
> **主文档：** [Agent-Demo-Tavily-Tasks.md](../Agent-Demo-Tavily-Tasks.md)

---

```
你负责 Aegis 项目的 **Agent C：Tavily 前端 + Demo 验收**。

## 任务目标
1. 完成 D2/D3 Demo 验收（添加卡页、支付流程）
2. 实现 T5 Dashboard UI、支付方式管理
3. 补充集成测试，覆盖率目标 ≥ 60%

## 必读文档
- [Aegis-Implementation-Todos.md](../../Aegis-Implementation-Todos.md) — §7 Demo Stage、§6 网页添加卡
- [Aegis-Mobile-UX-Spec.md](../../Aegis-Mobile-UX-Spec.md) — UX 规格

## Todo List（按顺序执行）

| ID | Task | 状态 |
|----|------|------|
| C1 | D2-1：用户可访问添加卡页面（`/dev/add-card` 或 `/settings/payment-methods`） | ⬜ |
| C2 | D2-2～D2-4：Stripe Elements 表单、提交保存、卡信息不落库 | ⬜ |
| C3 | D2-5：登录/身份（单用户 demo 可用 usr_demo） | ⬜ |
| C4 | D3-1～D3-4：OpenClaw 发起支付、用户审批、扣款成功、使用用户已添加的卡 | ⬜ |
| C5 | T5-1：Dashboard 首页（`/dashboard` 或 `/`），展示当前用户、计划、Agent 列表 | ⬜ |
| C6 | T5-2：支付方式管理页（`/settings/payment-methods`），正式路径 UI | ⬜ |
| C7 | T5-3：API Key 管理页（生成、复制、删除） | ⬜ |
| C8 | 补充 `/settings/payment-methods`、Dashboard 的集成测试 | ⬜ |
| C9 | 检查 `api.ts`、`web.ts` 覆盖率，目标 ≥ 60% | ⬜ |
| C10 | 运行 `npm run test -- --coverage`，确认通过 | ⬜ |

## Checklist（完成一项勾选一项）

### 功能验收
- [ ] D2-1～D2-5 网页添加卡验收通过
- [ ] D3-1～D3-4 支付流程验收通过
- [ ] T5-1～T5-3 Dashboard UI 完成

### 测试
- [ ] `/settings/payment-methods` 有集成测试
- [ ] Dashboard 相关路由有集成测试
- [ ] `npm run test` 全部通过

### 覆盖率
- [ ] `api.ts`、`web.ts` 行覆盖率 ≥ 60%（或维持现有）
- [ ] `npm run test -- --coverage` 通过

## 产出
1. 更新/新增添加卡页、Dashboard、API Key 管理页
2. 补充 `tests/app.test.ts` 或新建集成测试
3. 在 E2E-Verification-Checklist.md 中勾选 D2、D3 项
```
