# Aegis MCP Server

MCP (Model Context Protocol) server that wraps the [Aegis Payment Protocol](../README.md) REST API, enabling AI agents to request, track, and cancel human-approved payments.

## Quick Start

```bash
# 1. Start the Aegis backend (from project root)
npm run dev

# 2. Install MCP server dependencies
cd mcp-server
npm install

# 3a. Run STDIO mode (for Claude Desktop / Cursor)
npm run dev

# 3b. OR run HTTP mode (for remote agents like Manus / OpenClaw)
npm run dev:http
```

## Architecture

```
AI Agent  <--MCP JSON-RPC-->  aegis-mcp-server  <--HTTP-->  Aegis Backend  <-->  Stripe/Mock
```

The MCP server is a thin wrapper — it translates MCP tool calls into Aegis REST API requests. No backend modifications needed.

## Tools

| Tool | Description |
|---|---|
| `aegis_request_payment` | Create a payment request (triggers user approval) |
| `aegis_get_payment_status` | Poll payment status by action_id |
| `aegis_cancel_payment` | Cancel a pending payment |
| `aegis_list_capabilities` | List available payment methods/rails |

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `AEGIS_API_URL` | `http://localhost:3000` | Aegis backend base URL |
| `AEGIS_API_KEY` | `aegis_demo_agent_key` | Agent API key |
| `AEGIS_USER_ID` | `usr_demo` | User ID for payment approvals |
| `MCP_HTTP_PORT` | `8080` | Port for HTTP transport mode |

## Transport Modes

### STDIO (local agents)

Used by Claude Desktop, Cursor, and other local AI tools.

```bash
npm start          # production (requires npm run build first)
npm run dev        # development (tsx)
```

Configure in Claude Desktop `settings.json`:

```json
{
  "mcpServers": {
    "aegis-payment": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-server/dist/index.js"],
      "env": {
        "AEGIS_API_URL": "http://localhost:3000",
        "AEGIS_API_KEY": "aegis_demo_agent_key",
        "AEGIS_USER_ID": "usr_demo"
      }
    }
  }
}
```

### Streamable HTTP (remote agents)

Used by Manus, OpenClaw, and other cloud-based agents.

```bash
npm run start:http     # production
npm run dev:http       # development
```

Endpoint: `POST http://localhost:8080/mcp`

Health check: `GET http://localhost:8080/health`

## Build

```bash
npm run build     # compile TypeScript to dist/
```

## Project Structure

```
src/
  index.ts                  # STDIO entry point
  http-server.ts            # HTTP entry point
  config.ts                 # Environment variable loading
  client.ts                 # Aegis REST API client wrapper
  tools/
    requestPayment.ts       # aegis_request_payment tool
    getPaymentStatus.ts     # aegis_get_payment_status tool
    cancelPayment.ts        # aegis_cancel_payment tool
    listCapabilities.ts     # aegis_list_capabilities tool
```
