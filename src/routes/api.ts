import { Router } from 'express';
import { ZodError } from 'zod';
import Stripe from 'stripe';
import { requestActionSchema, webhookTestSchema } from '../schemas';
import { DomainError, AegisService } from '../services/aegis';
import { SandboxFaultService, CardFaultMode, CryptoFaultMode, FaultScope, SandboxPresetName } from '../services/sandboxFaults';
import { safeJsonParse } from '../lib/crypto';

export function createApiRouter(service: AegisService, sandboxFaults: SandboxFaultService): Router {
  const router = Router();

  router.use('/v1', (req, res, next) => {
    try {
      const apiKey = req.header('x-aegis-api-key') ?? req.header('authorization')?.replace(/^Bearer\s+/i, '');
      const agent = service.authenticateAgent(apiKey);
      (req as any).agent = agent;
      next();
    } catch (error) {
      next(error);
    }
  });

  router.post('/v1/request_action', (req, res, next) => {
    try {
      const agent = (req as any).agent;
      const headerIdempotencyKey = String(req.header('idempotency-key') ?? '').trim();
      const mergedBody = {
        ...(req.body ?? {}),
        // Header takes precedence to align with API spec guidance.
        ...(headerIdempotencyKey ? { idempotency_key: headerIdempotencyKey } : {}),
      };
      const input = requestActionSchema.parse(mergedBody);
      const result = service.createActionRequest(agent, input);
      res.setHeader('Idempotency-Key', input.idempotency_key);
      if (result.idempotencyReplayed) {
        res.setHeader('Idempotency-Replayed', 'true');
      }
      res.status(201).json({
        action: service.getStore().toActionApiResponse(result.action),
        links: {
          approval_url: result.approvalUrl,
        },
      });
    } catch (error) {
      next(error);
    }
  });

  const getActionHandler = (req: any, res: any, next: any) => {
    try {
      const agent = req.agent;
      const actionId = req.params.actionId || req.params.id;
      const action = service.getActionForAgent(agent, actionId);
      res.json({ action: service.getStore().toActionApiResponse(action) });
    } catch (error) {
      next(error);
    }
  };

  router.get('/v1/actions/:actionId', getActionHandler);
  router.get('/v1/requests/:id', getActionHandler);

  router.post('/v1/actions/:actionId/cancel', (req, res, next) => {
    try {
      const agent = (req as any).agent;
      const action = service.cancelAction(agent, req.params.actionId);
      res.json({ action: service.getStore().toActionApiResponse(action) });
    } catch (error) {
      next(error);
    }
  });

  router.get('/v1/payment_methods/capabilities', (req, res, next) => {
    try {
      const agent = (req as any).agent;
      const endUserId = String(req.query.end_user_id ?? '');
      if (!endUserId) {
        throw new DomainError('MISSING_END_USER_ID', 'Query parameter end_user_id is required', 400);
      }
      const capabilities = service.getCapabilities(agent, endUserId);
      res.json(capabilities);
    } catch (error) {
      next(error);
    }
  });

  router.post('/v1/webhooks/test', (req, res, next) => {
    try {
      const agent = (req as any).agent;
      const body = webhookTestSchema.parse(req.body);
      const result = service.createWebhookTest(agent, body.callback_url);
      res.status(202).json(result);
    } catch (error) {
      next(error);
    }
  });

  // Dev/debug endpoints (no API auth; internal prototype only)
  router.get('/api/dev/actions/:actionId/audit', (req, res, next) => {
    try {
      const logs = service.getStore().listAuditLogsForAction(req.params.actionId).map((row) => ({
        ...row,
        payload: safeJsonParse(String((row as any).payload_json ?? '{}'), {}),
      }));
      res.json({ action_id: req.params.actionId, logs });
    } catch (error) {
      next(error);
    }
  });

  router.get('/api/dev/actions', (_req, res, next) => {
    try {
      const actions = service.getStore().listActions(200).map((a) => service.getStore().toActionApiResponse(a));
      res.json({ actions });
    } catch (error) {
      next(error);
    }
  });

  router.post('/api/dev/workers/tick', async (_req, res, next) => {
    try {
      const expired = service.expirePendingActions();
      const executed = await service.processApprovedActions();
      const callbacks = await service.dispatchDueWebhooks();
      res.json({ expired, executed, callbacks });
    } catch (error) {
      next(error);
    }
  });

  router.post('/api/dev/actions/:actionId/decision', (req, res, next) => {
    try {
      const decision = String(req.body?.decision ?? '');
      if (!['approve', 'deny', 'expire'].includes(decision)) {
        throw new DomainError('INVALID_DECISION', 'decision must be approve | deny | expire', 400);
      }
      const source = (req.body?.decision_source ?? 'web_magic_link') as any;
      const action = service.devForceDecision(req.params.actionId, decision as 'approve' | 'deny' | 'expire', source);
      res.json({ action: service.getStore().toActionApiResponse(action) });
    } catch (error) {
      next(error);
    }
  });

  router.get('/api/dev/webhooks', (req, res, next) => {
    try {
      const actionId = req.query.action_id ? String(req.query.action_id) : undefined;
      const status = req.query.status ? String(req.query.status) : undefined;
      const limit = req.query.limit ? Number(req.query.limit) : undefined;
      const deliveries = service.listWebhookDeliveries({ actionId, status, limit }).map((d) => ({
        ...d,
        payload: safeJsonParse(d.payload_json, {}),
      }));
      res.json({ deliveries });
    } catch (error) {
      next(error);
    }
  });

  router.post('/api/dev/webhooks/:deliveryId/requeue', (req, res, next) => {
    try {
      const result = service.requeueWebhookDelivery(req.params.deliveryId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.get('/api/dev/sandbox/faults', (_req, res) => {
    res.json({ sandbox_faults: sandboxFaults.getSnapshot() });
  });

  router.post('/api/dev/sandbox/faults', (req, res, next) => {
    try {
      const rail = String(req.body?.rail ?? '');
      const mode = String(req.body?.mode ?? '');
      const scope = (String(req.body?.scope ?? 'once') as FaultScope);
      if (!['once', 'sticky'].includes(scope)) {
        throw new DomainError('INVALID_SCOPE', 'scope must be once or sticky', 400);
      }
      if (rail === 'card') {
        if (!['none', 'decline', 'timeout'].includes(mode)) throw new DomainError('INVALID_MODE', 'Invalid card mode', 400);
        return res.json({ sandbox_faults: sandboxFaults.setCardFault(mode as CardFaultMode, scope) });
      }
      if (rail === 'crypto') {
        if (!['none', 'revert', 'timeout'].includes(mode)) throw new DomainError('INVALID_MODE', 'Invalid crypto mode', 400);
        return res.json({ sandbox_faults: sandboxFaults.setCryptoFault(mode as CryptoFaultMode, scope) });
      }
      throw new DomainError('INVALID_RAIL', 'rail must be card or crypto', 400);
    } catch (error) {
      next(error);
    }
  });

  router.post('/api/dev/sandbox/faults/reset', (_req, res) => {
    res.json({ sandbox_faults: sandboxFaults.resetAll() });
  });

  router.post('/api/dev/sandbox/presets', (req, res, next) => {
    try {
      const preset = String(req.body?.preset ?? '') as SandboxPresetName;
      const allowed: SandboxPresetName[] = ['PSP_DECLINE_DEMO', 'CHAIN_REVERT_DEMO', 'TIMEOUT_DEMO'];
      if (!allowed.includes(preset)) {
        throw new DomainError('INVALID_PRESET', 'Unknown sandbox preset', 400);
      }
      res.json({ sandbox_faults: sandboxFaults.applyPreset(preset), preset });
    } catch (error) {
      next(error);
    }
  });

  // ─── Admin Control (internal) ───────────────────────────────────────
  router.get('/api/dev/admin-control/keys', (_req, res, next) => {
    try {
      res.json({ keys: service.listAgentKeyControls() });
    } catch (error) {
      next(error);
    }
  });

  router.get('/api/dev/admin-control/keys/:agentId', (req, res, next) => {
    try {
      res.json({ key: service.getAgentKeyControl(String(req.params.agentId)) });
    } catch (error) {
      next(error);
    }
  });

  router.post('/api/dev/admin-control/keys/:agentId/status', (req, res, next) => {
    try {
      const status = String(req.body?.status ?? '').trim();
      if (status !== 'active' && status !== 'disabled') {
        throw new DomainError('INVALID_STATUS', 'status must be active or disabled', 400);
      }
      const key = service.setAgentKeyStatus(String(req.params.agentId), status);
      res.json({ ok: true, key });
    } catch (error) {
      next(error);
    }
  });

  router.post('/api/dev/admin-control/keys/:agentId/rotate', (req, res, next) => {
    try {
      const rotated = service.rotateAgentCredentials(String(req.params.agentId));
      res.json({ ok: true, ...rotated });
    } catch (error) {
      next(error);
    }
  });

  router.put('/api/dev/admin-control/keys/:agentId/rate-limit', (req, res, next) => {
    try {
      const requestsPerMinute = Number(req.body?.requests_per_minute);
      const rate = service.setAgentRateLimit(String(req.params.agentId), requestsPerMinute);
      res.json({ ok: true, rate_limit: rate });
    } catch (error) {
      next(error);
    }
  });

  router.get('/api/dev/admin-control/policies/risk', (_req, res, next) => {
    try {
      res.json({ policy: service.getRiskPolicy() });
    } catch (error) {
      next(error);
    }
  });

  router.put('/api/dev/admin-control/policies/risk', (req, res, next) => {
    try {
      const policy = service.updateRiskPolicy({
        single_tx_limit_cents: Number(req.body?.single_tx_limit_cents),
        daily_total_limit_cents: Number(req.body?.daily_total_limit_cents),
        allowlist_enabled: Boolean(req.body?.allowlist_enabled),
      });
      res.json({ ok: true, policy });
    } catch (error) {
      next(error);
    }
  });

  router.get('/api/dev/admin-control/policies/allowlist', (_req, res, next) => {
    try {
      const policy = service.getRiskPolicy();
      const recipients = service.getRecipientAllowlist();
      res.json({ allowlist_enabled: policy.allowlist_enabled, recipients });
    } catch (error) {
      next(error);
    }
  });

  router.put('/api/dev/admin-control/policies/allowlist', (req, res, next) => {
    try {
      const recipientsRaw = Array.isArray(req.body?.recipients) ? req.body.recipients : [];
      const recipients = recipientsRaw.map((v: unknown) => String(v)).filter(Boolean);
      if (typeof req.body?.allowlist_enabled !== 'undefined') {
        service.updateRiskPolicy({
          ...service.getRiskPolicy(),
          allowlist_enabled: Boolean(req.body.allowlist_enabled),
        });
      }
      const updated = service.updateRecipientAllowlist(recipients);
      const policy = service.getRiskPolicy();
      res.json({ ok: true, allowlist_enabled: policy.allowlist_enabled, recipients: updated });
    } catch (error) {
      next(error);
    }
  });

  // ─── Dev: Payment methods (Stripe Elements add card) ───────────────
  router.post('/api/dev/payment-methods', async (req, res, next) => {
    try {
      const paymentMethodId = String(req.body?.payment_method_id ?? '').trim();
      const userId = String(req.body?.user_id ?? 'usr_demo').trim();
      if (!paymentMethodId || !paymentMethodId.startsWith('pm_')) {
        throw new DomainError('INVALID_PAYMENT_METHOD', 'payment_method_id (Stripe pm_xxx) is required', 400);
      }
      const store = service.getStore();
      const endUser = store.getEndUserById(userId);
      if (!endUser) throw new DomainError('USER_NOT_FOUND', `User ${userId} not found`, 404);
      const config = service.getConfig();
      if (!config.stripeSecretKey) {
        throw new DomainError('STRIPE_NOT_CONFIGURED', 'Set STRIPE_SECRET_KEY and STRIPE_PUBLISHABLE_KEY to add cards', 400);
      }

      /* c8 ignore start - exercised in Stripe integration environments */
      const stripe = new Stripe(config.stripeSecretKey, { apiVersion: '2025-01-27.acacia' as any });
      const pm = await stripe.paymentMethods.retrieve(paymentMethodId);
      if (pm.type !== 'card' || !pm.card) {
        throw new DomainError('INVALID_PAYMENT_METHOD', 'Only card payment methods are supported', 400);
      }

      const existingPm = store.getPreferredPaymentMethod(userId, 'card', 'card_default');
      let customerId: string;
      const existingMeta = existingPm ? safeJsonParse(existingPm.metadata_json, {} as Record<string, unknown>) : {};

      if (existingMeta.stripe_customer_id && typeof existingMeta.stripe_customer_id === 'string') {
        customerId = existingMeta.stripe_customer_id;
      } else {
        const customer = await stripe.customers.create({
          email: endUser.email,
          name: endUser.display_name,
          metadata: { aegis_user_id: userId },
        });
        customerId = customer.id;
      }

      try {
        await stripe.paymentMethods.attach(paymentMethodId, { customer: customerId });
      } catch (attachErr: any) {
        if (attachErr?.code === 'resource_already_attached_to_customer') {
          throw new DomainError('CARD_ALREADY_SAVED', 'This card is already saved to another account', 400);
        }
        throw attachErr;
      }
      await stripe.customers.update(customerId, {
        invoice_settings: { default_payment_method: paymentMethodId },
      });

      const last4 = pm.card.last4 ?? '****';
      const brand = pm.card.brand ?? 'card';
      const alias = `${brand.charAt(0).toUpperCase() + brand.slice(1)} **** ${last4}`;
      const metadataJson = JSON.stringify({ psp: 'stripe', brand, last4, stripe_customer_id: customerId });

      const pmId = store.insertPaymentMethod(userId, 'card', alias, paymentMethodId, metadataJson);

      res.status(201).json({
        ok: true,
        payment_method_id: pmId,
        stripe_payment_method_id: paymentMethodId,
        card: { brand, last4, alias },
        message: `Card ${alias} added successfully.`,
      });
      /* c8 ignore stop */
    } catch (error) {
      next(error);
    }
  });

  router.get('/api/dev/payment-methods', (req, res, next) => {
    try {
      const userId = String(req.query.user_id ?? 'usr_demo').trim();
      const store = service.getStore();
      const endUser = store.getEndUserById(userId);
      if (!endUser) throw new DomainError('USER_NOT_FOUND', `User ${userId} not found`, 404);
      const methods = store.listPaymentMethodsForUser(userId).filter((m) => m.rail === 'card');
      res.json({
        payment_methods: methods.map((m) => ({
          id: m.id,
          alias: m.alias,
          is_default: !!m.is_default,
          created_at: m.created_at,
        })),
      });
    } catch (error) {
      next(error);
    }
  });

  router.delete('/api/dev/payment-methods/:id', async (req, res, next) => {
    try {
      const pmId = String(req.params.id);
      const userId = String(req.query.user_id ?? 'usr_demo').trim();
      const store = service.getStore();
      const pm = store.getPaymentMethodById(pmId);
      if (!pm || pm.end_user_id !== userId || pm.rail !== 'card') {
        throw new DomainError('NOT_FOUND', 'Payment method not found or not owned by user', 404);
      }
      const config = service.getConfig();
      if (config.stripeSecretKey) {
        try {
          const stripe = new Stripe(config.stripeSecretKey, { apiVersion: '2025-01-27.acacia' as any });
          await stripe.paymentMethods.detach(pm.external_token);
        } catch {
          /* ignore Stripe detach errors (e.g. already detached) */
        }
      }
      store.deletePaymentMethod(pmId, userId);
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  router.post('/api/dev/payment-methods/:id/default', (req, res, next) => {
    try {
      const pmId = String(req.params.id);
      const userId = String(req.query.user_id ?? req.body?.user_id ?? 'usr_demo').trim();
      const store = service.getStore();
      const updated = store.setDefaultPaymentMethod(pmId, userId);
      if (!updated) throw new DomainError('NOT_FOUND', 'Payment method not found or not owned by user', 404);
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  // ─── Dev: Stripe test card setup ───────────────────────────────────
  /* c8 ignore start - exercised in Stripe integration environments */
  router.post('/api/dev/stripe/setup-test-card', async (req, res, next) => {
    try {
      const cardNumber = String(req.body?.card_number ?? '4242424242424242').replace(/\s+/g, '');
      if (cardNumber !== '4242424242424242') {
        throw new DomainError(
          'UNSUPPORTED_TEST_CARD',
          'Only card_number 4242424242424242 is supported by this dev endpoint currently',
          400
        );
      }
      const config = service.getConfig();
      if (!config.stripeSecretKey) {
        throw new DomainError('STRIPE_NOT_CONFIGURED', 'Set STRIPE_SECRET_KEY env var to enable Stripe', 400);
      }
      const userId = String(req.body?.user_id ?? 'usr_demo');
      const stripe = new Stripe(config.stripeSecretKey, { apiVersion: '2025-01-27.acacia' as any });

      const store = service.getStore();
      const endUser = store.getEndUserById(userId);
      if (!endUser) throw new DomainError('USER_NOT_FOUND', `User ${userId} not found`, 404);

      const existingPm = store.getPreferredPaymentMethod(userId, 'card', 'card_default');
      let customerId: string;
      const existingMeta = existingPm ? safeJsonParse(existingPm.metadata_json, {} as Record<string, unknown>) : {};

      if (existingMeta.stripe_customer_id && typeof existingMeta.stripe_customer_id === 'string') {
        customerId = existingMeta.stripe_customer_id;
      } else {
        const customer = await stripe.customers.create({
          email: endUser.email,
          name: endUser.display_name,
          metadata: { aegis_user_id: userId },
        });
        customerId = customer.id;
      }

      const pm = await stripe.paymentMethods.create({
        type: 'card',
        card: { token: `tok_visa` },
      });
      await stripe.paymentMethods.attach(pm.id, { customer: customerId });
      await stripe.customers.update(customerId, {
        invoice_settings: { default_payment_method: pm.id },
      });

      const last4 = pm.card?.last4 ?? '4242';
      const brand = pm.card?.brand ?? 'visa';
      const newMeta = JSON.stringify({ psp: 'stripe', brand, last4, stripe_customer_id: customerId });

      if (existingPm) {
        store.updatePaymentMethod(existingPm.id, pm.id, `${brand.charAt(0).toUpperCase() + brand.slice(1)} **** ${last4}`, newMeta);
      } else {
        store.insertPaymentMethod(userId, 'card', `${brand.charAt(0).toUpperCase() + brand.slice(1)} **** ${last4}`, pm.id, newMeta);
      }

      res.json({
        ok: true,
        stripe_customer_id: customerId,
        stripe_payment_method_id: pm.id,
        card: { brand, last4 },
        message: `Stripe test card linked for ${userId}. Run 'npm run dev' and create a payment request to test.`,
      });
    } catch (error) {
      next(error);
    }
  });
  /* c8 ignore stop */

  router.use((error: unknown, _req: any, res: any, _next: any) => {
    if (error instanceof ZodError) {
      return res.status(400).json({ error: 'INVALID_REQUEST', details: error.issues });
    }
    if (error instanceof DomainError) {
      return res.status(error.httpStatus).json({ error: error.code, message: error.message });
    }
    console.error(error);
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Unexpected error' });
  });

  return router;
}
