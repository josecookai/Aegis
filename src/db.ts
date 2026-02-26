import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { sha256, randomId } from './lib/crypto';
import { nowIso } from './lib/time';

export interface DbContext {
  db: Database.Database;
}

export function createDb(dbPath: string): DbContext {
  if (dbPath !== ':memory:') {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }

  const db = new Database(dbPath);
  try {
    db.pragma('journal_mode = WAL');
  } catch {
    // Some serverless/runtime filesystems do not support WAL; continue with default mode.
  }
  db.pragma('foreign_keys = ON');

  migrate(db);
  seed(db);

  return { db };
}

function migrate(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      api_key_hash TEXT NOT NULL UNIQUE,
      webhook_secret TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS end_users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS teams (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS team_members (
      team_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin','member')),
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL,
      PRIMARY KEY (team_id, user_id),
      FOREIGN KEY (team_id) REFERENCES teams(id),
      FOREIGN KEY (user_id) REFERENCES end_users(id)
    );

    CREATE TABLE IF NOT EXISTS agent_user_links (
      agent_id TEXT NOT NULL,
      end_user_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (agent_id, end_user_id),
      FOREIGN KEY (agent_id) REFERENCES agents(id),
      FOREIGN KEY (end_user_id) REFERENCES end_users(id)
    );

    CREATE TABLE IF NOT EXISTS payment_methods (
      id TEXT PRIMARY KEY,
      end_user_id TEXT NOT NULL,
      rail TEXT NOT NULL,
      alias TEXT NOT NULL,
      external_token TEXT NOT NULL,
      metadata_json TEXT NOT NULL DEFAULT '{}',
      is_default INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY (end_user_id) REFERENCES end_users(id)
    );

    CREATE TABLE IF NOT EXISTS actions (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL,
      end_user_id TEXT NOT NULL,
      team_id TEXT,
      requested_by_user_id TEXT,
      approval_target_user_id TEXT,
      approval_policy TEXT,
      idempotency_key TEXT NOT NULL,
      action_type TEXT NOT NULL,
      status TEXT NOT NULL,
      status_reason TEXT,
      amount TEXT NOT NULL,
      currency TEXT NOT NULL,
      recipient_name TEXT NOT NULL,
      description TEXT NOT NULL,
      payment_rail TEXT NOT NULL,
      payment_method_preference TEXT NOT NULL,
      recipient_reference TEXT NOT NULL,
      callback_url TEXT,
      expires_at TEXT NOT NULL,
      metadata_json TEXT NOT NULL DEFAULT '{}',
      approved_at TEXT,
      denied_at TEXT,
      terminal_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (agent_id) REFERENCES agents(id),
      FOREIGN KEY (end_user_id) REFERENCES end_users(id),
      FOREIGN KEY (team_id) REFERENCES teams(id),
      UNIQUE(agent_id, idempotency_key)
    );

    CREATE TABLE IF NOT EXISTS decisions (
      id TEXT PRIMARY KEY,
      action_id TEXT NOT NULL UNIQUE,
      decision TEXT NOT NULL,
      source TEXT NOT NULL,
      actor_user_id TEXT NOT NULL,
      details_json TEXT NOT NULL DEFAULT '{}',
      submitted_at TEXT NOT NULL,
      FOREIGN KEY (action_id) REFERENCES actions(id),
      FOREIGN KEY (actor_user_id) REFERENCES end_users(id)
    );

    CREATE TABLE IF NOT EXISTS executions (
      id TEXT PRIMARY KEY,
      action_id TEXT NOT NULL UNIQUE,
      rail TEXT NOT NULL,
      status TEXT NOT NULL,
      provider TEXT,
      provider_reference TEXT,
      payment_id TEXT,
      tx_hash TEXT,
      error_code TEXT,
      error_message TEXT,
      attempts INTEGER NOT NULL DEFAULT 0,
      started_at TEXT,
      completed_at TEXT,
      result_json TEXT NOT NULL DEFAULT '{}',
      FOREIGN KEY (action_id) REFERENCES actions(id)
    );

    CREATE TABLE IF NOT EXISTS magic_links (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      action_id TEXT,
      token_hash TEXT NOT NULL UNIQUE,
      purpose TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      consumed_at TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES end_users(id),
      FOREIGN KEY (action_id) REFERENCES actions(id)
    );

    CREATE TABLE IF NOT EXISTS email_outbox (
      id TEXT PRIMARY KEY,
      to_email TEXT NOT NULL,
      subject TEXT NOT NULL,
      body_text TEXT NOT NULL,
      body_html TEXT,
      metadata_json TEXT NOT NULL DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'queued',
      created_at TEXT NOT NULL,
      sent_at TEXT
    );

    CREATE TABLE IF NOT EXISTS webhook_deliveries (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL UNIQUE,
      action_id TEXT NOT NULL,
      agent_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      callback_url TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      status TEXT NOT NULL,
      http_status INTEGER,
      attempts INTEGER NOT NULL DEFAULT 0,
      next_attempt_at TEXT,
      last_error TEXT,
      last_attempt_at TEXT,
      delivered_at TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (action_id) REFERENCES actions(id),
      FOREIGN KEY (agent_id) REFERENCES agents(id)
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action_id TEXT,
      event_type TEXT NOT NULL,
      actor_type TEXT NOT NULL,
      actor_id TEXT,
      payload_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      prev_hash TEXT,
      entry_hash TEXT NOT NULL,
      FOREIGN KEY (action_id) REFERENCES actions(id)
    );

    CREATE INDEX IF NOT EXISTS idx_actions_status ON actions(status);
    CREATE INDEX IF NOT EXISTS idx_actions_end_user ON actions(end_user_id);
    CREATE INDEX IF NOT EXISTS idx_actions_team ON actions(team_id);
    CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members(user_id);
    CREATE INDEX IF NOT EXISTS idx_webhooks_due ON webhook_deliveries(status, next_attempt_at);
    CREATE INDEX IF NOT EXISTS idx_magic_links_hash ON magic_links(token_hash);
    CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action_id);

    CREATE TABLE IF NOT EXISTS webauthn_credentials (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      credential_id TEXT NOT NULL UNIQUE,
      public_key_b64 TEXT NOT NULL,
      counter INTEGER NOT NULL DEFAULT 0,
      device_type TEXT NOT NULL,
      backed_up INTEGER NOT NULL DEFAULT 0,
      transports_json TEXT NOT NULL DEFAULT '[]',
      aaguid TEXT,
      created_at TEXT NOT NULL,
      last_used_at TEXT,
      FOREIGN KEY (user_id) REFERENCES end_users(id)
    );

    CREATE TABLE IF NOT EXISTS webauthn_challenges (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      action_id TEXT,
      purpose TEXT NOT NULL,
      challenge TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      consumed_at TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES end_users(id),
      FOREIGN KEY (action_id) REFERENCES actions(id)
    );

    CREATE INDEX IF NOT EXISTS idx_webauthn_credentials_user ON webauthn_credentials(user_id);
    CREATE INDEX IF NOT EXISTS idx_webauthn_challenges_user_purpose ON webauthn_challenges(user_id, purpose, created_at);

    CREATE TABLE IF NOT EXISTS devices (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      platform TEXT NOT NULL CHECK(platform IN ('ios', 'android')),
      push_token TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES end_users(id),
      UNIQUE(user_id, platform)
    );

    CREATE INDEX IF NOT EXISTS idx_devices_user ON devices(user_id);

    CREATE TABLE IF NOT EXISTS app_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES end_users(id)
    );
    CREATE INDEX IF NOT EXISTS idx_app_sessions_token ON app_sessions(token_hash);
    CREATE INDEX IF NOT EXISTS idx_app_sessions_user ON app_sessions(user_id);

    CREATE TABLE IF NOT EXISTS user_credentials (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      email_normalized TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      password_algo TEXT NOT NULL DEFAULT 'scrypt_v1',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      last_login_at TEXT,
      FOREIGN KEY (user_id) REFERENCES end_users(id)
    );
    CREATE INDEX IF NOT EXISTS idx_user_credentials_user ON user_credentials(user_id);

    CREATE TABLE IF NOT EXISTS oauth_identities (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      provider TEXT NOT NULL CHECK(provider IN ('google','github')),
      provider_user_id TEXT NOT NULL,
      email_normalized TEXT NOT NULL,
      email_verified INTEGER NOT NULL DEFAULT 0,
      profile_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES end_users(id),
      UNIQUE(provider, provider_user_id)
    );
    CREATE INDEX IF NOT EXISTS idx_oauth_identities_user ON oauth_identities(user_id);
    CREATE INDEX IF NOT EXISTS idx_oauth_identities_email ON oauth_identities(email_normalized);

    CREATE TABLE IF NOT EXISTS oauth_states (
      id TEXT PRIMARY KEY,
      provider TEXT NOT NULL CHECK(provider IN ('google','github')),
      state_hash TEXT NOT NULL UNIQUE,
      next_path TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      consumed_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_oauth_states_hash ON oauth_states(state_hash);

    CREATE TABLE IF NOT EXISTS plans (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      price_cents INTEGER NOT NULL DEFAULT 0,
      interval TEXT NOT NULL DEFAULT 'month',
      features_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_plans (
      user_id TEXT NOT NULL,
      plan_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL,
      PRIMARY KEY (user_id),
      FOREIGN KEY (user_id) REFERENCES end_users(id),
      FOREIGN KEY (plan_id) REFERENCES plans(id)
    );
  `);

  // Backfill columns for existing DBs created before team pilot fields existed.
  const actionColumns = db.prepare(`PRAGMA table_info(actions)`).all() as Array<{ name: string }>;
  const actionColNames = new Set(actionColumns.map((c) => c.name));
  const addActionColumn = (name: string, sqlType = 'TEXT') => {
    if (!actionColNames.has(name)) db.exec(`ALTER TABLE actions ADD COLUMN ${name} ${sqlType}`);
  };
  addActionColumn('team_id');
  addActionColumn('requested_by_user_id');
  addActionColumn('approval_target_user_id');
  addActionColumn('approval_policy');

  const agentColumns = db.prepare(`PRAGMA table_info(agents)`).all() as Array<{ name: string }>;
  const agentColNames = new Set(agentColumns.map((c) => c.name));
  if (!agentColNames.has('owner_user_id')) {
    db.exec('ALTER TABLE agents ADD COLUMN owner_user_id TEXT REFERENCES end_users(id)');
  }
}

function seed(db: Database.Database): void {
  const now = nowIso();

  const existingAgent = db
    .prepare('SELECT COUNT(1) as c FROM agents')
    .get() as { c: number };
  if (existingAgent.c === 0) {
    const demoApiKey = 'aegis_demo_agent_key';
    db.prepare(
      'INSERT INTO agents (id, name, api_key_hash, webhook_secret, status, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(
      'agt_demo',
      'Demo Agent',
      sha256(demoApiKey),
      'whsec_demo_agent',
      'active',
      now
    );
  }

  const existingUsers = db.prepare('SELECT COUNT(1) as c FROM end_users').get() as { c: number };
  if (existingUsers.c === 0) {
    db.prepare(
      'INSERT INTO end_users (id, email, display_name, status, created_at) VALUES (?, ?, ?, ?, ?)'
    ).run('usr_demo', 'demo.user@example.com', 'Demo User', 'active', now);
    for (let i = 1; i <= 10; i += 1) {
      const id = `usr_team_${String(i).padStart(2, '0')}`;
      db.prepare(
        'INSERT INTO end_users (id, email, display_name, status, created_at) VALUES (?, ?, ?, ?, ?)'
      ).run(id, `${id}@example.com`, `Team User ${i}`, 'active', now);
    }
    db.prepare(
      'INSERT INTO end_users (id, email, display_name, status, created_at) VALUES (?, ?, ?, ?, ?)'
    ).run('usr_team_admin', 'team.admin@example.com', 'Team Admin', 'active', now);
  }

  const teamCount = db.prepare('SELECT COUNT(1) as c FROM teams').get() as { c: number };
  if (teamCount.c === 0) {
    db.prepare('INSERT INTO teams (id, name, status, created_at) VALUES (?, ?, ?, ?)').run('team_demo_01', 'Demo Team 01', 'active', now);
  }

  const ensureMember = (userId: string, role: 'admin' | 'member') => {
    const exists = db
      .prepare('SELECT COUNT(1) as c FROM team_members WHERE team_id = ? AND user_id = ?')
      .get('team_demo_01', userId) as { c: number };
    if (exists.c === 0) {
      db.prepare('INSERT INTO team_members (team_id, user_id, role, status, created_at) VALUES (?, ?, ?, ?, ?)').run(
        'team_demo_01',
        userId,
        role,
        'active',
        now
      );
    }
  };
  ensureMember('usr_demo', 'member');
  ensureMember('usr_team_admin', 'admin');
  for (let i = 1; i <= 10; i += 1) ensureMember(`usr_team_${String(i).padStart(2, '0')}`, 'member');

  const linkCount = db
    .prepare('SELECT COUNT(1) as c FROM agent_user_links WHERE agent_id = ? AND end_user_id = ?')
    .get('agt_demo', 'usr_demo') as { c: number };
  if (linkCount.c === 0) {
    db.prepare('INSERT INTO agent_user_links (agent_id, end_user_id, created_at) VALUES (?, ?, ?)').run(
      'agt_demo',
      'usr_demo',
      now
    );
  }
  const extraUsers = ['usr_team_admin', ...Array.from({ length: 10 }, (_, i) => `usr_team_${String(i + 1).padStart(2, '0')}`)];
  for (const userId of extraUsers) {
    const c = db
      .prepare('SELECT COUNT(1) as c FROM agent_user_links WHERE agent_id = ? AND end_user_id = ?')
      .get('agt_demo', userId) as { c: number };
    if (c.c === 0) {
      db.prepare('INSERT INTO agent_user_links (agent_id, end_user_id, created_at) VALUES (?, ?, ?)').run('agt_demo', userId, now);
    }
  }

  const pmCount = db.prepare('SELECT COUNT(1) as c FROM payment_methods').get() as { c: number };
  if (pmCount.c === 0) {
    const stmt = db.prepare(
      'INSERT INTO payment_methods (id, end_user_id, rail, alias, external_token, metadata_json, is_default, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    );
    stmt.run(
      'pm_card_demo',
      'usr_demo',
      'card',
      'Visa **** 4242',
      'pm_tok_visa4242',
      JSON.stringify({ psp: 'mock_psp', brand: 'visa', last4: '4242' }),
      1,
      now
    );
    stmt.run(
      'pm_crypto_demo',
      'usr_demo',
      'crypto',
      'Base USDC Wallet',
      'wallet_demo_base_usdc',
      JSON.stringify({ provider: 'mock_mpc', chain: 'base', asset: 'USDC', address: '0x1111111111111111111111111111111111111111' }),
      1,
      now
    );
  }

  const execCount = db.prepare('SELECT COUNT(1) as c FROM executions').get() as { c: number };
  if (execCount.c === 0) {
    // no-op; reserved to ensure table exists in some environments
  }

  const planCount = db.prepare('SELECT COUNT(1) as c FROM plans').get() as { c: number };
  if (planCount.c === 0) {
    db.prepare(
      'INSERT INTO plans (id, name, slug, price_cents, interval, features_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run('plan_free', 'Free', 'free', 0, 'month', JSON.stringify({ actions_per_month: 10 }), now);
    db.prepare(
      'INSERT INTO plans (id, name, slug, price_cents, interval, features_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run('plan_pro', 'Pro', 'pro', 1999, 'month', JSON.stringify({ actions_per_month: 1000 }), now);
  }

  const userPlanCount = db.prepare('SELECT COUNT(1) as c FROM user_plans').get() as { c: number };
  if (userPlanCount.c === 0) {
    for (const userId of ['usr_demo', 'usr_team_admin', ...Array.from({ length: 10 }, (_, i) => `usr_team_${String(i + 1).padStart(2, '0')}`)]) {
      const exists = db.prepare('SELECT 1 FROM end_users WHERE id = ?').get(userId);
      if (exists) {
        db.prepare('INSERT OR IGNORE INTO user_plans (user_id, plan_id, status, created_at) VALUES (?, ?, ?, ?)').run(userId, 'plan_free', 'active', now);
      }
    }
  }

  const existingDocs = db.prepare('SELECT COUNT(1) as c FROM email_outbox').get() as { c: number };
  if (existingDocs.c === 0) {
    const demoWelcomeId = randomId('email');
    db.prepare(
      'INSERT INTO email_outbox (id, to_email, subject, body_text, metadata_json, status, created_at, sent_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(
      demoWelcomeId,
      'demo.user@example.com',
      'Aegis MVP ready',
      'Demo seed created. API key: aegis_demo_agent_key, end_user_id: usr_demo',
      JSON.stringify({ kind: 'seed_notice' }),
      'sent',
      now,
      now
    );
  }
}
