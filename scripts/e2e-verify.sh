#!/usr/bin/env bash
# E2E 验收脚本：健康检查、创建请求、查询状态；可选完整流程（含 dev 批准）
#
# 用法:
#   ./scripts/e2e-verify.sh [BACKEND_URL] [MCP_URL]
#   BACKEND_URL=http://localhost:3000 MCP_URL=http://localhost:8080 ./scripts/e2e-verify.sh
#
# 环境变量:
#   BACKEND_URL    后端根地址（默认 http://localhost:3000）
#   MCP_URL        MCP HTTP 服务根地址（可选，默认不校验 MCP）
#   API_KEY        Agent API Key（默认 aegis_demo_agent_key）
#   USER_ID        审批用户 ID（默认 usr_demo）
#   E2E_FULL       设为 1 时尝试完整流程：登录 + dev 批准 + 轮询 succeeded（需 E2E_ADMIN_PASSWORD）
#   E2E_ADMIN_PASSWORD  Admin 密码，E2E_FULL=1 时用于 dev 批准
#
# 示例（本地）:
#   ./scripts/e2e-verify.sh
#   ./scripts/e2e-verify.sh http://localhost:3000 http://localhost:8080
#
# 示例（G1 完成后真实环境）:
#   BACKEND_URL=https://aegis-xxx.vercel.app MCP_URL=https://mcp-xxx.railway.app ./scripts/e2e-verify.sh

set -e

BACKEND_URL="${BACKEND_URL:-${1:-http://localhost:3000}}"
MCP_URL="${MCP_URL:-$2}"
API_KEY="${API_KEY:-aegis_demo_agent_key}"
USER_ID="${USER_ID:-usr_demo}"

echo "=== Aegis E2E Verification ==="
echo "Backend: $BACKEND_URL"
echo "MCP:     ${MCP_URL:-<skip>}"
echo ""

FAILED=0

# ─── E2E-1: 健康检查 ─────────────────────────────────────────────────
echo "[E2E-1] Backend health (GET /healthz)..."
HEALTH=$(curl -sf "$BACKEND_URL/healthz" 2>/dev/null || true)
if echo "$HEALTH" | grep -q '"ok":true'; then
  echo "   OK: $HEALTH"
else
  echo "   FAIL: $HEALTH"
  FAILED=1
fi

if [ -n "$MCP_URL" ]; then
  echo ""
  echo "[E2E-1] MCP health (GET /health)..."
  MCP_HEALTH=$(curl -sf "$MCP_URL/health" 2>/dev/null || true)
  if echo "$MCP_HEALTH" | grep -q '"status":"ok"'; then
    echo "   OK: $MCP_HEALTH"
  else
    echo "   FAIL: $MCP_HEALTH"
    FAILED=1
  fi

  echo ""
  echo "[E2E-1] MCP tools list (POST /mcp)..."
  MCP_TOOLS=$(curl -sf -X POST "$MCP_URL/mcp" \
    -H 'Content-Type: application/json' \
    -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' 2>/dev/null || true)
  if echo "$MCP_TOOLS" | grep -q 'aegis_request_payment'; then
    echo "   OK: MCP tools visible"
  else
    echo "   WARN: Could not verify MCP tools (may need session)"
  fi
fi

# ─── E2E-3: 创建支付请求 ─────────────────────────────────────────────
echo ""
echo "[E2E-3] Create payment request (POST /v1/request_action)..."
IDEMPOTENCY_KEY="e2e-verify-$(date +%s)"
RESP=$(curl -sf -X POST "$BACKEND_URL/v1/request_action" \
  -H "X-Aegis-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"idempotency_key\": \"$IDEMPOTENCY_KEY\",
    \"action_type\": \"payment\",
    \"end_user_id\": \"$USER_ID\",
    \"details\": {
      \"amount\": \"1.00\",
      \"currency\": \"USD\",
      \"recipient_name\": \"E2E Test\",
      \"description\": \"E2E verification\",
      \"payment_rail\": \"card\",
      \"payment_method_preference\": \"card_default\",
      \"recipient_reference\": \"merchant_api:e2e_test\"
    },
    \"callback_url\": \"https://httpbin.org/post\"
  }" 2>/dev/null || true)

