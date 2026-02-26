#!/usr/bin/env bash
# Aegis End-user Auth Smoke E2E
# Covers: /auth page, email register/login/logout, password reset request/confirm,
# provider disabled, session-first portal pages.
#
# Usage:
#   ./scripts/auth-e2e-smoke.sh [BACKEND_URL]
#   BACKEND_URL=http://localhost:3000 ./scripts/auth-e2e-smoke.sh

set -euo pipefail

BACKEND_URL="${BACKEND_URL:-${1:-http://localhost:3000}}"
TMP_DIR="$(mktemp -d)"
COOKIE_JAR="$TMP_DIR/cookies.txt"
EMAIL="smoke.$(date +%s)@example.com"
PASS_OLD="OldPassword1!"
PASS_NEW="NewPassword2!"

cleanup() {
  rm -rf "$TMP_DIR" 2>/dev/null || true
}
trap cleanup EXIT

echo "=== Aegis Auth Smoke E2E ==="
echo "Backend: $BACKEND_URL"
echo "Email:   $EMAIL"
echo

if ! curl -sf "$BACKEND_URL/healthz" >/dev/null 2>&1; then
  echo "FAIL: backend is not reachable at $BACKEND_URL"
  echo "Start server first: npm run dev"
  exit 1
fi

echo "[1] /auth page renders..."
AUTH_PAGE="$(curl -sf "$BACKEND_URL/auth?mode=signup")"
echo "$AUTH_PAGE" | grep -q "Create your account"
echo "$AUTH_PAGE" | grep -q "GitHub"
echo "$AUTH_PAGE" | grep -q "Google"
echo "   OK"

echo "[2] OAuth provider disabled returns expected error (google start)..."
GOOGLE_DISABLED="$(curl -sf "$BACKEND_URL/auth/oauth/google/start" -H 'Accept: application/json' || true)"
echo "$GOOGLE_DISABLED" | grep -q 'OAUTH_PROVIDER_NOT_ENABLED'
echo "   OK"

echo "[3] Email register..."
REGISTER_RESP="$(curl -sf -c "$COOKIE_JAR" -b "$COOKIE_JAR" -X POST "$BACKEND_URL/auth/email/register" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS_OLD\",\"display_name\":\"Smoke User\",\"next\":\"/dashboard\"}")"
echo "$REGISTER_RESP" | grep -q '"ok":true'
echo "   OK"

echo "[4] Session-first portal page access (/dashboard, /settings/payment-methods)..."
curl -sf -b "$COOKIE_JAR" "$BACKEND_URL/dashboard" | grep -q 'Dashboard'
curl -sf -b "$COOKIE_JAR" "$BACKEND_URL/settings/payment-methods" | grep -q '成员信用卡管理'
echo "   OK"

echo "[5] Logout..."
curl -sf -c "$COOKIE_JAR" -b "$COOKIE_JAR" -X POST "$BACKEND_URL/auth/logout" -o /dev/null || true
UNAUTH_STATUS="$(curl -s -o /dev/null -w "%{http_code}" "$BACKEND_URL/dashboard")"
if [ "$UNAUTH_STATUS" != "302" ]; then
  echo "   FAIL: expected 302 for unauth dashboard, got $UNAUTH_STATUS"
  exit 1
fi
echo "   OK"

echo "[6] Login with old password..."
LOGIN_RESP="$(curl -sf -c "$COOKIE_JAR" -b "$COOKIE_JAR" -X POST "$BACKEND_URL/auth/email/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS_OLD\",\"next\":\"/dashboard\"}")"
echo "$LOGIN_RESP" | grep -q '"ok":true'
echo "   OK"

echo "[7] Request password reset link..."
RESET_REQ="$(curl -sf -X POST "$BACKEND_URL/auth/password-reset/request" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\"}")"
echo "$RESET_REQ" | grep -q '"ok":true'
echo "   OK"

echo "[8] Find password reset email from dev outbox..."
EMAILS_PAGE="$(curl -sf "$BACKEND_URL/dev/emails" || true)"
RESET_URL="$(printf "%s" "$EMAILS_PAGE" | grep -o "http[^\"]*/auth/password-reset?token=[^\"]*" | grep "$EMAIL" -B0 -A0 || true)"
if [ -z "$RESET_URL" ]; then
  # Fallback: parse first reset URL if per-email matching isn't straightforward in HTML.
  RESET_URL="$(printf "%s" "$EMAILS_PAGE" | grep -o "http[^\"]*/auth/password-reset?token=[^\"]*" | head -1 || true)"
fi
if [ -z "$RESET_URL" ]; then
  echo "   FAIL: could not locate reset URL in /dev/emails"
  exit 1
fi
TOKEN="$(printf "%s" "$RESET_URL" | sed -E 's/.*token=([^&]+).*/\1/')"
echo "   OK"

echo "[9] Open reset page and submit new password..."
curl -sf "$BACKEND_URL/auth/password-reset?token=$TOKEN" | grep -qi 'Reset password'
RESET_CONFIRM="$(curl -sf -X POST "$BACKEND_URL/auth/password-reset/confirm" \
  -H 'Content-Type: application/json' \
  -d "{\"token\":\"$TOKEN\",\"password\":\"$PASS_NEW\"}")"
echo "$RESET_CONFIRM" | grep -q '"ok":true'
echo "   OK"

echo "[10] Old password fails, new password succeeds..."
OLD_FAIL_CODE="$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BACKEND_URL/auth/email/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS_OLD\"}")"
if [ "$OLD_FAIL_CODE" != "401" ]; then
  echo "   FAIL: expected old password login 401, got $OLD_FAIL_CODE"
  exit 1
fi
curl -sf -X POST "$BACKEND_URL/auth/email/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS_NEW\"}" | grep -q '"ok":true'
echo "   OK"

echo
echo "=== Auth Smoke E2E PASSED ==="
