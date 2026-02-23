# OpenClaw 接入 Aegis MCP 配置指南

> 让 OpenClaw 通过 MCP 调用 Aegis 支付工具，实现「Agent 发起支付 → 用户审批 → 扣款」闭环。  
> 最后更新：2026-02-23

---

## 1. 前置条件

| 组件 | 说明 |
|------|------|
| Aegis 后端 | 已部署并可达（本地 `http://localhost:3000` 或公网 URL） |
| Aegis MCP HTTP Server | 与后端同机或可访问后端 |
| OpenClaw | 已安装，支持 `openclaw-mcp-bridge` 插件 |
| openclaw-mcp-bridge | 用于将 MCP HTTP 服务器桥接为 OpenClaw 原生工具 |

---

## 2. 启动 Aegis MCP HTTP Server

Aegis MCP Server 提供 **STDIO**（本地 Cursor/Claude Desktop）和 **HTTP**（远程 OpenClaw/Manus）两种传输方式。OpenClaw 需使用 HTTP 模式。

### 2.1. 安装与启动

```bash
cd mcp-server
npm install
npm run build
```

### 2.2. 配置环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `AEGIS_API_URL` | `http://localhost:3000` | Aegis 后端 API 根地址 |
| `AEGIS_API_KEY` | `aegis_demo_agent_key` | Agent API 鉴权 |
| `AEGIS_USER_ID` | `usr_demo` | 审批用户 ID |
| `MCP_HTTP_PORT` | `8080` | HTTP 服务监听端口 |

### 2.3. 启动 HTTP 服务

```bash
AEGIS_API_URL=http://localhost:3000 npm run start:http
```

预期输出：`Aegis MCP HTTP server running on http://localhost:8080/mcp`

### 2.4. 验证 MCP 可用

```bash
# 健康检查
curl http://localhost:8080/health
# 预期：{"status":"ok","sessions":0}
```

---

## 3. 配置 OpenClaw MCP Bridge

在 `~/.openclaw/openclaw.json` 中添加 `openclaw-mcp-bridge` 插件配置：

```json5
{
  "plugins": {
    "enabled": true,
    "entries": {
      "openclaw-mcp-bridge": {
        "config": {
          "servers": [
            {
              "name": "aegis",
              "url": "http://localhost:8080",
              "prefix": "",
              "healthCheck": true
            }
          ],
          "timeout": 30000,
          "retries": 1
        }
      }
    }
  }
}
```

### 配置说明

| 字段 | 说明 |
|------|------|
| `servers[].name` | 日志用名称 |
| `servers[].url` | MCP HTTP 服务 **Base URL**（不含 `/mcp`，插件会自动拼接） |
| `servers[].prefix` | 工具名前缀。Aegis 工具已自带 `aegis_` 前缀，建议留空 `""` |
| `servers[].healthCheck` | 启动时是否检查 `/health`；若 MCP 未启动会跳过该服务器 |

### 公网部署

若 MCP 部署在公网（如 `https://mcp.yourdomain.com`）：

```json5
{
  "servers": [
    {
      "name": "aegis",
      "url": "https://mcp.yourdomain.com",
      "prefix": "",
      "healthCheck": true
    }
  ]
}
```

---

## 4. 验证 Tools 可见

### 4.1. 重启 OpenClaw

```bash
openclaw gateway --verbose
```

### 4.2. 检查工具列表

若 OpenClaw 支持 `tools/list` 或类似命令，应能看到：

| 工具名 | 说明 |
|-------|------|
| `aegis_request_payment` | 发起支付请求 |

| `aegis_get_payment_status` | 查询支付状态 |
| `aegis_cancel_payment` | 取消支付 |
| `aegis_list_capabilities` | 列出可用支付方式 |

### 4.3. 快速测试

在 Telegram/Slack 等渠道中向 OpenClaw 发送：

> "请用 aegis_request_payment 发起一笔 1 美元的测试支付，收款方 Test，描述 Test payment。"

若配置正确，OpenClaw 会调用 `aegis_request_payment`，后端会创建请求并发送审批邮件（或推送到 App）。

---

## 5. 典型流程

