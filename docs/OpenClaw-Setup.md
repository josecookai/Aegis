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

---

## 6. 故障排查

| 现象 | 可能原因 | 解决 |
|------|----------|------|
| 启动时跳过 aegis 服务器 | `healthCheck: true` 且 MCP 未启动 | 先启动 `npm run start:http`，再启动 OpenClaw |
| 工具不可见 | MCP URL 错误或网络不通 | 用 `curl http://localhost:8080/health` 验证 |
| 调用返回 401 | Aegis 后端 API Key 不匹配 | 检查 `AEGIS_API_KEY` 与后端 `.env` 一致 |
| 调用返回连接错误 | Aegis 后端未启动 | 确保 `npm run dev` 在运行 |

---

## 7. 相关文档

- [mcp-server/SKILL.md](../mcp-server/SKILL.md) — 工具说明与典型流程
- [Aegis-API-Spec.md](Aegis-API-Spec.md) — REST API 规格
- [Aegis-E2E-Demo-Script.md](Aegis-E2E-Demo-Script.md) — 端到端演示脚本
