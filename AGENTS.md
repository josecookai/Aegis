# AGENTS.md

## Cursor Cloud specific instructions

### Overview

Aegis is an AI Agent Consumption Authorization Protocol — a payment authorization layer where AI agents submit payment requests via API and human users approve/deny them through web or mobile interfaces. The only **required** service is the **Backend API Server** (Node.js + Express + embedded SQLite). MCP Server, Mobile App (Expo), and TypeScript SDK are optional.

### Running the backend

```bash
npm run dev        # starts on http://localhost:3000
```

Health check: `GET /healthz` returns `{"ok":true, ...}`.

The backend uses an embedded SQLite database (no external DB process needed). Seed data is auto-created on startup: API key `aegis_demo_agent_key`, user `usr_demo`.

### Testing

```bash
npm test           # vitest run — 174 tests across 18 files
npm run build      # tsc — verifies TypeScript compilation
```

There is no separate lint command configured (no ESLint/Prettier in the project).

### Environment

Copy `.env.example` to `.env` before first run. Stripe keys and Google OAuth are optional — the backend falls back to mock payment providers and demo seed data without them.

Admin login password (for `/admin`, `/dev/*` routes): `aegis_admin_dev` (set via `ADMIN_PASSWORD` in `.env`).

### E2E verification

```bash
bash scripts/e2e-verify.sh                           # basic health + API test
E2E_FULL=1 E2E_ADMIN_PASSWORD=aegis_admin_dev bash scripts/e2e-verify.sh  # full flow with admin approve
```

### Key gotchas

- No lockfile exists — always use `npm install` (not `npm ci`).
- The project uses `"type": "commonjs"` — imports use CommonJS resolution.
- The `data/` directory is auto-created for SQLite DB; it is gitignored.
- Dev server (`npm run dev`) uses `tsx` for TypeScript execution — no build step needed for development.
- Optional services (MCP Server at `mcp-server/`, Mobile App at `app/`) each have their own `package.json` and require separate `npm install`.
