# Manus 接入 Aegis 说明

> Manus 可通过 **REST 直连** 或 **MCP** 接入 Aegis，实现 Agent 发起支付 → 用户审批 → 扣款闭环。  
> 最后更新：2026-02-23

---

## 1. 接入方式概览

| 方式 | 适用场景 | 说明 |
|------|----------|------|
| **REST 直连** | Manus 支持 HTTP 调用 | 直接调用 Aegis `POST /v1/request_action` 等端点 |
| **MCP** | Manus 支持 MCP 工具 | 通过 Aegis MCP HTTP Server 暴露 `aegis_request_payment` 等工具 |

若 Manus 支持 MCP HTTP 客户端，配置方式与 [OpenClaw-Setup.md](OpenClaw-Setup.md) 类似；否则使用 REST 直连。

---

## 2. REST 直连

### 2.1. 环境变量

| 变量 | 说明 |
|------|------|
| `AEGIS_API_URL` | Aegis 后端根地址，如 `http://localhost:3000` |
| `AEGIS_API_KEY` | Agent API Key，默认 `aegis_demo_agent_key` |
| `AEGIS_USER_ID` | 审批用户 ID，默认 `usr_demo` |

### 2.2. 发起支付请求

```bash
curl -X POST "${AEGIS_API_URL}/v1/request_action" \
  -H "X-Aegis-API-Key: ${AEGIS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "action_type": "payment",
    "end_user_id": "usr_demo",
    "details": {
      "amount": "49.90",
      "currency": "USD",
      "recipient_name": "Amazon",
      "description": "AI 2026 hardcover",
      "payment_rail": "card",
      "payment_method_preference": "card_default",
      "recipient_reference": "merchant_api:amazon"
    },
    "callback_url": "https://your-agent.com/aegis/callback"
  }'
```

### 2.3. 响应示例（201）

```json
{
  "action": {
    "action_id": "act_xxxxxxxx",
    "status": "awaiting_approval"
  },
  "links": {
    "approval_url": "http://localhost:3000/approve/mltok_xxxxxxxx"
  }
}
```

### 2.4. 查询状态

```bash
curl "${AEGIS_API_URL}/v1/actions/act_xxxxxxxx" \
  -H "X-Aegis-API-Key: ${AEGIS_API_KEY}"
```

### 2.5. Manus Skill 示例

在 Manus 的 `SKILL.md` 或工具配置中注册 Aegis 支付能力：

```markdown
## Skill: Aegis Payments
**Description**: Allow Manus to buy goods or book services through Aegis in a controlled environment.
**Required API**: `AEGIS_API_KEY` (set in Manus Environment Variables)
```

Python 工具示例：

```python
import os
import requests

def aegis_request_payment(amount: str, recipient: str, description: str):
    url = f"{os.environ['AEGIS_API_URL']}/v1/request_action"
    headers = {
        "X-Aegis-API-Key": os.environ["AEGIS_API_KEY"],
        "Content-Type": "application/json",
    }
    body = {
        "action_type": "payment",
        "end_user_id": os.environ.get("AEGIS_USER_ID", "usr_demo"),
        "details": {
            "amount": amount,
            "currency": "USD",
            "recipient_name": recipient,
            "description": description,
            "payment_rail": "card",
            "payment_method_preference": "card_default",
        },
        "callback_url": os.environ.get("AEGIS_CALLBACK_URL", ""),
    }
    r = requests.post(url, headers=headers, json=body, timeout=20)
    r.raise_for_status()
    return r.json()
```

---

## 3. MCP 接入

若 Manus 支持 MCP HTTP（Streamable HTTP 协议），可复用 Aegis MCP Server。

### 3.1. 启动 MCP HTTP Server

```bash
cd mcp-server
AEGIS_API_URL=http://localhost:3000 npm run start:http
```

### 3.2. 配置 Manus MCP 客户端

参考 Manus 文档中 MCP 配置方式，填入：

- **MCP URL**: `http://localhost:8080/mcp`（或公网部署的 URL）
- **环境变量**: `AEGIS_API_URL`、`AEGIS_API_KEY`、`AEGIS_USER_ID` 在 MCP Server 进程内配置，无需在 Manus 侧重复

### 3.3. 可用工具

| 工具 | 说明 |
|------|------|
| `aegis_request_payment` | 发起支付请求 |
| `aegis_get_payment_status` | 查询支付状态 |
| `aegis_cancel_payment` | 取消支付 |
| `aegis_list_capabilities` | 列出支付方式 |

详见 [mcp-server/SKILL.md](../mcp-server/SKILL.md)。

---

## 4. 典型流程

1. Manus 调用 `aegis_request_payment` 或 `POST /v1/request_action`
2. 用户收到审批通知（邮件 magic link 或 App 推送）
3. 用户在 Aegis App / Web 批准
4. Manus 轮询 `aegis_get_payment_status` 或 `GET /v1/actions/:id`
5. 状态为 `succeeded` 后继续后续流程

---

## 5. 相关文档

- [OpenClaw-Setup.md](OpenClaw-Setup.md) — OpenClaw MCP 配置
- [Aegis-API-Spec.md](Aegis-API-Spec.md) — REST API 规格
- [mcp-server/SKILL.md](../mcp-server/SKILL.md) — MCP 工具说明
