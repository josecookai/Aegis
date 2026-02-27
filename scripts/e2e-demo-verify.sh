#!/usr/bin/env bash
# Aegis Demo 一键验收脚本
# 默认使用 Railway 生产环境，可覆盖 BACKEND_URL 测试本地或其他环境
#
# 用法:
#   ./scripts/e2e-demo-verify.sh
#   npm run e2e:demo
#
# 环境变量（可选）:
#   BACKEND_URL    后端根地址（默认 https://aegis-production-7cee.up.railway.app）
#   MCP_URL        MCP 服务地址（可选）
#   E2E_FULL       设为 1 时执行完整流程（dev 批准 + 轮询 succeeded）
#   E2E_ADMIN_PASSWORD  E2E_FULL=1 时必填
#
# 示例（本地）:
#   BACKEND_URL=http://localhost:3000 ./scripts/e2e-demo-verify.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export BACKEND_URL="${BACKEND_URL:-https://aegis-production-7cee.up.railway.app}"
export MCP_URL="${MCP_URL:-}"

echo "=== Aegis Demo Verification ==="
echo "Target: $BACKEND_URL"
echo ""

exec "$SCRIPT_DIR/e2e-verify.sh" "$BACKEND_URL" "$MCP_URL"
