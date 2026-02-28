import Database from 'better-sqlite3';
import { assertTransition } from '../stateMachine';
import { hmacSha256Hex, randomId, sha256, safeJsonParse } from '../lib/crypto';
import { addMinutesIso, nowIso } from '../lib/time';
import {
  ActionApiResponse,
  ActionContext,
  ActionRecord,
  ActionStatus,
  AgentRecord,
  DecisionSource,
  EndUserRecord,
  ExecutionResult,
  PaymentMethodRecord,
  PaymentRail,
  RequestActionInput,
  WebhookEventType,
  WebhookPayload,
} from '../types';

export interface CreateActionOptions {
  agentId: string;
  input: RequestActionInput;
  defaultExpiryMinutes: number;
}

export interface TransitionActionOptions {
  actionId: string;
  to: ActionStatus;
  reason?: string | null;
}

export interface ResolvedMagicLink {
  magicLinkId: string;
  userId: string;
  actionId: string | null;
  purpose: string;
  expiresAt: string;
  consumedAt: string | null;
}

export interface WebhookDeliveryRecord {
  id: string;
  event_id: string;
  action_id: string;
  agent_id: string;
  event_type: WebhookEventType;
  callback_url: string;
  payload_json: string;
  status: 'pending' | 'delivered' | 'failed' | 'dead';
  http_status: number | null;
  attempts: number;
  next_attempt_at: string | null;
  last_error: string | null;
  last_attempt_at: string | null;
  delivered_at: string | null;
  created_at: string;
}

export interface ExecutionRecord {
  id: string;
  action_id: string;
  rail: PaymentRail;
  status: 'executing' | 'succeeded' | 'failed';
  provider: string | null;
  provider_reference: string | null;
  payment_id: string | null;
  tx_hash: string | null;
  error_code: string | null;
  error_message: string | null;
  attempts: number;
  started_at: string | null;
  completed_at: string | null;
  result_json: string;
}

export interface WebauthnCredentialRecord {
  id: string;
  user_id: string;
  credential_id: string;
  public_key_b64: string;
  counter: number;
  device_type: string;
  backed_up: number;
  transports_json: string;
  aaguid: string | null;
  created_at: string;
  last_used_at: string | null;
  transports: string[];
}

export interface WebauthnChallengeRecord {
  id: string;
  user_id: string;
  action_id: string | null;
  purpose: string;
  challenge: string;
  expires_at: string;
  consumed_at: string | null;
  created_at: string;
}

export interface DeviceRecord {
  id: string;
  user_id: string;
  platform: 'ios' | 'android';
  push_token: string;
  created_at: string;
  updated_at: string;
}

export interface RiskPolicyRecord {
  id: string;
  single_tx_limit_cents: number;
  daily_total_limit_cents: number;
  allowlist_enabled: number;
  updated_at: string;
}

export interface KeyRateLimitRecord {
  agent_id: string;
  requests_per_minute: number;
  updated_at: string;
}

export class AegisStore {
  constructor(private readonly db: Database.Database) {}

  getRawDb(): Database.Database {
    return this.db;
  }

  getAgentByApiKey(apiKey: string): AgentRecord | null {
    const hash = sha256(apiKey);
    const row = this.db.prepare('SELECT * FROM agents WHERE api_key_hash = ?').get(hash) as AgentRecord | undefined;
    return row ?? null;
  }

  getAgentById(agentId: string): AgentRecord | null {
    const row = this.db.prepare('SELECT * FROM agents WHERE id = ?').get(agentId) as AgentRecord | undefined;
    return row ?? null;
  }

  listAgents(): AgentRecord[] {
    return this.db.prepare('SELECT * FROM agents ORDER BY created_at DESC').all() as AgentRecord[];
  }

  setAgentStatus(agentId: string, status: 'active' | 'disabled'): boolean {
    const result = this.db.prepare('UPDATE agents SET status = ? WHERE id = ?').run(status, agentId);
    return result.changes > 0;
  }

  rotateAgentSecrets(agentId: string, nextApiKeyHash: string, nextWebhookSecret: string): boolean {
    const result = this.db
      .prepare('UPDATE agents SET api_key_hash = ?, webhook_secret = ? WHERE id = ?')
      .run(nextApiKeyHash, nextWebhookSecret, agentId);
    return result.changes > 0;
  }

  listAgentsByOwner(ownerUserId: string): AgentRecord[] {
    return this.db
      .prepare('SELECT * FROM agents WHERE owner_user_id = ? ORDER BY created_at DESC')
      .all(ownerUserId) as AgentRecord[];
  }

  insertAgent(name: string, apiKeyHash: string, webhookSecret: string, ownerUserId: string): AgentRecord {
    const id = randomId('agt');
    const now = nowIso();
    this.db
      .prepare(
        'INSERT INTO agents (id, name, api_key_hash, webhook_secret, status, owner_user_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
      )
      .run(id, name, apiKeyHash, webhookSecret, 'active', ownerUserId, now);
    return this.getAgentById(id)!;
  }

  deleteAgent(agentId: string, ownerUserId: string): boolean {
    const row = this.db.prepare('SELECT id FROM agents WHERE id = ? AND owner_user_id = ?').get(agentId, ownerUserId) as { id: string } | undefined;
    if (!row) return false;
    this.db.prepare('DELETE FROM agent_user_links WHERE agent_id = ?').run(agentId);
    this.db.prepare('DELETE FROM agents WHERE id = ?').run(agentId);
    return true;
  }

  linkAgentToUser(agentId: string, userId: string): void {
    const now = nowIso();
    this.db.prepare('INSERT OR IGNORE INTO agent_user_links (agent_id, end_user_id, created_at) VALUES (?, ?, ?)').run(agentId, userId, now);
  }

  listPlans(): Array<{ id: string; name: string; price_cents: number; interval: string; features_json: string }> {
    return this.db.prepare('SELECT id, name, price_cents, interval, features_json FROM plans ORDER BY price_cents ASC').all() as Array<{
      id: string;
      name: string;
      price_cents: number;
      interval: string;
      features_json: string;
    }>;
  }

