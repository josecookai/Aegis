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
      const input = requestActionSchema.parse(req.body);
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

  // ─── Dev: Stripe test card setup ───────────────────────────────────
  router.post('/api/dev/stripe/setup-test-card', async (req, res, next) => {
    try {
      const config = service.getConfig();
      if (!config.stripeSecretKey) {
        throw new DomainError('STRIPE_NOT_CONFIGURED', 'Set STRIPE_SECRET_KEY env var to enable Stripe', 400);
      }
      const userId = String(req.body?.user_id ?? 'usr_demo');
      const cardNumber = String(req.body?.card_number ?? '4242424242424242');
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
