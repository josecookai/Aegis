# Aegis Payment Skill

> Let AI agents request, track, and cancel payments with human-in-the-loop approval via Aegis.

## When to Use

Use this skill when an AI agent needs to **make a real payment** on behalf of a user — for example:

- Paying for a SaaS subscription (Cursor, GitHub, etc.)
- Purchasing an item from an online store
- Sending money to another person or business

Aegis ensures every payment goes through **human approval** in the Aegis mobile app before execution.

## Prerequisites

1. **Aegis backend** running (default `http://localhost:3000`)
2. **API key** for the agent (default `aegis_demo_agent_key`)
3. **User ID** of the person who will approve payments (default `usr_demo`)

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `AEGIS_API_URL` | `http://localhost:3000` | Aegis backend URL |
| `AEGIS_API_KEY` | `aegis_demo_agent_key` | Agent API key |
| `AEGIS_USER_ID` | `usr_demo` | End-user ID for approvals |

## Available Tools

### `aegis_request_payment`

Request a payment. Returns an `action_id` and triggers a notification to the user's Aegis app.

**Parameters:**
- `amount` (string, required) — e.g. `"20.00"`
- `currency` (string, default `"USD"`) — ISO 4217 code
- `recipient_name` (string, required) — who gets the money
- `description` (string, required) — human-readable reason
- `payment_rail` (`"card"` | `"crypto"`, default `"card"`)

### `aegis_get_payment_status`

Poll the status of a payment request.

**Parameters:**
- `action_id` (string, required)

**Possible statuses:** `awaiting_approval`, `approved`, `denied`, `executing`, `succeeded`, `failed`, `expired`, `cancelled`

### `aegis_cancel_payment`

Cancel a payment that hasn't been executed yet.

**Parameters:**
- `action_id` (string, required)
- `reason` (string, optional)

### `aegis_list_capabilities`

List payment methods and rails available for the current user. No parameters.

## Typical Flow

```
1. Call aegis_request_payment with amount, recipient, description
2. Receive action_id + status "awaiting_approval"
3. Wait for user to approve in Aegis mobile app
4. Poll aegis_get_payment_status every 5-10 seconds
5. When status is "succeeded" → payment is done
   When status is "denied" or "expired" → inform the user
   When status is "failed" → check error details, retry or inform user
```

## Configuration

### Claude Desktop / Cursor (local STDIO)

Add to your MCP settings:

```json
{
  "mcpServers": {
    "aegis-payment": {
      "command": "node",
      "args": ["<path-to>/mcp-server/dist/index.js"],
      "env": {
        "AEGIS_API_URL": "http://localhost:3000",
        "AEGIS_API_KEY": "aegis_demo_agent_key",
        "AEGIS_USER_ID": "usr_demo"
      }
    }
  }
}
```

### Manus / OpenClaw (remote HTTP)

Start the HTTP server:

```bash
cd mcp-server
AEGIS_API_URL=http://localhost:3000 npm run start:http
```

Then configure the agent to connect to `http://<host>:8080/mcp`.

### Direct REST API (no MCP wrapper)

Some agents (e.g. Manus) can call HTTP APIs directly. Point them at the Aegis REST API:

- `POST /v1/request_action` — create payment
- `GET /v1/actions/:actionId` — check status
- `POST /v1/actions/:actionId/cancel` — cancel

All requests need header `X-Aegis-API-Key: <key>`.