  getUserPlan(userId: string): { plan_id: string; name: string; price_cents: number; interval: string; features_json: string } | null {
    const row = this.db
      .prepare(
        `SELECT p.id as plan_id, p.name, p.price_cents, p.interval, p.features_json
         FROM user_plans up JOIN plans p ON up.plan_id = p.id
         WHERE up.end_user_id = ?`
      )
      .get(userId) as { plan_id: string; name: string; price_cents: number; interval: string; features_json: string } | undefined;
    return row ?? null;
  }

  setUserPlan(userId: string, planId: string): void {
    const now = nowIso();
    this.db.prepare('DELETE FROM user_plans WHERE end_user_id = ?').run(userId);
    this.db.prepare('INSERT INTO user_plans (end_user_id, plan_id, created_at) VALUES (?, ?, ?)').run(userId, planId, now);
  }

  getEndUserById(userId: string): EndUserRecord | null {
    const row = this.db.prepare('SELECT * FROM end_users WHERE id = ?').get(userId) as EndUserRecord | undefined;
    return row ?? null;
  }

  getEndUserByEmail(email: string): EndUserRecord | null {
    const row = this.db.prepare('SELECT * FROM end_users WHERE email = ?').get(email.trim().toLowerCase()) as EndUserRecord | undefined;
    return row ?? null;
  }

