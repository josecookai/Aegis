#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# ── Colors ──────────────────────────────────────────────
GREEN='\033[0;32m'; CYAN='\033[0;36m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()  { echo -e "${CYAN}[aegis]${NC} $*"; }
ok()    { echo -e "${GREEN}[aegis]${NC} $*"; }
warn()  { echo -e "${YELLOW}[aegis]${NC} $*"; }

# ── Detect LAN IP ──────────────────────────────────────
LAN_IP=$(ipconfig getifaddr en0 2>/dev/null || hostname -I 2>/dev/null | awk '{print $1}' || echo "localhost")

# ── Pre-flight checks ──────────────────────────────────
info "Checking prerequisites…"

if [ ! -f "$ROOT/.env" ]; then
  warn ".env not found — copying from .env.example"
  cp "$ROOT/.env.example" "$ROOT/.env"
fi

if [ ! -d "$ROOT/node_modules" ]; then
  info "Installing backend dependencies…"
  (cd "$ROOT" && npm install)
fi

if [ ! -d "$ROOT/app/node_modules" ]; then
  info "Installing mobile dependencies…"
  (cd "$ROOT/app" && npm install)
fi

# ── Start backend ──────────────────────────────────────
info "Starting backend on http://localhost:3000 …"
(cd "$ROOT" && npx tsx src/server.ts) &
BACKEND_PID=$!

sleep 2
if ! kill -0 $BACKEND_PID 2>/dev/null; then
  echo "❌ Backend failed to start"; exit 1
fi

# ── Start Expo ─────────────────────────────────────────
info "Starting Expo dev server…"
info "Mobile app will connect to backend at http://${LAN_IP}:3000"
(cd "$ROOT/app" && EXPO_PUBLIC_API_URL="http://${LAN_IP}:3000" npx expo start --ios) &
EXPO_PID=$!

# ── Cleanup on exit ───────────────────────────────────
cleanup() {
  info "Shutting down…"
  kill $BACKEND_PID 2>/dev/null || true
  kill $EXPO_PID 2>/dev/null || true
  wait 2>/dev/null || true
  ok "Done."
}
trap cleanup EXIT INT TERM

# ── Print demo guide ──────────────────────────────────
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  Aegis Demo Ready!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "  ${CYAN}Backend${NC}    http://localhost:3000"
echo -e "  ${CYAN}Admin${NC}     http://localhost:3000/login  (password: aegis_admin_dev)"
echo -e "  ${CYAN}Emails${NC}    http://localhost:3000/dev/emails"
echo -e "  ${CYAN}Webhooks${NC}  http://localhost:3000/dev/webhooks"
echo ""
echo -e "  ${YELLOW}Quick Test — create a payment request:${NC}"
echo ""
echo "  curl -s -X POST http://localhost:3000/v1/request_action \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -H 'X-Aegis-API-Key: aegis_demo_agent_key' \\"
echo "    -d '{\"action_type\":\"payment\",\"end_user_id\":\"usr_demo\","
echo "         \"details\":{\"amount\":\"42.00\",\"currency\":\"USD\","
echo "         \"recipient_name\":\"Demo Coffee Shop\","
echo "         \"description\":\"Latte + Croissant\","
echo "         \"payment_rail\":\"card\"},"
echo "         \"callback_url\":\"https://httpbin.org/post\"}' | jq ."
echo ""
echo -e "  Then open the mobile app → see pending card → tap → approve with FaceID"
echo ""
echo -e "  Press ${YELLOW}Ctrl+C${NC} to stop all services."
echo ""

wait
