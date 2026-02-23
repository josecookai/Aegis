import { AppConfig } from '../config';
import { safeJsonParse } from '../lib/crypto';
import { nowIso } from '../lib/time';
import { TERMINAL_STATUSES } from '../types';
import {
  ActionRecord,
  AgentRecord,
  DecisionSource,
  PaymentRail,
  RequestActionInput,
  WebhookEventType,
} from '../types';
import { ExecutionEngine } from './execution';
import { NotificationService } from './notifications';
import { AegisStore } from './store';
import { WebhookSender } from './webhookSender';

export class DomainError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly httpStatus = 400
  ) {
    super(message);
  }
}

export interface CreateActionResult {
  action: ActionRecord;
  approvalUrl: string;
  idempotencyReplayed: boolean;
}

export class AegisService {
  constructor(
    private readonly store: AegisStore,
    private readonly notifications: NotificationService,
    private readonly executionEngine: ExecutionEngine,
    private readonly webhookSender: WebhookSender,
    private readonly config: AppConfig
  ) {}

  getStore(): AegisStore {
    return this.store;
  }

  getConfig(): AppConfig {
    return this.config;
  }

  authenticateAgent(apiKey: string | null | undefined): AgentRecord {
    if (!apiKey) {
      throw new DomainError('UNAUTHORIZED', 'Missing API key', 401);
    }
    const agent = this.store.getAgentByApiKey(apiKey);
    if (!agent || agent.status !== 'active') {
      throw new DomainError('UNAUTHORIZED', 'Invalid API key', 401);
    }
    return agent;
  }

  createActionRequest(agent: AgentRecord, input: RequestActionInput): CreateActionResult {
    const existing = this.store.findActionByAgentAndIdempotency(agent.id, input.idempotency_key);
    if (existing) {
      const link = this.store.listEmailOutbox(100).find((m) => {
        const md = safeJsonParse<Record<string, unknown>>(String(m.metadata_json ?? '{}'), {});
        return md?.action_id === existing.id && typeof md.approve_url === 'string';
      }) as Record<string, unknown> | undefined;
      const approveUrl = link
        ? String(safeJsonParse<Record<string, unknown>>(String(link.metadata_json ?? '{}'), {}).approve_url ?? '')
        : '';
      return {
        action: existing,
        approvalUrl: approveUrl || `${this.config.baseUrl}/actions/${existing.id}`,
        idempotencyReplayed: true,
      };
    }

    const endUser = this.store.getEndUserById(input.end_user_id);
    if (!endUser || endUser.status !== 'active') {
      throw new DomainError('INVALID_END_USER', 'Unknown or inactive end_user_id', 404);
    }
    if (!this.store.isAgentLinkedToUser(agent.id, endUser.id)) {
      throw new DomainError('UNLINKED_END_USER', 'Agent is not linked to the specified end user', 403);
    }

    this.validateCallbackUrl(input.callback_url);
    this.validatePaymentDetails(input.details.payment_rail, input.details.currency, input.details.recipient_reference);

    const paymentMethod = this.store.getPreferredPaymentMethod(
      endUser.id,
      input.details.payment_rail,
      input.details.payment_method_preference
    );
    if (!paymentMethod) {
      throw new DomainError('PAYMENT_METHOD_NOT_FOUND', `No ${input.details.payment_rail} payment method available for user`, 400);
    }

    const created = this.store.createAction({
      agentId: agent.id,
      input,
      defaultExpiryMinutes: this.config.approvalExpiryMinutesDefault,
    });

    const awaiting = this.store.transitionActionStatus({
      actionId: created.id,
      to: 'awaiting_approval',
    });

    const magicLink = this.store.createMagicLink(awaiting.end_user_id, awaiting.id, 'approval', awaiting.expires_at);
    const emailId = this.notifications.sendApprovalEmail({
      toEmail: endUser.email,
      userName: endUser.display_name,
      actionId: awaiting.id,
      amount: awaiting.amount,
      currency: awaiting.currency,
      recipientName: awaiting.recipient_name,
      magicToken: magicLink.token,
      expiresAt: awaiting.expires_at,
    });

    this.store.appendAuditLog(awaiting.id, 'notification.email_sent', 'system', null, {
      email_id: emailId,
      channel: 'email_magic_link',
    });

    return {
      action: awaiting,
      approvalUrl: `${this.config.baseUrl}/approve/${encodeURIComponent(magicLink.token)}`,
      idempotencyReplayed: false,
    };
  }

