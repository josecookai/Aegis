#!/usr/bin/env bash
# Aegis 后端一键安装（AI Agent 友好）
# 用法: ./scripts/install-backend.sh 或 bash scripts/install-backend.sh
set -e
cd "$(dirname "$0")/.."
npm install
npm run dev