```
1. 用户: "OpenClaw，帮我付 Cursor 月费 20 美元"
2. OpenClaw 调用 aegis_request_payment(amount: "20", recipient_name: "Cursor", description: "Cursor Pro 月费")
3. Aegis 返回 action_id，并触发用户审批（邮件 / App 推送）
4. 用户在 Aegis App 或 Web 审批页批准
5. OpenClaw 轮询 aegis_get_payment_status(action_id)
6. 状态变为 succeeded 后，告知用户「支付成功」
```

### 5.1 团队试点（成员自批）说明

团队试点当前审批策略为：**成员自批**。

- 请求由成员发起后，审批目标是该成员本人（不是管理员）
- 管理员职责仅为查看团队历史（只读），不参与审批按钮操作
- Self approval 行为：`requested_by_user_id` 与 `approval_target_user_id` 应指向同一成员
- action 响应中可用于核对：`team_id`、`requested_by_user_id`、`approval_target_user_id`、`approval_policy`

### 5.1A 配置前检查（团队试点）

在给 10 位成员分发配置前，建议先逐项确认：

1. `AEGIS_USER_ID` 是否为当前代码 seed 中的真实用户（当前 seed：`usr_team_01` ~ `usr_team_10`，管理员为 `usr_team_admin`）
2. 该 `AEGIS_USER_ID` 是否已加入团队（避免 `USER_NOT_IN_TEAM`）
3. 该成员是否已有默认卡（避免 `NO_DEFAULT_PAYMENT_METHOD`）
4. Aegis 后端健康检查：`GET <AEGIS_API_URL>/healthz`
5. MCP 服务健康检查：`GET <MCP_URL>/health`

示例：

```bash
curl https://aegis.example.com/healthz
curl https://mcp.example.com/health
```

### 5.2 成员视角端到端流程（OpenClaw -> 本人审批 -> 轮询成功）

```
1. 成员在自己的 OpenClaw 中触发 aegis_request_payment
2. Aegis 创建 action，并绑定 team_id / requested_by_user_id / approval_target_user_id
3. Aegis 向成员本人发送审批（App 或 Web）
4. 成员本人审批通过（成员自批）
5. OpenClaw 轮询 aegis_get_payment_status(action_id)
6. 状态变为 succeeded，OpenClaw 返回“支付成功”
```

---

## 5B. 团队 10 人接入模板（OpenClaw）

适用于 10 人试点并行接入。核心配置原则：

- 每位成员使用独立 `AEGIS_USER_ID`
- 全员共享同一个 `AEGIS_API_URL`
- MCP URL 按部署形态配置（共享服务可相同；本地桥接可不同端口）

### 5B.1 成员环境变量模板（每人一份）

```bash
# 团队统一（示例）
export AEGIS_API_URL="https://aegis.example.com"
export AEGIS_API_KEY="aegis_demo_agent_key"

# 成员独立（必须不同）
export AEGIS_USER_ID="usr_team_01"

# 若成员本地起 MCP HTTP 服务（示例）
export MCP_HTTP_PORT="8080"
```

### 5B.2 10 人配置清单模板

| 成员 | `AEGIS_USER_ID` | `AEGIS_API_URL` | MCP URL（示例） |
|------|------------------|------------------|-----------------|
| 成员 01 | `usr_team_01` | `https://aegis.example.com` | `http://localhost:8080` |
| 成员 02 | `usr_team_02` | `https://aegis.example.com` | `http://localhost:8081` |
| 成员 03 | `usr_team_03` | `https://aegis.example.com` | `http://localhost:8082` |
| 成员 04 | `usr_team_04` | `https://aegis.example.com` | `http://localhost:8083` |
| 成员 05 | `usr_team_05` | `https://aegis.example.com` | `http://localhost:8084` |
| 成员 06 | `usr_team_06` | `https://aegis.example.com` | `http://localhost:8085` |
| 成员 07 | `usr_team_07` | `https://aegis.example.com` | `http://localhost:8086` |
| 成员 08 | `usr_team_08` | `https://aegis.example.com` | `http://localhost:8087` |
| 成员 09 | `usr_team_09` | `https://aegis.example.com` | `http://localhost:8088` |
| 成员 10 | `usr_team_10` | `https://aegis.example.com` | `http://localhost:8089` |

备注：

- 如果团队使用共享 MCP 服务，10 人的 MCP URL 可以统一为同一个公网地址（如 `https://mcp.example.com`）
- OpenClaw Bridge 配置中的 `servers[].url` 仍填写 MCP Base URL（不带 `/mcp`）

