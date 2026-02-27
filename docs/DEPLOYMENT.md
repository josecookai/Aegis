# Aegis 部署指南

本文档说明如何将 Aegis 后端与 MCP Server 部署到公网，满足 [Implementation Todos §6.1](../Aegis-Implementation-Todos.md#61-部署与公网可达g1) 要求。

---

## 1. 公网 URL 列表（部署后填写）

| 服务 | URL | 用途 |
|------|-----|------|
| **后端（REST API）** | `https://aegis-production-7cee.up.railway.app` | Agent 可直接调用 REST API（`/v1/request_action`、`/v1/actions/:id` 等），无需 MCP。Web 审批、健康检查 |
| **MCP Server** | （可选） | 仅当客户端支持 MCP Streamable HTTP（SSE 会话）时使用。OpenClaw 若遇「Server not initialized」请改用 REST 直连，见 [OpenClaw-REST-API.md](OpenClaw-REST-API.md) |

**验证结果：** 2026-02-24 Agent A 验收通过

```
# 执行: ./scripts/verify-deployment.sh https://aegis-production-7cee.up.railway.app
# 输出:
# === Verifying Aegis deployment ===
# 1. Backend health (GET /healthz)... OK
# === Verification complete ===
```

**Demo 一键验收：** `./scripts/e2e-demo-verify.sh` 或 `npm run e2e:demo`

---

## 2. 环境变量

### 2.1 后端（Backend）

| 变量 | 必填 | 默认 | 说明 |
|------|------|------|------|
| `BASE_URL` | ✅ | `http://localhost:3000` | 公网可访问的根 URL（用于 approval_url、邮件链接） |
| `STRIPE_SECRET_KEY` | 可选 | `null` | Stripe 测试/生产 key；不设则使用 mock 支付 |
| `STRIPE_PUBLISHABLE_KEY` | 可选 | — | Stripe 前端 key；添加卡页若用 Stripe Elements 需配置 |
| `CRON_SECRET` | Vercel 必填 | — | Cron 调用 `/api/cron/tick` 时的鉴权；Vercel Cron 自动注入 |
| `DB_PATH` | 可选 | `/tmp/aegis.db` (Vercel) / `data/aegis.db` (本地) | SQLite 路径；Vercel 上 `/tmp` 为临时存储 |
| `ADMIN_PASSWORD` | 建议 | `aegis_admin_dev` | Admin 登录密码 |
| `ADMIN_SESSION_SECRET` | 建议 | 开发默认 | Session 签名密钥 |
| `AUTO_START_WORKERS` | 可选 | `true` (Railway) / `false` (Vercel) | 是否启动后台 worker；Vercel 上由 Cron 触发 |

### 2.2 MCP Server

| 变量 | 必填 | 默认 | 说明 |
|------|------|------|------|
| `AEGIS_API_URL` | ✅ | `http://localhost:3000` | 已部署后端公网 URL |
| `AEGIS_API_KEY` | 可选 | `aegis_demo_agent_key` | Agent API Key |
| `AEGIS_USER_ID` | 可选 | `usr_demo` | 测试用户 ID |
| `PORT` | 自动 | Railway 注入 | 监听端口（Railway 自动设置） |

---

## 3. G1 执行清单（按顺序）

### 3.1 后端部署到 Vercel

```bash
# 1. 登录（若未登录）
npx vercel login

# 2. 首次部署（会生成 Preview URL）
cd /path/to/Holdis
npx vercel --prod

# 3. 记下部署 URL，如 https://holdis-xxx.vercel.app
```

### 3.2 配置 Vercel 环境变量

在 [Vercel Dashboard](https://vercel.com/dashboard) → 项目 → Settings → Environment Variables 添加：

| 变量 | 值 | 环境 |
|------|-----|------|
| `BASE_URL` | `https://holdis-xxx.vercel.app`（替换为实际 URL） | Production |
| `CRON_SECRET` | `openssl rand -hex 32` 生成 | Production |
| `STRIPE_SECRET_KEY` | `sk_test_...`（可选） | Production |
| `STRIPE_PUBLISHABLE_KEY` | `pk_test_...`（可选） | Production |

保存后触发 **Redeploy**。

### 3.3 MCP 部署到 Railway

MCP 需长连接，建议用 Railway 独立部署：

1. 打开 [Railway](https://railway.app) → New Project → Deploy from GitHub
2. 选择本仓库，新建 **Service**
3. 设置 **Root Directory** 为 `mcp-server`
4. 在 Variables 添加：
   - `AEGIS_API_URL` = 后端 URL（如 `https://holdis-xxx.vercel.app`）
5. Settings → Networking → Generate Domain，得到 MCP URL

### 3.4 验证

```bash
./scripts/verify-deployment.sh https://holdis-xxx.vercel.app https://holdis-mcp-xxx.up.railway.app
```

---

## 4. 部署方式（详细）

### 4.1 方式 A：Vercel（后端）

**适用：** 快速预览、无持久化需求（SQLite 在 `/tmp` 会随冷启动重置）

1. 安装 Vercel CLI：`npm i -g vercel`
2. 在项目根目录执行：`vercel`
3. 在 Vercel 控制台设置环境变量：
   - `BASE_URL` = `https://your-project.vercel.app`
   - `CRON_SECRET` = 随机字符串（如 `openssl rand -hex 32`）
   - `STRIPE_SECRET_KEY`、`STRIPE_PUBLISHABLE_KEY`（可选）
4. 重新部署：`vercel --prod`

**注意：** Workers 在 Vercel 上由 Cron 每分钟触发。需在 Vercel 控制台启用 Cron 并确保 `CRON_SECRET` 已设置。

### 4.2 方式 B：Railway（后端 + MCP，推荐）

**适用：** 持久化 SQLite、Worker 常驻、MCP 同平台部署

#### 后端

1. 在 [Railway](https://railway.app) 新建项目，选择「Deploy from GitHub repo」
2. 选择本仓库，Railway 自动检测 `railway.toml`
3. 设置环境变量：
   - `BASE_URL` = `https://your-app.up.railway.app`（部署后从 Railway 获取）
   - `STRIPE_SECRET_KEY`（可选）
   - `ADMIN_PASSWORD`、`ADMIN_SESSION_SECRET`（建议修改）
4. 部署完成后，在 Settings → Networking 中生成 Public URL

#### MCP Server

1. 在同一 Railway 项目中新建 Service
2. 选择同一仓库，设置 **Root Directory** 为 `mcp-server`
3. 设置环境变量：
   - `AEGIS_API_URL` = 后端 Public URL（如 `https://xxx.up.railway.app`）
   - `AEGIS_API_KEY` | `AEGIS_USER_ID`（可选，使用默认即可）
4. 部署后生成 MCP 的 Public URL

### 4.3 方式 C：Docker（自托管）

```bash
# 后端
docker build -t aegis-backend -f Dockerfile .
docker run -p 3000:3000 -e BASE_URL=https://your-domain.com aegis-backend

# MCP（需先部署后端）
cd mcp-server && docker build -t aegis-mcp .
docker run -p 8080:8080 -e AEGIS_API_URL=https://your-backend.com aegis-mcp
```

---

## 5. 验证部署

### 5.1 后端健康检查

```bash
curl -s https://your-backend.vercel.app/healthz
# 应返回: {"ok":true,"service":"aegis-mvp","time":"..."}
```

### 5.2 MCP 健康检查

```bash
curl -s https://your-mcp.up.railway.app/health
# 应返回: {"status":"ok","sessions":0}
```

### 5.3 创建支付请求（端到端）

```bash
curl -s -X POST https://your-backend.vercel.app/v1/request_action \
  -H 'Content-Type: application/json' \
  -H 'X-Aegis-API-Key: aegis_demo_agent_key' \
  -d '{
    "idempotency_key": "deploy-verify-1",
    "end_user_id": "usr_demo",
    "action_type": "payment",
    "callback_url": "https://your-backend.vercel.app/_test/callback",
    "details": {
      "amount": "1.00",
      "currency": "USD",
      "recipient_name": "Deploy Test",
      "description": "Deployment verification",
      "payment_rail": "card",
      "payment_method_preference": "card_default",
      "recipient_reference": "merchant_api:deploy_test"
    }
  }'
```

应返回 `action` 和 `links.approval_url`。打开 `approval_url` 可完成审批流程。

### 5.4 MCP Tools 列出

```bash
curl -s -X POST https://your-mcp.up.railway.app/mcp \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

应返回 `aegis_request_payment`、`aegis_get_payment_status` 等 tools。

---

## 6. 部署脚本

项目根目录提供 `scripts/verify-deployment.sh`，可一键验证上述 URL：

```bash
./scripts/verify-deployment.sh https://your-backend.vercel.app https://your-mcp.up.railway.app
```

---

## 7. 常见问题

| 问题 | 处理 |
|------|------|
| OpenClaw MCP「Server not initialized」 | MCP 需 SSE 会话，OpenClaw 不支持。改用 REST API 直连后端，见 [OpenClaw-REST-API.md](OpenClaw-REST-API.md) |
| Vercel 上 approval 链接 404 | 检查 `BASE_URL` 是否与部署域名一致 |
| Workers 不执行 | Vercel：检查 Cron 是否启用、`CRON_SECRET` 是否设置；Railway：检查 `AUTO_START_WORKERS` |
| MCP 返回 502 | 检查 `AEGIS_API_URL` 是否正确、后端是否可达 |
| SQLite 数据丢失 | Vercel `/tmp` 为临时存储；需持久化请用 Railway 或 Vercel Postgres |

---

## 8. 相关文档

- [OpenClaw-REST-API.md](OpenClaw-REST-API.md) — OpenClaw REST 直连（当 MCP 不可用时）
- [Aegis-Implementation-Todos.md §6.1](../Aegis-Implementation-Todos.md#61-部署与公网可达g1)
- [mcp-server/README.md](../mcp-server/README.md) — MCP HTTP 模式说明
- [README.md](../README.md) — 本地启动方式
