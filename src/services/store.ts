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

  getEndUserById(userId: string): EndUserRecord | null {
    const row = this.db.prepare('SELECT * FROM end_users WHERE id = ?').get(userId) as EndUserRecord | undefined;
    return row ?? null;
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
          opts.input.callback_url,
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
          }
        : null,
    };
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
}