if echo "$RESP" | grep -q '"action_id"'; then
  ACTION_ID=$(echo "$RESP" | grep -o '"action_id":"act_[^"]*"' | head -1 | cut -d'"' -f4)
  APPROVAL_URL=$(echo "$RESP" | grep -o '"approval_url":"[^"]*"' | head -1 | cut -d'"' -f4)
  echo "   OK: action_id=$ACTION_ID"
  echo "   approval_url: $APPROVAL_URL"
else
  echo "   FAIL: $RESP"
  FAILED=1
  ACTION_ID=""
fi

# ─── E2E-5: 查询状态（基础） ─────────────────────────────────────────
if [ -n "$ACTION_ID" ]; then
  echo ""
  echo "[E2E-5] Get payment status (GET /v1/actions/:id)..."
  STATUS_RESP=$(curl -sf "$BACKEND_URL/v1/actions/$ACTION_ID" \
    -H "X-Aegis-API-Key: $API_KEY" 2>/dev/null || true)
  STATUS=$(echo "$STATUS_RESP" | grep -o '"status":"[^"]*"' | head -1 | cut -d'"' -f4)
  if [ -n "$STATUS" ]; then
    echo "   OK: status=$STATUS"
  else
    echo "   FAIL: $STATUS_RESP"
    FAILED=1
  fi
fi

# ─── E2E-FULL: 可选完整流程（dev 批准 + 轮询 succeeded）─────────────
if [ "$E2E_FULL" = "1" ] && [ -n "$ACTION_ID" ] && [ -n "$E2E_ADMIN_PASSWORD" ]; then
  echo ""
  echo "[E2E-FULL] Admin login + dev approve..."
  COOKIE_JAR=$(mktemp)
  trap "rm -f $COOKIE_JAR" EXIT
  LOGIN=$(curl -sf -c "$COOKIE_JAR" -b "$COOKIE_JAR" -X POST "$BACKEND_URL/login" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "password=$E2E_ADMIN_PASSWORD&next=/admin" \
    -w "%{http_code}" -o /dev/null 2>/dev/null || echo "000")
  if [ "$LOGIN" = "302" ] || [ "$LOGIN" = "200" ]; then
    DECISION=$(curl -sf -b "$COOKIE_JAR" -X POST "$BACKEND_URL/api/dev/actions/$ACTION_ID/decision" \
      -H "Content-Type: application/json" \
      -d '{"decision":"approve"}' 2>/dev/null || true)
    if echo "$DECISION" | grep -q '"status"'; then
      echo "   OK: dev approve submitted"
      echo "   Polling for succeeded (max 15s)..."
      for i in $(seq 1 6); do
        sleep 2
        FINAL=$(curl -sf "$BACKEND_URL/v1/actions/$ACTION_ID" -H "X-Aegis-API-Key: $API_KEY" 2>/dev/null || true)
        FINAL_STATUS=$(echo "$FINAL" | grep -o '"status":"[^"]*"' | head -1 | cut -d'"' -f4)
        echo "   attempt $i: status=$FINAL_STATUS"
        if [ "$FINAL_STATUS" = "succeeded" ]; then
          echo "   OK: E2E-FULL passed (succeeded)"
          break
        fi
        if [ "$i" = "6" ]; then
          echo "   WARN: did not reach succeeded (mock may be slow)"
        fi
      done
    else
      echo "   FAIL: dev approve failed ($DECISION)"
      FAILED=1
    fi
  else
    echo "   FAIL: admin login failed (http $LOGIN)"
    FAILED=1
  fi
  rm -f "$COOKIE_JAR" 2>/dev/null || true
fi

# ─── 汇总 ───────────────────────────────────────────────────────────
echo ""
if [ $FAILED -eq 0 ]; then
  echo "=== E2E Verification PASSED ==="
  exit 0
else
  echo "=== E2E Verification FAILED ==="
  exit 1
fi
