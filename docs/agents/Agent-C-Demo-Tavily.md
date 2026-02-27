# Agent C 指令 — Demo + Tavily

> **任务：** Tavily 前端 + Demo 验收  
> **主文档：** [Aegis-Implementation-Todos.md](../../Aegis-Implementation-Todos.md) §7 Demo Stage

---

## 职责

你负责 Aegis 项目的 **Agent C：Tavily 前端 + Demo 验收**。

## 任务目标

1. 完成 D2/D3 Demo 验收（添加卡页、支付流程）
2. 实现 T5 Dashboard UI、支付方式管理
3. 补充集成测试，覆盖率目标 ≥ 60%

## Todo List（按顺序执行）

| ID | Task | 状态 |
|----|------|------|
| C1 | D2-1～D2-5 添加卡验收 | ✅ |
| C2 | D3-1～D3-4 支付流程验收 | ✅ |
| C3 | T5-1：Dashboard 首页（`/dashboard`） | ✅ |
| C4 | T5-2：支付方式管理页（`/settings/payment-methods`） | ✅ |
| C5 | T5-3：API Key 管理页（`/settings/api-keys`） | ✅ |
| C6 | 补充 `/settings/payment-methods`、Dashboard 集成测试 | ✅ |
| C7 | 覆盖率验证：api.ts、web.ts ≥ 60% | ✅ |

## Checklist

- [x] D2、D3、T5 功能验收完成
- [x] `/settings/payment-methods`、Dashboard 有集成测试
- [x] api.ts、web.ts 覆盖率 ≥ 60%

## 相关路由

- `/dashboard` — Dashboard 首页，展示用户、计划、Agent 列表
- `/settings/payment-methods` — 支付方式管理（正式路径）
- `/settings/api-keys` — API Key 管理
- `/dev/add-card` — Dev 添加卡页（需 Admin 登录）
