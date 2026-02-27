# Agent Quickstart (10分钟跑通)

Last updated: 2026-02-27

## 目标

在 10 分钟内完成：

1. 启动 Aegis 服务
2. 创建一笔支付请求
3. 完成审批
4. 查询最终状态

## 前置条件

- Node.js 18+
- 本地可访问 `http://localhost:3000`

## 1) 启动服务（约 2 分钟）

```bash
cd /Users/bowenwang/Holdis
npm install
npm run dev
```

健康检查：

```bash
curl -s http://localhost:3000/healthz
```

预期：返回 `{"ok":true,...}`。

## 2) 发起支付请求（约 2 分钟）

```bash
curl -s -X POST http://localhost:3000/v1/request_action \
  -H 'Content-Type: application/json' \
  -H 'X-Aegis-API-Key: aegis_demo_agent_key' \
  -d '{
    "idempotency_key": "quickstart-001",
    "end_user_id": "usr_demo",
    "action_type": "payment",
    "callback_url": "http://localhost:3000/_test/callback",
    "details": {
      "amount": "1.00",
      "currency": "USD",
      "recipient_name": "Quickstart Merchant",
      "description": "Agent quickstart payment",
      "payment_rail": "card",
      "payment_method_preference": "card_default",
      "recipient_reference": "merchant_api:quickstart"
    }
  }'
```

记录返回中的：

- `action.action_id`
- `links.approval_url`

## 3) 审批（约 2 分钟）

打开 `approval_url`，在页面点击批准。

如果仅做本地联调，可用 admin/dev 强制审批（需先登录 `/login`）：

```bash
curl -s -X POST http://localhost:3000/api/dev/actions/<action_id>/decision \
  -H 'Content-Type: application/json' \
  -d '{"decision":"approve"}'
```

## 4) 推进执行并查询状态（约 2 分钟）

触发 worker：

```bash
curl -s -X POST http://localhost:3000/api/dev/workers/tick -d '{}'
```

查询状态：

```bash
curl -s http://localhost:3000/v1/actions/<action_id> \
  -H 'X-Aegis-API-Key: aegis_demo_agent_key'
```

预期：`action.status` 最终为 `succeeded`（或明确失败原因）。

## 5) 常见问题（约 2 分钟）

- `401 UNAUTHORIZED`：API Key 错误；检查 `X-Aegis-API-Key`。
- `NO_DEFAULT_PAYMENT_METHOD`：该用户没有默认卡；先到 `/settings/payment-methods` 添加并设默认。
- `USER_NOT_IN_TEAM`：团队试点 user_id 错误；检查 seed 用户（如 `usr_team_01`）。

## 最小验收清单

- [ ] `healthz` 正常
- [ ] `request_action` 返回 `action_id` + `approval_url`
- [ ] 审批可完成（web 或 dev）
- [ ] `/v1/actions/:id` 可查到终态