  getActionForAgent(agent: AgentRecord, actionId: string): ActionRecord {
    const action = this.store.getActionById(actionId);
    if (!action || action.agent_id !== agent.id) {
      throw new DomainError('NOT_FOUND', 'Action not found', 404);
    }
    return action;
  }

  cancelAction(agent: AgentRecord, actionId: string): ActionRecord {
    const action = this.getActionForAgent(agent, actionId);
    if (action.status !== 'awaiting_approval') {
      throw new DomainError('INVALID_STATE', `Only awaiting_approval actions can be canceled (current=${action.status})`, 409);
    }
    const next = this.store.transitionActionStatus({ actionId, to: 'canceled', reason: 'agent_canceled' });
    this.queueCallbackForActionStatus(next);
    return next;
  }

  getCapabilities(agent: AgentRecord, endUserId: string): { end_user_id: string; rails: PaymentRail[]; methods: Array<Record<string, unknown>> } {
    const endUser = this.store.getEndUserById(endUserId);
    if (!endUser) {
      throw new DomainError('INVALID_END_USER', 'Unknown end_user_id', 404);
    }
    if (!this.store.isAgentLinkedToUser(agent.id, endUser.id)) {
      throw new DomainError('UNLINKED_END_USER', 'Agent is not linked to the specified end user', 403);
    }
    const caps = this.store.getCapabilitiesForUser(endUserId);
    return { end_user_id: endUserId, ...caps };
  }

  createWebhookTest(agent: AgentRecord, callbackUrl: string): { queued: boolean; event_id: string } {
    this.validateCallbackUrl(callbackUrl);
    const action = this.store.createAction({
      agentId: agent.id,
      input: {
        idempotency_key: `webhook_test_${Date.now()}`,
        end_user_id: 'usr_demo',
        action_type: 'payment',
        details: {
          amount: '0.01',
          currency: 'USD',
          recipient_name: 'Aegis Webhook Test',
          description: 'webhook test',
          payment_rail: 'card',
          payment_method_preference: 'card_default',
          recipient_reference: 'merchant_api:test',
        },
        callback_url: callbackUrl,
        metadata: { webhook_test: true },
      },
      defaultExpiryMinutes: this.config.approvalExpiryMinutesDefault,
    });
    this.store.transitionActionStatus({ actionId: action.id, to: 'awaiting_approval' });
    this.store.transitionActionStatus({ actionId: action.id, to: 'approved' });
    const executing = this.store.transitionActionStatus({ actionId: action.id, to: 'executing' });
    this.store.createOrUpdateExecutionStart(executing.id, 'card');
    this.store.completeExecution(executing.id, {
      success: true,
      rail: 'card',
      provider: 'mock_psp',
      providerReference: `webhook_test_${Date.now()}`,
      paymentId: `pay_test_${Date.now()}`,
    });
    const succeeded = this.store.transitionActionStatus({ actionId: executing.id, to: 'succeeded' });
    const queued = this.queueCallbackForActionStatus(succeeded);
    return { queued: true, event_id: queued?.event_id ?? 'unknown' };
  }

  getApprovalView(rawToken: string): {
    valid: boolean;
    reason?: string;
    action?: ActionRecord;
    endUser?: { id: string; email: string; display_name: string };
    magicLinkId?: string;
    token?: string;
    alreadyDecided?: boolean;
    decision?: { decision: 'approved' | 'denied'; source: string; submitted_at: string } | null;
  } {
    const resolved = this.store.resolveMagicLink(rawToken);
    if (!resolved) return { valid: false, reason: 'Magic link not found' };
    if (resolved.purpose !== 'approval') return { valid: false, reason: 'Unsupported magic link purpose' };
    if (new Date(resolved.expiresAt).getTime() < Date.now()) return { valid: false, reason: 'Magic link expired' };

    const endUser = this.store.getEndUserById(resolved.userId);
    const action = resolved.actionId ? this.store.getActionById(resolved.actionId) : null;
    if (!endUser || !action) return { valid: false, reason: 'Linked action or user missing' };

    const decision = this.store.getDecisionByActionId(action.id);
    const terminal = TERMINAL_STATUSES.has(action.status);

    return {
      valid: true,
      action,
      endUser,
      magicLinkId: resolved.magicLinkId,
      token: rawToken,
      alreadyDecided: terminal || Boolean(decision),
      decision,
    };
  }

