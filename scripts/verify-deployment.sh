#!/usr/bin/env bash
# Verify Aegis backend and MCP deployment.
# Usage: ./scripts/verify-deployment.sh <BACKEND_URL> [MCP_URL]
# Example: ./scripts/verify-deployment.sh https://aegis-xxx.vercel.app https://aegis-mcp-xxx.up.railway.app

set -e

BACKEND_URL="${1:?Usage: $0 <BACKEND_URL> [MCP_URL]}"
MCP_URL="${2:-}"

echo "=== Verifying Aegis deployment ==="
echo "Backend: $BACKEND_URL"
echo "MCP:     ${MCP_URL:-<not provided>}"
echo ""

# G1-5: Backend health check
echo "1. Backend health (GET /healthz)..."
HEALTH=$(curl -sf "$BACKEND_URL/healthz" || true)
if echo "$HEALTH" | grep -q '"ok":true'; then
  echo "   OK: $HEALTH"
else
  echo "   FAIL: $HEALTH"
  exit 1
fi

# Optional: MCP health check
if [ -n "$MCP_URL" ]; then
  echo ""
  echo "2. MCP health (GET /health)..."
  MCP_HEALTH=$(curl -sf "$MCP_URL/health" || true)
  if echo "$MCP_HEALTH" | grep -q '"status":"ok"'; then
    echo "   OK: $MCP_HEALTH"
  else
    echo "   FAIL: $MCP_HEALTH"
    exit 1
  fi

  echo ""
  echo "3. MCP tools list (POST /mcp)..."
  MCP_TOOLS=$(curl -sf -X POST "$MCP_URL/mcp" \
    -H 'Content-Type: application/json' \
    -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' || true)
  if echo "$MCP_TOOLS" | grep -q 'aegis_request_payment'; then
    echo "   OK: MCP tools visible"
  else
    echo "   WARN: Could not verify MCP tools (may need session)"
  fi
fi

echo ""
echo "=== Verification complete ==="