### 5B.3 OpenClaw MCP URL 配置示例（团队版）

```json5
{
  "plugins": {
    "enabled": true,
    "entries": {
      "openclaw-mcp-bridge": {
        "config": {
          "servers": [
            {
              "name": "aegis-team",
              "url": "https://mcp.example.com",
              "prefix": "",
              "healthCheck": true
            }
          ]
        }
      }
    }
  }
}
```

---

## 6. 故障排查

| 现象 | 可能原因 | 解决 |
|------|----------|------|
| 启动时跳过 aegis 服务器 | `healthCheck: true` 且 MCP 未启动 | 先启动 `npm run start:http`，再启动 OpenClaw |
| 工具不可见 | MCP URL 错误或网络不通 | 用 `curl http://localhost:8080/health` 验证 |
| 调用返回 401 | Aegis 后端 API Key 不匹配 | 检查 `AEGIS_API_KEY` 与后端 `.env` 一致 |
| 调用返回连接错误 | Aegis 后端未启动 | 确保 `npm run dev` 在运行 |

### 6.1 团队试点常见错误（成员自批）

| 错误码 / 现象 | 含义 | 处理建议 |
|--------------|------|----------|
| `NO_DEFAULT_PAYMENT_METHOD` | 成员没有默认支付方式（如默认卡） | 先为该成员添加卡并设为默认，再重试 |
| `USER_NOT_IN_TEAM` | `AEGIS_USER_ID` 不属于目标团队 | 检查成员 ID 配置、团队成员关系、环境变量是否串号 |
| 审批人不匹配（403 / 审批失败） | 当前审批用户不是 `approval_target_user_id` | 团队策略为成员自批，需由请求发起成员本人审批 |

团队模式排查顺序（推荐）：

1. 检查 OpenClaw 进程的 `AEGIS_USER_ID` 是否为当前成员本人
2. 检查该成员是否已配置默认卡（避免 `NO_DEFAULT_PAYMENT_METHOD`）
3. 查看 action 响应中的 `requested_by_user_id`、`approval_target_user_id`、`approval_policy`
4. 管理员仅在团队历史页查看记录，不参与审批

### 6.2 错误码 -> 处理动作（团队试点执行版）

| 错误码 / 现象 | 推荐处理动作（按顺序执行） |
|--------------|-----------------------------|
| `NO_DEFAULT_PAYMENT_METHOD` | 1) 打开成员卡管理页（如 `/settings/payment-methods?user_id=<成员ID>`） 2) 添加卡并设默认 3) 重试 OpenClaw 请求 |
| `USER_NOT_IN_TEAM` | 1) 核对 `AEGIS_USER_ID` 是否为 seed 真实值（`usr_team_01..10`） 2) 检查环境变量是否串号 3) 由后端确认团队成员关系 seed/数据 |
| 审批人不匹配（403 / 审批失败） | 1) 确认当前审批账号就是请求发起成员本人 2) 核对 action 字段 `requested_by_user_id == approval_target_user_id` 3) 不要使用管理员账号审批 |
| 管理员历史接口 403（管理员也失败） | 1) 确认使用 `usr_team_admin` 2) 确认该账号状态 active 且团队角色为 admin 3) 再访问 `/api/app/admin/history?user_id=usr_team_admin` |

### 6.3 管理员历史页（只读）使用说明

- 页面路径：`/admin/team-history`
- 查询参数：`user_id`（必填，填写管理员 user_id，例如 `usr_team_admin`），可选 `limit`
- 页面调用接口：`GET /api/app/admin/history?user_id=<管理员ID>&limit=<n>`
- 权限前提（以 API 为准）：
  - 必须是团队内 `admin` 角色成员
  - 用户与团队成员关系需为 `active`
  - 普通成员访问会返回 `403`（`ADMIN_AUTH_REQUIRED`）
- 页面行为：只读列表展示，不提供审批按钮

---

## 7. 相关文档

- [mcp-server/SKILL.md](../mcp-server/SKILL.md) — 工具说明与典型流程
- [Aegis-API-Spec.md](Aegis-API-Spec.md) — REST API 规格
- [Aegis-E2E-Demo-Script.md](Aegis-E2E-Demo-Script.md) — 端到端演示脚本