  createEndUser(email: string, displayName: string): EndUserRecord {
    const id = randomId('usr');
    const now = nowIso();
    this.db
      .prepare('INSERT INTO end_users (id, email, display_name, status, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(id, email.trim().toLowerCase(), displayName || email.split('@')[0], 'active', now);
    return this.getEndUserById(id)!;
  }

  resolveApprovalMagicLinkContext(rawToken: string): { userId: string; actionId: string } | null {
    const resolved = this.resolveMagicLink(rawToken);
    if (!resolved || resolved.purpose !== 'approval' || !resolved.actionId) return null;
    return { userId: resolved.userId, actionId: resolved.actionId };
  }

  listEndUsers(): EndUserRecord[] {
    return this.db.prepare('SELECT * FROM end_users ORDER BY created_at DESC').all() as EndUserRecord[];
  }

  isAgentLinkedToUser(agentId: string, userId: string): boolean {
    const row = this.db
      .prepare('SELECT 1 as ok FROM agent_user_links WHERE agent_id = ? AND end_user_id = ?')
      .get(agentId, userId) as { ok: number } | undefined;
    return Boolean(row?.ok);
  }

  listPaymentMethodsForUser(userId: string): PaymentMethodRecord[] {
    return this.db
      .prepare('SELECT * FROM payment_methods WHERE end_user_id = ? ORDER BY is_default DESC, created_at ASC')
      .all(userId) as PaymentMethodRecord[];
  }

  updatePaymentMethod(pmId: string, externalToken: string, alias: string, metadataJson: string): void {
    this.db.prepare(
      'UPDATE payment_methods SET external_token = ?, alias = ?, metadata_json = ? WHERE id = ?'
    ).run(externalToken, alias, metadataJson, pmId);
  }

  insertPaymentMethod(userId: string, rail: string, alias: string, externalToken: string, metadataJson: string): string {
    const id = `pm_${randomId('pm').slice(-12)}`;
    this.db.prepare('UPDATE payment_methods SET is_default = 0 WHERE end_user_id = ? AND rail = ?').run(userId, rail);
    this.db.prepare(
      'INSERT INTO payment_methods (id, end_user_id, rail, alias, external_token, metadata_json, is_default, created_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?)'
    ).run(id, userId, rail, alias, externalToken, metadataJson, nowIso());
    return id;
  }

  getPaymentMethodById(pmId: string): PaymentMethodRecord | null {
    const row = this.db.prepare('SELECT * FROM payment_methods WHERE id = ?').get(pmId) as PaymentMethodRecord | undefined;
    return row ?? null;
  }

  deletePaymentMethod(pmId: string, userId: string): boolean {
    const row = this.db.prepare('SELECT id FROM payment_methods WHERE id = ? AND end_user_id = ?').get(pmId, userId) as { id: string } | undefined;
    if (!row) return false;
    this.db.prepare('DELETE FROM payment_methods WHERE id = ?').run(pmId);
    const remaining = this.db.prepare('SELECT id FROM payment_methods WHERE end_user_id = ? AND rail = ? ORDER BY is_default DESC, created_at ASC LIMIT 1').get(userId, 'card') as { id: string } | undefined;
    if (remaining) {
      this.db.prepare('UPDATE payment_methods SET is_default = 1 WHERE id = ?').run(remaining.id);
    }
    return true;
  }

  setDefaultPaymentMethod(pmId: string, userId: string): boolean {
    const row = this.db.prepare('SELECT id FROM payment_methods WHERE id = ? AND end_user_id = ? AND rail = ?').get(pmId, userId, 'card') as { id: string } | undefined;
    if (!row) return false;
    this.db.prepare('UPDATE payment_methods SET is_default = 0 WHERE end_user_id = ? AND rail = ?').run(userId, 'card');
    this.db.prepare('UPDATE payment_methods SET is_default = 1 WHERE id = ?').run(pmId);
    return true;
  }

  getPreferredPaymentMethod(userId: string, rail: PaymentRail, preference: string): PaymentMethodRecord | null {
    if (preference && preference !== 'card_default' && preference !== 'crypto_default') {
      const byId = this.db
        .prepare('SELECT * FROM payment_methods WHERE end_user_id = ? AND id = ? AND rail = ?')
        .get(userId, preference, rail) as PaymentMethodRecord | undefined;
      if (byId) return byId;
    }

    const row = this.db
      .prepare('SELECT * FROM payment_methods WHERE end_user_id = ? AND rail = ? ORDER BY is_default DESC, created_at ASC LIMIT 1')
      .get(userId, rail) as PaymentMethodRecord | undefined;
    return row ?? null;
  }

  findActionByAgentAndIdempotency(agentId: string, idempotencyKey: string): ActionRecord | null {
    const row = this.db
      .prepare('SELECT * FROM actions WHERE agent_id = ? AND idempotency_key = ?')
      .get(agentId, idempotencyKey) as ActionRecord | undefined;
    return row ?? null;
  }

  createAction(opts: CreateActionOptions): ActionRecord {
    const now = nowIso();
    const actionId = randomId('act');
    const expiresAt = opts.input.expires_at && !Number.isNaN(Date.parse(opts.input.expires_at))
      ? new Date(opts.input.expires_at).toISOString()
      : addMinutesIso(now, opts.defaultExpiryMinutes);

    const tx = this.db.transaction(() => {
      this.db
        .prepare(
          `INSERT INTO actions (
            id, agent_id, end_user_id, idempotency_key, action_type, status, status_reason,
            amount, currency, recipient_name, description, payment_rail, payment_method_preference, recipient_reference,
            callback_url, expires_at, metadata_json, approved_at, denied_at, terminal_at, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          actionId,
          opts.agentId,
          opts.input.end_user_id,
          opts.input.idempotency_key,
          'payment',
          'received',
          null,
          opts.input.details.amount,
          opts.input.details.currency,
          opts.input.details.recipient_name,
          opts.input.details.description,
          opts.input.details.payment_rail,
          opts.input.details.payment_method_preference,
          opts.input.details.recipient_reference,
          opts.input.callback_url ?? null,
          expiresAt,
          JSON.stringify(opts.input.metadata ?? {}),
          null,
          null,
          null,
          now,
          now
        );

      this.appendAuditLogInternal({
        actionId,
        eventType: 'action.received',
        actorType: 'agent',
        actorId: opts.agentId,
        payload: {
          idempotency_key: opts.input.idempotency_key,
          rail: opts.input.details.payment_rail,
          amount: opts.input.details.amount,
          currency: opts.input.details.currency,
        },
      });
    });

    tx();
    const row = this.getActionById(actionId);
    if (!row) throw new Error('Failed to create action');
    return row;
  }

  getActionById(actionId: string): ActionRecord | null {
    const row = this.db.prepare('SELECT * FROM actions WHERE id = ?').get(actionId) as ActionRecord | undefined;
    return row ?? null;
  }

  listActions(limit = 100): ActionRecord[] {
    return this.db
      .prepare('SELECT * FROM actions ORDER BY datetime(created_at) DESC LIMIT ?')
      .all(limit) as ActionRecord[];
  }

  listActionsByStatus(status: ActionStatus, limit = 100): ActionRecord[] {
    return this.db
      .prepare('SELECT * FROM actions WHERE status = ? ORDER BY datetime(updated_at) ASC LIMIT ?')
      .all(status, limit) as ActionRecord[];
  }

  listActionsByUserAndStatus(userId: string, status: ActionStatus, limit = 100): ActionRecord[] {
    return this.db
      .prepare('SELECT * FROM actions WHERE end_user_id = ? AND status = ? ORDER BY datetime(created_at) DESC LIMIT ?')
      .all(userId, status, limit) as ActionRecord[];
  }

  listActionsByUser(userId: string, limit = 50, offset = 0): { rows: ActionRecord[]; total: number } {
    const total = (this.db
      .prepare('SELECT COUNT(1) as c FROM actions WHERE end_user_id = ?')
      .get(userId) as { c: number }).c;
    const rows = this.db
      .prepare('SELECT * FROM actions WHERE end_user_id = ? ORDER BY datetime(created_at) DESC LIMIT ? OFFSET ?')
      .all(userId, limit, offset) as ActionRecord[];
    return { rows, total };
  }

  listActionsForAdmin(opts: { limit?: number; offset?: number; status?: ActionStatus; userId?: string } = {}): {
    rows: ActionRecord[];
    total: number;
  } {
    const limit = opts.limit ?? 50;
    const offset = opts.offset ?? 0;
    const where: string[] = [];
    const params: Array<string | number> = [];

    if (opts.status) {
      where.push('status = ?');
      params.push(opts.status);
    }
    if (opts.userId) {
      where.push('end_user_id = ?');
      params.push(opts.userId);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const total = (this.db.prepare(`SELECT COUNT(1) as c FROM actions ${whereSql}`).get(...params) as { c: number }).c;
    const rows = this.db
      .prepare(`SELECT * FROM actions ${whereSql} ORDER BY datetime(created_at) DESC LIMIT ? OFFSET ?`)
      .all(...params, limit, offset) as ActionRecord[];
    return { rows, total };
  }

  getRiskPolicy(): RiskPolicyRecord {
    const row = this.db.prepare('SELECT * FROM risk_policies WHERE id = ?').get('global') as RiskPolicyRecord | undefined;
    if (!row) throw new Error('Risk policy not initialized');
    return row;
  }

  updateRiskPolicy(input: { singleTxLimitCents: number; dailyTotalLimitCents: number; allowlistEnabled: boolean }): RiskPolicyRecord {
    const now = nowIso();
    this.db
      .prepare(
        'UPDATE risk_policies SET single_tx_limit_cents = ?, daily_total_limit_cents = ?, allowlist_enabled = ?, updated_at = ? WHERE id = ?'
      )
      .run(input.singleTxLimitCents, input.dailyTotalLimitCents, input.allowlistEnabled ? 1 : 0, now, 'global');
    return this.getRiskPolicy();
  }

  listRecipientAllowlist(): Array<{ recipient_reference: string; created_at: string }> {
    return this.db
      .prepare('SELECT recipient_reference, created_at FROM recipient_allowlist ORDER BY created_at ASC')
      .all() as Array<{ recipient_reference: string; created_at: string }>;
  }

  replaceRecipientAllowlist(recipientReferences: string[]): Array<{ recipient_reference: string; created_at: string }> {
    const now = nowIso();
    const unique = Array.from(new Set(recipientReferences.map((r) => r.trim()).filter(Boolean)));
    const tx = this.db.transaction(() => {
      this.db.prepare('DELETE FROM recipient_allowlist').run();
      const stmt = this.db.prepare('INSERT INTO recipient_allowlist (recipient_reference, created_at) VALUES (?, ?)');
      for (const ref of unique) {
        stmt.run(ref, now);
      }
    });
    tx();
    return this.listRecipientAllowlist();
  }

  getKeyRateLimit(agentId: string): KeyRateLimitRecord | null {
    const row = this.db
      .prepare('SELECT agent_id, requests_per_minute, updated_at FROM key_rate_limits WHERE agent_id = ?')
      .get(agentId) as KeyRateLimitRecord | undefined;
    return row ?? null;
  }

  setKeyRateLimit(agentId: string, requestsPerMinute: number): KeyRateLimitRecord {
    const now = nowIso();
    this.db
      .prepare(
        `INSERT INTO key_rate_limits (agent_id, requests_per_minute, updated_at)
         VALUES (?, ?, ?)
         ON CONFLICT(agent_id) DO UPDATE SET requests_per_minute=excluded.requests_per_minute, updated_at=excluded.updated_at`
      )
      .run(agentId, requestsPerMinute, now);
    return this.getKeyRateLimit(agentId)!;
  }

  transitionActionStatus(opts: TransitionActionOptions): ActionRecord {
    const now = nowIso();
    const tx = this.db.transaction(() => {
      const current = this.getActionById(opts.actionId);
      if (!current) {
        throw new Error(`Action not found: ${opts.actionId}`);
      }
      assertTransition(current.status, opts.to);

      let approvedAt = current.approved_at;
      let deniedAt = current.denied_at;
      let terminalAt = current.terminal_at;
      if (opts.to === 'approved') approvedAt = now;
      if (opts.to === 'denied') deniedAt = now;
      if (['validation_failed', 'denied', 'expired', 'succeeded', 'failed', 'canceled'].includes(opts.to)) {
        terminalAt = now;
      }

      this.db
        .prepare(
          `UPDATE actions SET status = ?, status_reason = ?, approved_at = ?, denied_at = ?, terminal_at = ?, updated_at = ? WHERE id = ?`
        )
        .run(opts.to, opts.reason ?? null, approvedAt, deniedAt, terminalAt, now, opts.actionId);

      this.appendAuditLogInternal({
        actionId: opts.actionId,
        eventType: `action.${opts.to}`,
        actorType: 'system',
        actorId: null,
        payload: { reason: opts.reason ?? null },
      });
    });

    tx();
    const next = this.getActionById(opts.actionId);
    if (!next) throw new Error('Action missing after status transition');
    return next;
  }

  setActionStatusUnsafe(actionId: string, to: ActionStatus, reason?: string | null): ActionRecord {
    const now = nowIso();
    this.db
      .prepare('UPDATE actions SET status = ?, status_reason = ?, updated_at = ? WHERE id = ?')
      .run(to, reason ?? null, now, actionId);
    const row = this.getActionById(actionId);
    if (!row) throw new Error('Action not found after unsafe update');
    return row;
  }

  createDecision(actionId: string, actorUserId: string, decision: 'approved' | 'denied', source: DecisionSource, details: Record<string, unknown> = {}): void {
    const now = nowIso();
    this.db.transaction(() => {
      const exists = this.db.prepare('SELECT id FROM decisions WHERE action_id = ?').get(actionId) as { id: string } | undefined;
      if (exists) throw new Error('Decision already recorded for action');
      this.db
        .prepare(
          'INSERT INTO decisions (id, action_id, decision, source, actor_user_id, details_json, submitted_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
        )
        .run(randomId('dec'), actionId, decision, source, actorUserId, JSON.stringify(details), now);
      this.appendAuditLogInternal({
        actionId,
        eventType: `decision.${decision}`,
        actorType: 'end_user',
        actorId: actorUserId,
        payload: { source },
      });
    })();
  }

  /**
   * Atomically records a decision AND transitions the action status in one
   * SQLite transaction, optionally consuming a magic link. Prevents the
   * TOCTOU race where two concurrent requests could both pass the
   * "awaiting_approval" check before either commits.
   */
  createDecisionAndTransition(opts: {
    actionId: string;
    actorUserId: string;
    decision: 'approved' | 'denied';
    source: DecisionSource;
    details?: Record<string, unknown>;
    consumeMagicLinkId?: string | null;
  }): ActionRecord {
    const now = nowIso();
    const tx = this.db.transaction(() => {
      const current = this.getActionById(opts.actionId);
      if (!current) throw new Error(`Action not found: ${opts.actionId}`);
      assertTransition(current.status, opts.decision);

      const existingDec = this.db.prepare('SELECT id FROM decisions WHERE action_id = ?').get(opts.actionId) as { id: string } | undefined;
      if (existingDec) throw new Error('Decision already recorded for action');

      this.db
        .prepare('INSERT INTO decisions (id, action_id, decision, source, actor_user_id, details_json, submitted_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(randomId('dec'), opts.actionId, opts.decision, opts.source, opts.actorUserId, JSON.stringify(opts.details ?? {}), now);
      this.appendAuditLogInternal({
        actionId: opts.actionId,
        eventType: `decision.${opts.decision}`,
        actorType: 'end_user',
        actorId: opts.actorUserId,
        payload: { source: opts.source },
      });

      let approvedAt = current.approved_at;
      let deniedAt = current.denied_at;
      let terminalAt = current.terminal_at;
      if (opts.decision === 'approved') approvedAt = now;
      if (opts.decision === 'denied') { deniedAt = now; terminalAt = now; }

      this.db
        .prepare('UPDATE actions SET status = ?, status_reason = ?, approved_at = ?, denied_at = ?, terminal_at = ?, updated_at = ? WHERE id = ?')
        .run(opts.decision, null, approvedAt, deniedAt, terminalAt, now, opts.actionId);
      this.appendAuditLogInternal({
        actionId: opts.actionId,
        eventType: `action.${opts.decision}`,
        actorType: 'system',
        actorId: null,
        payload: { reason: null },
      });

      if (opts.consumeMagicLinkId) {
        this.db.prepare('UPDATE magic_links SET consumed_at = COALESCE(consumed_at, ?) WHERE id = ?').run(now, opts.consumeMagicLinkId);
      }
    });

    tx();
    const next = this.getActionById(opts.actionId);
    if (!next) throw new Error('Action missing after atomic decision+transition');
    return next;
  }

  getDecisionByActionId(actionId: string): { decision: 'approved' | 'denied'; source: DecisionSource; submitted_at: string } | null {
    const row = this.db
      .prepare('SELECT decision, source, submitted_at FROM decisions WHERE action_id = ?')
      .get(actionId) as { decision: 'approved' | 'denied'; source: DecisionSource; submitted_at: string } | undefined;
    return row ?? null;
  }

  createMagicLink(userId: string, actionId: string | null, purpose: 'approval' | 'login', expiresAt: string): { magicLinkId: string; token: string } {
    const token = randomId('mltok');
    const tokenHash = sha256(token);
    const magicLinkId = randomId('mlink');
    this.db.prepare(
      'INSERT INTO magic_links (id, user_id, action_id, token_hash, purpose, expires_at, consumed_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(magicLinkId, userId, actionId, tokenHash, purpose, expiresAt, null, nowIso());
    return { magicLinkId, token };
  }

  createAppSession(endUserId: string, ttlMinutes: number): { sessionId: string; token: string } {
    const token = randomId('sess');
    const tokenHash = sha256(token);
    const sessionId = randomId('asess');
    const now = nowIso();
    const expiresAt = addMinutesIso(now, ttlMinutes);
    this.db
      .prepare(
        'INSERT INTO app_sessions (id, end_user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)'
      )
      .run(sessionId, endUserId, tokenHash, expiresAt, now);
    return { sessionId, token };
  }

  findAppSessionByToken(token: string): { sessionId: string; endUserId: string } | null {
    const tokenHash = sha256(token);
    const row = this.db
      .prepare(
        'SELECT id, end_user_id FROM app_sessions WHERE token_hash = ? AND datetime(expires_at) > datetime(?)'
      )
      .get(tokenHash, nowIso()) as { id: string; end_user_id: string } | undefined;
    if (!row) return null;
    return { sessionId: row.id, endUserId: row.end_user_id };
  }

  invalidateAppSession(sessionId: string): void {
    this.db.prepare('DELETE FROM app_sessions WHERE id = ?').run(sessionId);
  }

  createWebauthnChallenge(opts: { userId: string; actionId: string | null; purpose: string; challenge: string; expiresAt: string }): WebauthnChallengeRecord {
    const id = randomId('wchal');
    const now = nowIso();
    this.db
      .prepare(
        'INSERT INTO webauthn_challenges (id, user_id, action_id, purpose, challenge, expires_at, consumed_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      )
      .run(id, opts.userId, opts.actionId, opts.purpose, opts.challenge, opts.expiresAt, null, now);
    const row = this.db.prepare('SELECT * FROM webauthn_challenges WHERE id = ?').get(id) as WebauthnChallengeRecord;
    return row;
  }

  getLatestActiveWebauthnChallenge(userId: string, purpose: string, actionId?: string | null): WebauthnChallengeRecord | null {
    const args: unknown[] = [userId, purpose];
    let sql =
      `SELECT * FROM webauthn_challenges
       WHERE user_id = ? AND purpose = ? AND consumed_at IS NULL AND datetime(expires_at) > datetime('now')`;
    if (actionId !== undefined) {
      sql += ' AND action_id IS ?';
      args.push(actionId);
    }
    sql += ' ORDER BY datetime(created_at) DESC LIMIT 1';
    const row = this.db.prepare(sql).get(...args) as WebauthnChallengeRecord | undefined;
    return row ?? null;
  }

  consumeWebauthnChallenge(challengeId: string): void {
    this.db.prepare('UPDATE webauthn_challenges SET consumed_at = COALESCE(consumed_at, ?) WHERE id = ?').run(nowIso(), challengeId);
  }

  listPasskeysForUser(userId: string): WebauthnCredentialRecord[] {
    const rows = this.db
      .prepare('SELECT * FROM webauthn_credentials WHERE user_id = ? ORDER BY datetime(created_at) DESC')
      .all(userId) as Array<Omit<WebauthnCredentialRecord, 'transports'>>;
    return rows.map((r) => ({ ...r, transports: safeJsonParse<string[]>(r.transports_json, []) }));
  }

  countPasskeysForUser(userId: string): number {
    const row = this.db.prepare('SELECT COUNT(1) as c FROM webauthn_credentials WHERE user_id = ?').get(userId) as { c: number };
    return row.c;
  }

  getPasskeyByCredentialId(credentialId: string): WebauthnCredentialRecord | null {
    const row = this.db
      .prepare('SELECT * FROM webauthn_credentials WHERE credential_id = ?')
      .get(credentialId) as Omit<WebauthnCredentialRecord, 'transports'> | undefined;
    return row ? { ...row, transports: safeJsonParse<string[]>(row.transports_json, []) } : null;
  }

  upsertPasskeyCredential(opts: {
    userId: string;
    credentialId: string;
    publicKeyB64: string;
    counter: number;
    deviceType: string;
    backedUp: boolean;
    transports: string[];
    aaguid?: string | null;
    createdAt: string;
  }): void {
    this.db
      .prepare(
        `INSERT INTO webauthn_credentials
         (id, user_id, credential_id, public_key_b64, counter, device_type, backed_up, transports_json, aaguid, created_at, last_used_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(credential_id) DO UPDATE SET
           user_id=excluded.user_id,
           public_key_b64=excluded.public_key_b64,
           counter=excluded.counter,
           device_type=excluded.device_type,
           backed_up=excluded.backed_up,
           transports_json=excluded.transports_json,
           aaguid=excluded.aaguid`
      )
      .run(
        randomId('wcred'),
        opts.userId,
        opts.credentialId,
        opts.publicKeyB64,
        opts.counter,
        opts.deviceType,
        opts.backedUp ? 1 : 0,
        JSON.stringify(opts.transports ?? []),
        opts.aaguid ?? null,
        opts.createdAt,
        null
      );
  }

  updatePasskeyCounterAndUsage(id: string, newCounter: number): void {
    this.db.prepare('UPDATE webauthn_credentials SET counter = ?, last_used_at = ? WHERE id = ?').run(newCounter, nowIso(), id);
  }

  resolveMagicLink(rawToken: string): ResolvedMagicLink | null {
    const tokenHash = sha256(rawToken);
    const row = this.db
      .prepare('SELECT id, user_id, action_id, purpose, expires_at, consumed_at FROM magic_links WHERE token_hash = ?')
      .get(tokenHash) as {
      id: string;
      user_id: string;
      action_id: string | null;
      purpose: string;
      expires_at: string;
      consumed_at: string | null;
    } | undefined;
    if (!row) return null;
    return {
      magicLinkId: row.id,
      userId: row.user_id,
      actionId: row.action_id,
      purpose: row.purpose,
      expiresAt: row.expires_at,
      consumedAt: row.consumed_at,
    };
  }

  consumeMagicLink(magicLinkId: string): void {
    this.db.prepare('UPDATE magic_links SET consumed_at = COALESCE(consumed_at, ?) WHERE id = ?').run(nowIso(), magicLinkId);
  }

  queueEmail(toEmail: string, subject: string, bodyText: string, bodyHtml: string | null, metadata: Record<string, unknown>): string {
    const id = randomId('email');
    const now = nowIso();
    this.db
      .prepare(
        'INSERT INTO email_outbox (id, to_email, subject, body_text, body_html, metadata_json, status, created_at, sent_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
      )
      .run(id, toEmail, subject, bodyText, bodyHtml, JSON.stringify(metadata), 'sent', now, now);
    return id;
  }

  listEmailOutbox(limit = 50): Array<Record<string, unknown>> {
    return this.db
      .prepare('SELECT * FROM email_outbox ORDER BY datetime(created_at) DESC LIMIT ?')
      .all(limit) as Array<Record<string, unknown>>;
  }

  appendAuditLog(actionId: string | null, eventType: string, actorType: string, actorId: string | null, payload: Record<string, unknown>): void {
    this.appendAuditLogInternal({ actionId, eventType, actorType, actorId, payload });
  }

  private appendAuditLogInternal(opts: { actionId: string | null; eventType: string; actorType: string; actorId: string | null; payload: Record<string, unknown> }): void {
    const now = nowIso();
    const prev = this.db.prepare('SELECT entry_hash FROM audit_logs ORDER BY id DESC LIMIT 1').get() as { entry_hash: string } | undefined;
    const serializedPayload = JSON.stringify(opts.payload);
    const toHash = JSON.stringify({
      action_id: opts.actionId,
      event_type: opts.eventType,
      actor_type: opts.actorType,
      actor_id: opts.actorId,
      payload: opts.payload,
      created_at: now,
      prev_hash: prev?.entry_hash ?? null,
    });
    const entryHash = hmacSha256Hex('aegis_audit_chain', toHash);
    this.db
      .prepare(
        'INSERT INTO audit_logs (action_id, event_type, actor_type, actor_id, payload_json, created_at, prev_hash, entry_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      )
      .run(opts.actionId, opts.eventType, opts.actorType, opts.actorId, serializedPayload, now, prev?.entry_hash ?? null, entryHash);
  }

  listAuditLogsForAction(actionId: string): Array<Record<string, unknown>> {
    return this.db
      .prepare('SELECT * FROM audit_logs WHERE action_id = ? ORDER BY id ASC')
      .all(actionId) as Array<Record<string, unknown>>;
  }

  countAuditLogsForAction(actionId: string): number {
    const row = this.db
      .prepare('SELECT COUNT(1) as c FROM audit_logs WHERE action_id = ?')
      .get(actionId) as { c: number };
    return row.c;
  }

  createOrUpdateExecutionStart(actionId: string, rail: PaymentRail): void {
    const existing = this.getExecutionByActionId(actionId);
    const now = nowIso();
    if (!existing) {
      this.db
        .prepare(
          'INSERT INTO executions (id, action_id, rail, status, attempts, started_at, result_json) VALUES (?, ?, ?, ?, ?, ?, ?)'
        )
        .run(randomId('exe'), actionId, rail, 'executing', 1, now, '{}');
    } else {
      this.db
        .prepare(
          'UPDATE executions SET rail = ?, status = ?, attempts = attempts + 1, started_at = COALESCE(started_at, ?), completed_at = NULL WHERE action_id = ?'
        )
        .run(rail, 'executing', now, actionId);
    }
    this.appendAuditLogInternal({
      actionId,
      eventType: 'execution.started',
      actorType: 'system',
      actorId: null,
      payload: { rail },
    });
  }

  completeExecution(actionId: string, result: ExecutionResult): void {
    const now = nowIso();
    const status = result.success ? 'succeeded' : 'failed';
    this.db
      .prepare(
        `UPDATE executions
         SET status = ?, provider = ?, provider_reference = ?, payment_id = ?, tx_hash = ?,
             error_code = ?, error_message = ?, completed_at = ?, result_json = ?
         WHERE action_id = ?`
      )
      .run(
        status,
        result.provider,
        result.providerReference ?? null,
        result.paymentId ?? null,
        result.txHash ?? null,
        result.errorCode ?? null,
        result.errorMessage ?? null,
        now,
        JSON.stringify(result.raw ?? {}),
        actionId
      );
    this.appendAuditLogInternal({
      actionId,
      eventType: `execution.${status}`,
      actorType: 'system',
      actorId: null,
      payload: {
        rail: result.rail,
        provider: result.provider,
        provider_reference: result.providerReference ?? null,
        tx_hash: result.txHash ?? null,
        payment_id: result.paymentId ?? null,
        error_code: result.errorCode ?? null,
      },
    });
  }

  getExecutionByActionId(actionId: string): ExecutionRecord | null {
    const row = this.db.prepare('SELECT * FROM executions WHERE action_id = ?').get(actionId) as ExecutionRecord | undefined;
    return row ?? null;
  }

  queueWebhookDelivery(agentId: string, actionId: string, eventType: WebhookEventType, callbackUrl: string, payload: WebhookPayload): WebhookDeliveryRecord {
    const now = nowIso();
    const id = randomId('whd');
    this.db
      .prepare(
        'INSERT INTO webhook_deliveries (id, event_id, action_id, agent_id, event_type, callback_url, payload_json, status, http_status, attempts, next_attempt_at, last_error, last_attempt_at, delivered_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      )
      .run(
        id,
        payload.event_id,
        actionId,
        agentId,
        eventType,
        callbackUrl,
        JSON.stringify(payload),
        'pending',
        null,
        0,
        now,
        null,
        null,
        null,
        now
      );
    this.appendAuditLogInternal({
      actionId,
      eventType: 'webhook.queued',
      actorType: 'system',
      actorId: null,
      payload: { event_type: eventType, event_id: payload.event_id, callback_url: callbackUrl },
    });
    const row = this.db.prepare('SELECT * FROM webhook_deliveries WHERE id = ?').get(id) as WebhookDeliveryRecord;
    return row;
  }

  listDueWebhookDeliveries(limit = 25): WebhookDeliveryRecord[] {
    const now = nowIso();
    return this.db
      .prepare(
        `SELECT * FROM webhook_deliveries
         WHERE status = 'pending' AND (next_attempt_at IS NULL OR datetime(next_attempt_at) <= datetime(?))
         ORDER BY datetime(created_at) ASC
         LIMIT ?`
      )
      .all(now, limit) as WebhookDeliveryRecord[];
  }

  listWebhookDeliveries(filters?: { actionId?: string; status?: string; limit?: number }): WebhookDeliveryRecord[] {
    const where: string[] = [];
    const args: unknown[] = [];
    if (filters?.actionId) {
      where.push('action_id = ?');
      args.push(filters.actionId);
    }
    if (filters?.status) {
      where.push('status = ?');
      args.push(filters.status);
    }
    const sql = `SELECT * FROM webhook_deliveries ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY datetime(created_at) DESC LIMIT ?`;
    args.push(filters?.limit ?? 100);
    return this.db.prepare(sql).all(...args) as WebhookDeliveryRecord[];
  }

  getWebhookDeliveryById(deliveryId: string): WebhookDeliveryRecord | null {
    const row = this.db.prepare('SELECT * FROM webhook_deliveries WHERE id = ?').get(deliveryId) as WebhookDeliveryRecord | undefined;
    return row ?? null;
  }

  requeueWebhookDelivery(deliveryId: string): void {
    const now = nowIso();
    this.db
      .prepare(
        `UPDATE webhook_deliveries
         SET status = 'pending', next_attempt_at = ?, last_error = NULL
         WHERE id = ?`
      )
      .run(now, deliveryId);
    const delivery = this.db
      .prepare('SELECT action_id, event_id, event_type FROM webhook_deliveries WHERE id = ?')
      .get(deliveryId) as { action_id: string; event_id: string; event_type: string } | undefined;
    if (delivery) {
      this.appendAuditLogInternal({
        actionId: delivery.action_id,
        eventType: 'webhook.requeued',
        actorType: 'system',
        actorId: null,
        payload: { delivery_id: deliveryId, event_id: delivery.event_id, event_type: delivery.event_type },
      });
    }
  }

  markWebhookDelivered(deliveryId: string, httpStatus: number): void {
    const now = nowIso();
    this.db
      .prepare(
        `UPDATE webhook_deliveries
         SET status = 'delivered', http_status = ?, attempts = attempts + 1, delivered_at = ?, last_attempt_at = ?, next_attempt_at = NULL
         WHERE id = ?`
      )
      .run(httpStatus, now, now, deliveryId);

    const delivery = this.db.prepare('SELECT action_id, event_type, event_id FROM webhook_deliveries WHERE id = ?').get(deliveryId) as {
      action_id: string;
      event_type: string;
      event_id: string;
    };
    this.appendAuditLogInternal({
      actionId: delivery.action_id,
      eventType: 'webhook.delivered',
      actorType: 'system',
      actorId: null,
      payload: { event_type: delivery.event_type, event_id: delivery.event_id, http_status: httpStatus },
    });
  }

  markWebhookFailed(deliveryId: string, error: string, httpStatus: number | null, nextAttemptAt: string | null, dead: boolean): void {
    const now = nowIso();
    this.db
      .prepare(
        `UPDATE webhook_deliveries
         SET status = ?, http_status = ?, attempts = attempts + 1, last_error = ?, last_attempt_at = ?, next_attempt_at = ?
         WHERE id = ?`
      )
      .run(dead ? 'dead' : 'pending', httpStatus, error, now, nextAttemptAt, deliveryId);

    const delivery = this.db.prepare('SELECT action_id, event_type, event_id FROM webhook_deliveries WHERE id = ?').get(deliveryId) as {
      action_id: string;
      event_type: string;
      event_id: string;
    };
    this.appendAuditLogInternal({
      actionId: delivery.action_id,
      eventType: dead ? 'webhook.dead' : 'webhook.retry_scheduled',
      actorType: 'system',
      actorId: null,
      payload: { event_type: delivery.event_type, event_id: delivery.event_id, error, http_status: httpStatus },
    });
  }

  getActionContext(actionId: string): ActionContext | null {
    const action = this.getActionById(actionId);
    if (!action) return null;
    const agent = this.getAgentById(action.agent_id);
    const endUser = this.getEndUserById(action.end_user_id);
    if (!agent || !endUser) return null;
    return { action, agent, endUser };
  }

  toActionApiResponse(action: ActionRecord): ActionApiResponse {
    const execution = this.getExecutionByActionId(action.id);
    const executionRaw = execution ? safeJsonParse<Record<string, unknown>>(execution.result_json, {}) : null;
    const sandboxInjectedFault =
      executionRaw && typeof executionRaw.sandbox_injected_fault === 'string' ? executionRaw.sandbox_injected_fault : null;
    return {
      action_id: action.id,
      status: action.status,
      action_type: 'payment',
      end_user_id: action.end_user_id,
      details: {
        amount: action.amount,
        currency: action.currency,
        recipient_name: action.recipient_name,
        description: action.description,
        payment_rail: action.payment_rail,
        payment_method_preference: action.payment_method_preference,
        recipient_reference: action.recipient_reference,
      },
      callback_url: action.callback_url,
      expires_at: action.expires_at,
      created_at: action.created_at,
      metadata: safeJsonParse(action.metadata_json, {} as Record<string, unknown>),
      audit_count: this.countAuditLogsForAction(action.id),
      execution: execution
        ? {
            rail: execution.rail,
            status: execution.status,
            provider_reference: execution.provider_reference,
            tx_hash: execution.tx_hash,
            payment_id: execution.payment_id,
            error_code: execution.error_code,
            error_message: execution.error_message,
            sandbox_injected_fault: sandboxInjectedFault,
          }
        : null,
    };
  }

  toActionApiResponseBatch(actions: ActionRecord[]): ActionApiResponse[] {
    if (actions.length === 0) return [];
    const ids = actions.map(a => a.id);
    const placeholders = ids.map(() => '?').join(',');

    const executions = this.db
      .prepare(`SELECT * FROM executions WHERE action_id IN (${placeholders})`)
      .all(...ids) as Array<{ action_id: string; rail: string; status: string; provider_reference: string | null; tx_hash: string | null; payment_id: string | null; error_code: string | null; error_message: string | null; result_json: string }>;
    const execMap = new Map(executions.map(e => [e.action_id, e]));

    const auditCounts = this.db
      .prepare(`SELECT action_id, COUNT(1) as c FROM audit_logs WHERE action_id IN (${placeholders}) GROUP BY action_id`)
      .all(...ids) as Array<{ action_id: string; c: number }>;
    const auditMap = new Map(auditCounts.map(a => [a.action_id, a.c]));

    return actions.map(action => {
      const execution = execMap.get(action.id) ?? null;
      const executionRaw = execution ? safeJsonParse<Record<string, unknown>>(execution.result_json, {}) : null;
      const sandboxInjectedFault = executionRaw && typeof executionRaw.sandbox_injected_fault === 'string' ? executionRaw.sandbox_injected_fault : null;
      return {
        action_id: action.id,
        status: action.status,
        action_type: 'payment' as const,
        end_user_id: action.end_user_id,
        details: {
          amount: action.amount,
          currency: action.currency,
          recipient_name: action.recipient_name,
          description: action.description,
          payment_rail: action.payment_rail,
          payment_method_preference: action.payment_method_preference,
          recipient_reference: action.recipient_reference,
        },
        callback_url: action.callback_url,
        expires_at: action.expires_at,
        created_at: action.created_at,
        metadata: safeJsonParse(action.metadata_json, {} as Record<string, unknown>),
        audit_count: auditMap.get(action.id) ?? 0,
        execution: execution
          ? {
              rail: execution.rail as any,
              status: execution.status,
              provider_reference: execution.provider_reference,
              tx_hash: execution.tx_hash,
              payment_id: execution.payment_id,
              error_code: execution.error_code,
              error_message: execution.error_message,
              sandbox_injected_fault: sandboxInjectedFault,
            }
          : null,
      };
    });
  }

  buildWebhookPayload(actionId: string, eventType: WebhookEventType): WebhookPayload {
    const ctx = this.getActionContext(actionId);
    if (!ctx) throw new Error(`Missing action context for webhook payload ${actionId}`);
    const execution = this.getExecutionByActionId(actionId);
    return {
      event_id: randomId('evt'),
      event_type: eventType,
      occurred_at: nowIso(),
      action: {
        id: ctx.action.id,
        status: ctx.action.status,
        end_user_id: ctx.action.end_user_id,
        amount: ctx.action.amount,
        currency: ctx.action.currency,
        recipient_name: ctx.action.recipient_name,
        description: ctx.action.description,
        payment_rail: ctx.action.payment_rail,
        recipient_reference: ctx.action.recipient_reference,
        metadata: safeJsonParse(ctx.action.metadata_json, {} as Record<string, unknown>),
      },
      execution: execution && ['succeeded', 'failed'].includes(execution.status)
        ? {
            rail: execution.rail,
            status: execution.status as 'succeeded' | 'failed',
            provider: execution.provider ?? 'unknown',
            provider_reference: execution.provider_reference ?? undefined,
            payment_id: execution.payment_id ?? undefined,
            tx_hash: execution.tx_hash ?? undefined,
            error_code: execution.error_code ?? undefined,
            error_message: execution.error_message ?? undefined,
          }
        : undefined,
    };
  }

  getCapabilitiesForUser(userId: string): { rails: PaymentRail[]; methods: Array<Record<string, unknown>> } {
    const methods = this.listPaymentMethodsForUser(userId);
    const rails = [...new Set(methods.map((m) => m.rail))] as PaymentRail[];
    return {
      rails,
      methods: methods.map((m) => ({
        id: m.id,
        rail: m.rail,
        alias: m.alias,
        is_default: !!m.is_default,
        metadata: safeJsonParse(m.metadata_json, {} as Record<string, unknown>),
      })),
    };
  }

  nextRetryTime(attemptsAfterFailure: number): string | null {
    const delaysSec = [5, 30, 120, 600, 1800, 7200, 21600];
    const idx = Math.min(attemptsAfterFailure - 1, delaysSec.length - 1);
    if (attemptsAfterFailure > 8) return null;
    const d = new Date();
    d.setSeconds(d.getSeconds() + delaysSec[idx]);
    return d.toISOString();
  }

  upsertDevice(userId: string, platform: 'ios' | 'android', pushToken: string): DeviceRecord {
    const now = nowIso();
    const existing = this.db
      .prepare('SELECT * FROM devices WHERE user_id = ? AND platform = ?')
      .get(userId, platform) as DeviceRecord | undefined;

    if (existing) {
      this.db
        .prepare('UPDATE devices SET push_token = ?, updated_at = ? WHERE id = ?')
        .run(pushToken, now, existing.id);
      return { ...existing, push_token: pushToken, updated_at: now };
    }

    const id = randomId('dev');
    this.db
      .prepare('INSERT INTO devices (id, user_id, platform, push_token, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(id, userId, platform, pushToken, now, now);
    return { id, user_id: userId, platform, push_token: pushToken, created_at: now, updated_at: now };
  }

  listDevicesForUser(userId: string): DeviceRecord[] {
    return this.db
      .prepare('SELECT * FROM devices WHERE user_id = ? ORDER BY datetime(created_at) DESC')
      .all(userId) as DeviceRecord[];
  }

  deleteDevice(deviceId: string): boolean {
    const result = this.db.prepare('DELETE FROM devices WHERE id = ?').run(deviceId);
    return result.changes > 0;
  }
}
