# Agent A 指令模板 — Demo + Tavily

> **任务：** 部署 + Demo 验收  
> **主文档：** [Agent-Demo-Tavily-Tasks.md](../Agent-Demo-Tavily-Tasks.md)

---

```
你负责 Aegis 项目的 **Agent A：部署 + Demo 验收**。

## 任务目标
1. 确认 G1 部署状态（Railway/Vercel 已部署），更新文档
2. 执行 D1 OpenClaw REST 验收（按 REST API 文档）
3. 编写/更新 `scripts/e2e-demo-verify.sh`，可一键跑 Demo 流程

## 必读文档
- [Aegis-Implementation-Todos.md](../../Aegis-Implementation-Todos.md) — §6 OpenClaw 测试、§7 Demo Stage Checklist
- [E2E-Verification-Checklist.md](../E2E-Verification-Checklist.md) — 验收清单
- [DEPLOYMENT.md](../DEPLOYMENT.md) — 部署说明

## Todo List（按顺序执行）

| ID | Task | 状态 |
|----|------|------|
| A1 | G1-1：确认 Aegis 后端已部署到公网（Vercel/Railway），记录 BASE_URL | ⬜ |
| A2 | G1-2：确认 BASE_URL、STRIPE_SECRET_KEY 等环境变量已配置 | ⬜ |
| A3 | G1-3～G1-4：确认 MCP HTTP Server 已部署，AEGIS_API_URL 指向后端 | ⬜ |
| A4 | G1-5：验证 OpenClaw 可访问（curl 或配置后能列出 tools） | ⬜ |
| A5 | D1-1：OpenClaw 可发现 Aegis 工具（aegis_request_payment、aegis_get_payment_status 等） | ⬜ |
| A6 | D1-2：OpenClaw 能正确调用 aegis_request_payment 并传入 amount、recipient、description | ⬜ |
| A7 | D1-3：OpenClaw 能轮询 aegis_get_payment_status，识别 succeeded、denied、expired | ⬜ |
| A8 | 编写/更新 `scripts/e2e-demo-verify.sh`，覆盖 G1 + D1 验收项，可一键执行 | ⬜ |
| A9 | 运行 `npm run test -- --coverage`，确认无回归 | ⬜ |

## Checklist（完成一项勾选一项）

### 功能验收
- [ ] G1-1～G1-5 部署状态确认完成
- [ ] D1-1～D1-3 OpenClaw REST 验收通过
- [ ] `scripts/e2e-demo-verify.sh` 可一键跑 Demo 流程

### 测试
- [ ] E2E 脚本执行通过（本地或公网）
- [ ] `npm run test` 全部通过

### 覆盖率
- [ ] `npm run test -- --coverage` 通过，无回归

## 产出
1. 更新 DEPLOYMENT.md 或相关文档，记录部署 URL、环境变量
2. 更新/新建 `scripts/e2e-demo-verify.sh`
3. 在 E2E-Verification-Checklist.md 中勾选 D1 项
```