  getApprovalViewByActionId(actionId: string, userId: string): {
    valid: boolean;
    reason?: string;
    action?: ActionRecord;
    endUser?: { id: string; email: string; display_name: string };
    alreadyDecided?: boolean;
    decision?: { decision: 'approved' | 'denied'; source: string; submitted_at: string } | null;
  } {
    const action = this.store.getActionById(actionId);
    if (!action) return { valid: false, reason: 'Action not found' };
    if (action.end_user_id !== userId) return { valid: false, reason: 'User mismatch' };
    const endUser = this.store.getEndUserById(action.end_user_id);
    if (!endUser) return { valid: false, reason: 'User not found' };
    const decision = this.store.getDecisionByActionId(action.id);
    const terminal = TERMINAL_STATUSES.has(action.status);
    return {
      valid: true,
      action,
      endUser,
      alreadyDecided: terminal || Boolean(decision),
      decision,
    };
  }

  submitDecisionByActionId(actionId: string, userId: string, decision: 'approve' | 'deny', source: DecisionSource): ActionRecord {
    const view = this.getApprovalViewByActionId(actionId, userId);
    if (!view.valid || !view.action || !view.endUser) {
      throw new DomainError('INVALID_REQUEST', view.reason ?? 'Cannot resolve action', 400);
    }
    if (new Date(view.action.expires_at).getTime() < Date.now() && view.action.status === 'awaiting_approval') {
      const expired = this.store.transitionActionStatus({ actionId: view.action.id, to: 'expired', reason: 'approval_timeout' });
      this.queueCallbackForActionStatus(expired);
      throw new DomainError('ACTION_EXPIRED', 'Approval window expired', 410);
    }
    if (view.action.status !== 'awaiting_approval') {
      throw new DomainError('INVALID_STATE', `Action is no longer pending approval (current=${view.action.status})`, 409);
    }
    const normalized = decision === 'approve' ? 'approved' : 'denied';
    const updated = this.store.createDecisionAndTransition({
      actionId: view.action.id,
      actorUserId: view.endUser.id,
      decision: normalized,
      source,
      details: { via: 'app_action_id', token_hash_only: false },
    });
    this.queueCallbackForActionStatus(updated);
    return updated;
  }

  submitApprovalDecision(rawToken: string, decision: 'approve' | 'deny', source: DecisionSource): ActionRecord {
    const view = this.getApprovalView(rawToken);
    if (!view.valid || !view.action || !view.endUser || !view.magicLinkId) {
      throw new DomainError('INVALID_MAGIC_LINK', view.reason ?? 'Invalid magic link', 400);
    }
    if (new Date(view.action.expires_at).getTime() < Date.now() && view.action.status === 'awaiting_approval') {
      const expired = this.store.transitionActionStatus({ actionId: view.action.id, to: 'expired', reason: 'approval_timeout' });
      this.queueCallbackForActionStatus(expired);
      throw new DomainError('ACTION_EXPIRED', 'Approval window expired', 410);
    }
    if (view.action.status !== 'awaiting_approval') {
      throw new DomainError('INVALID_STATE', `Action is no longer pending approval (current=${view.action.status})`, 409);
    }

    const normalized = decision === 'approve' ? 'approved' : 'denied';
    const updated = this.store.createDecisionAndTransition({
      actionId: view.action.id,
      actorUserId: view.endUser.id,
      decision: normalized,
      source,
      details: { via: 'magic_link_web', token_hash_only: true },
      consumeMagicLinkId: view.magicLinkId,
    });
    this.queueCallbackForActionStatus(updated);
    return updated;
  }

  expirePendingActions(limit = 100): number {
    const pending = this.store.listActionsByStatus('awaiting_approval', limit);
    let expiredCount = 0;
    for (const action of pending) {
      if (new Date(action.expires_at).getTime() <= Date.now()) {
        try {
          const expired = this.store.transitionActionStatus({ actionId: action.id, to: 'expired', reason: 'approval_timeout' });
          this.queueCallbackForActionStatus(expired);
          expiredCount += 1;
        } catch {
          // ignore concurrent transitions
        }
      }
    }
    return expiredCount;
  }

