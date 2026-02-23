#!/usr/bin/env bash
# Deploy Aegis backend to Vercel.
# Prerequisite: npx vercel login
# Usage: ./scripts/deploy-vercel.sh [--prod]

set -e

cd "$(dirname "$0")/.."

echo "Building..."
npm run build

echo "Deploying to Vercel..."
npx vercel "$@"

echo ""
echo "After deployment:"
echo "1. Set BASE_URL in Vercel Dashboard (Settings → Environment Variables)"
echo "2. Set CRON_SECRET (e.g. openssl rand -hex 32)"
echo "3. Redeploy if env vars were added"
echo "4. Run: ./scripts/verify-deployment.sh <YOUR_VERCEL_URL>"