  async processApprovedActions(limit = 20): Promise<number> {
    const approved = this.store.listActionsByStatus('approved', limit);
    let processed = 0;

    for (const action of approved) {
      try {
        const executing = this.store.transitionActionStatus({ actionId: action.id, to: 'executing' });
        this.store.createOrUpdateExecutionStart(executing.id, executing.payment_rail);

        const paymentMethod = this.store.getPreferredPaymentMethod(
          executing.end_user_id,
          executing.payment_rail,
          executing.payment_method_preference
        );
        if (!paymentMethod) {
          this.store.completeExecution(executing.id, {
            success: false,
            rail: executing.payment_rail,
            provider: 'aegis_guard',
            errorCode: 'INVALID_PAYMENT_METHOD',
            errorMessage: 'No usable payment method available at execution time',
          });
          const failed = this.store.transitionActionStatus({ actionId: executing.id, to: 'failed', reason: 'missing_payment_method' });
          this.queueCallbackForActionStatus(failed);
          processed += 1;
          continue;
        }

        const result = await this.executionEngine.execute(executing, paymentMethod);
        this.store.completeExecution(executing.id, result);
        const final = this.store.transitionActionStatus({
          actionId: executing.id,
          to: result.success ? 'succeeded' : 'failed',
          reason: result.success ? null : result.errorCode ?? 'execution_failed',
        });
        this.queueCallbackForActionStatus(final);
        processed += 1;
      } catch (error) {
        this.store.appendAuditLog(action.id, 'execution.worker_error', 'system', null, {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return processed;
  }

  async dispatchDueWebhooks(limit = 25): Promise<number> {
    const due = this.store.listDueWebhookDeliveries(limit);
    let sent = 0;
    for (const delivery of due) {
      const agent = this.store.getAgentById(delivery.agent_id);
      if (!agent) {
        const next = this.store.nextRetryTime(delivery.attempts + 1);
        this.store.markWebhookFailed(delivery.id, 'Agent missing', null, next, next === null);
        continue;
      }
      const result = await this.webhookSender.deliver(delivery, agent.webhook_secret);
      if (result.ok) {
        this.store.markWebhookDelivered(delivery.id, result.status ?? 200);
        sent += 1;
      } else {
        const next = this.store.nextRetryTime(delivery.attempts + 1);
        this.store.markWebhookFailed(
          delivery.id,
          result.error ?? 'Unknown webhook error',
          result.status ?? null,
          next,
          next === null
        );
      }
    }
    return sent;
  }

  getAdminDashboardData(): Record<string, unknown> {
    const actions = this.store.listActions(50).map((a) => this.store.toActionApiResponse(a));
    return {
      now: nowIso(),
      agents: this.store.listAgents(),
      end_users: this.store.listEndUsers(),
      recent_actions: actions,
      emails: this.store.listEmailOutbox(20),
    };
  }

  getActionAuditView(actionId: string): { action: ReturnType<AegisStore['toActionApiResponse']>; audit_logs: Array<Record<string, unknown>> } {
    const action = this.store.getActionById(actionId);
    if (!action) {
      throw new DomainError('NOT_FOUND', 'Action not found', 404);
    }
    return {
      action: this.store.toActionApiResponse(action),
      audit_logs: this.store.listAuditLogsForAction(actionId),
    };
  }

  async runSandboxDemo(preset: 'PSP_DECLINE_DEMO' | 'CHAIN_REVERT_DEMO' | 'TIMEOUT_DEMO', callbackUrl: string): Promise<{ actionId: string; status: string }> {
    const agent = this.authenticateAgent('aegis_demo_agent_key');
    const isCrypto = preset === 'CHAIN_REVERT_DEMO';
    const action = this.createActionRequest(agent, {
      idempotency_key: `sandbox_demo_${preset}_${Date.now()}`,
      end_user_id: 'usr_demo',
      action_type: 'payment',
      callback_url: callbackUrl,
      details: isCrypto
        ? {
            amount: '15.00',
            currency: 'USDC',
            recipient_name: 'Sandbox Demo Wallet',
            description: `Sandbox demo ${preset}`,
            payment_rail: 'crypto',
            payment_method_preference: 'crypto_default',
            recipient_reference: 'address:0x3333333333333333333333333333333333333333',
          }
        : {
            amount: '15.00',
            currency: 'USD',
            recipient_name: 'Sandbox Demo Merchant',
            description: `Sandbox demo ${preset}`,
            payment_rail: 'card',
            payment_method_preference: 'card_default',
            recipient_reference: 'merchant_api:sandbox_demo',
          },
      metadata: { sandbox_demo: true, preset },
    }).action;

    this.devForceDecision(action.id, 'approve');
    await this.processApprovedActions();
    await this.dispatchDueWebhooks();
    const final = this.store.getActionById(action.id)!;
    return { actionId: final.id, status: final.status };
  }

  devForceDecision(actionId: string, decision: 'approve' | 'deny' | 'expire', source: DecisionSource = 'web_magic_link'): ActionRecord {
    const ctx = this.store.getActionContext(actionId);
    if (!ctx) {
      throw new DomainError('NOT_FOUND', 'Action not found', 404);
    }
    if (ctx.action.status !== 'awaiting_approval') {
      throw new DomainError('INVALID_STATE', `Action is not awaiting approval (current=${ctx.action.status})`, 409);
    }

    if (decision === 'expire') {
      const expired = this.store.transitionActionStatus({ actionId, to: 'expired', reason: 'dev_forced_expire' });
      this.queueCallbackForActionStatus(expired);
      return expired;
    }

    const normalized = decision === 'approve' ? 'approved' : 'denied';
    this.store.createDecision(actionId, ctx.endUser.id, normalized, source, { via: 'dev_endpoint' });
    const updated = this.store.transitionActionStatus({ actionId, to: normalized, reason: 'dev_forced_decision' });
    this.queueCallbackForActionStatus(updated);
    return updated;
  }

  listWebhookDeliveries(params?: { actionId?: string; status?: string; limit?: number }) {
    return this.store.listWebhookDeliveries(params);
  }

  requeueWebhookDelivery(deliveryId: string): { delivery_id: string; status: string } {
    const delivery = this.store.getWebhookDeliveryById(deliveryId);
    if (!delivery) {
      throw new DomainError('NOT_FOUND', 'Webhook delivery not found', 404);
    }
    this.store.requeueWebhookDelivery(deliveryId);
    const refreshed = this.store.getWebhookDeliveryById(deliveryId);
    return { delivery_id: deliveryId, status: refreshed?.status ?? 'pending' };
  }

  private queueCallbackForActionStatus(action: ActionRecord): { id: string; event_id: string } | null {
    const eventType = mapStatusToWebhookEvent(action.status);
    if (!eventType) return null;
    const payload = this.store.buildWebhookPayload(action.id, eventType);
    const queued = this.store.queueWebhookDelivery(action.agent_id, action.id, eventType, action.callback_url, payload);
    return { id: queued.id, event_id: queued.event_id };
  }

  private validatePaymentDetails(rail: PaymentRail, currency: string, recipientReference: string): void {
    if (rail === 'card') {
      if (currency !== 'USD') {
        throw new DomainError('INVALID_CURRENCY', 'Card rail only supports USD in MVP', 400);
      }
      if (!(recipientReference.startsWith('merchant_api:') || recipientReference.startsWith('payment_link:'))) {
        throw new DomainError(
          'UNSUPPORTED_RECIPIENT',
          'Card rail recipient_reference must start with merchant_api: or payment_link: in MVP',
          400
        );
      }
      return;
    }

    if (!['USDC', 'USDT'].includes(currency)) {
      throw new DomainError('INVALID_CURRENCY', 'Crypto rail only supports USDC/USDT in MVP', 400);
    }
    if (!(recipientReference.startsWith('address:0x') || recipientReference.startsWith('wallet:'))) {
      throw new DomainError(
        'UNSUPPORTED_RECIPIENT',
        'Crypto rail recipient_reference must start with address:0x or wallet: in MVP',
        400
      );
    }
  }

  private validateCallbackUrl(callbackUrl: string): void {
    let url: URL;
    try {
      url = new URL(callbackUrl);
    } catch {
      throw new DomainError('INVALID_CALLBACK_URL', 'callback_url must be a valid URL', 400);
    }

    if (url.protocol === 'https:') return;
    const hostname = url.hostname;
    const devHosts = new Set(['localhost', '127.0.0.1']);
    if (url.protocol === 'http:' && devHosts.has(hostname)) return;
    throw new DomainError('INVALID_CALLBACK_URL', 'callback_url must be HTTPS (HTTP allowed only for localhost in dev)', 400);
  }
}

function mapStatusToWebhookEvent(status: ActionRecord['status']): WebhookEventType | null {
  switch (status) {
    case 'approved':
      return 'action.approved';
    case 'denied':
      return 'action.denied';
    case 'succeeded':
      return 'action.succeeded';
    case 'failed':
      return 'action.failed';
    case 'expired':
      return 'action.expired';
    case 'canceled':
      return 'action.canceled';
    default:
      return null;
  }
}
