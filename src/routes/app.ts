import { Router, Request, Response, NextFunction } from 'express';
import Stripe from 'stripe';
import { DomainError, AegisService } from '../services/aegis';
import { ACTION_STATUSES, ActionStatus, DecisionSource } from '../types';
import { ZodError } from 'zod';
import { safeJsonParse, sha256 } from '../lib/crypto';

const ALLOWED_APP_DECISION_SOURCES: DecisionSource[] = ['app_biometric', 'web_magic_link'];

/**
 * Requires valid app session cookie. Attaches req.appUserId and req.appEndUser.
 */
function requireAppSession(service: AegisService) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const config = service.getConfig();
    const token = (req.cookies?.[config.appSessionCookieName] ?? req.cookies?.aegis_app_session) as string | undefined;
    if (!token) {
      return next(new DomainError('UNAUTHORIZED', 'App session required. Log in via magic link.', 401));
    }
    const session = service.getStore().findAppSessionByToken(token);
    if (!session) {
      return next(new DomainError('UNAUTHORIZED', 'Invalid or expired session', 401));
    }
    const endUser = service.getStore().getEndUserById(session.endUserId);
    if (!endUser || endUser.status !== 'active') {
      return next(new DomainError('INVALID_USER', 'User not found or inactive', 403));
    }
    (req as any).appUserId = session.endUserId;
    (req as any).appEndUser = endUser;
    next();
  };
}

/**
 * Validates that the supplied user_id belongs to an active end user.
 * NOTE: This is NOT full authentication — it only prevents calls with
 * unknown/inactive user IDs. A proper login + session system is required
 * before production launch. See TODO below.
 */
function requireValidUser(service: AegisService) {
  return (req: Request, _res: Response, next: NextFunction) => {
    // TODO(auth): Replace this with real session/JWT auth before production.
    // Currently there is no proof that the caller IS the user — only that the
    // user_id exists. This is acceptable for the MVP demo but is a security
    // gap that MUST be closed before any real funds are handled.
    const userId = String((req.query.user_id ?? req.body?.user_id) ?? '').trim();
    if (!userId) {
      return next(new DomainError('MISSING_USER_ID', 'user_id is required', 400));
    }
    const endUser = service.getStore().getEndUserById(userId);
    if (!endUser || endUser.status !== 'active') {
      return next(new DomainError('INVALID_USER', 'Unknown or inactive user', 403));
    }
    (req as any).validatedUserId = userId;
    (req as any).validatedEndUser = endUser;
    next();
  };
}

function assertActiveUserForActionIdBranch(service: AegisService, userId: string): void {
  const endUser = service.getStore().getEndUserById(userId);
  if (!endUser || endUser.status !== 'active') {
    throw new DomainError('INVALID_USER', 'Unknown or inactive user', 403);
  }
}

/**
 * App-facing approval API (mobile). Uses magic link token in query/body instead of Agent API Key.
 * Deep link: aegis://approve?token=<magic_link_token>
 */
export function createAppRouter(service: AegisService): Router {
  const router = Router();

  router.get('/api/app/pending', requireValidUser(service), (req, res, next) => {
    try {
      const userId = (req as any).validatedUserId as string;
      const store = service.getStore();
      const items = store.listActionsByUserAndStatus(userId, 'awaiting_approval');
      res.json({
        items: store.toActionApiResponseBatch(items),
        count: items.length,
      });
    } catch (error) {
      next(error);
    }
  });

  router.get('/api/app/history', requireValidUser(service), (req, res, next) => {
    try {
      const userId = (req as any).validatedUserId as string;
      const limit = Math.max(1, Math.min(200, Number(req.query.limit) || 50));
      const offset = Math.max(0, Number(req.query.offset) || 0);
      const store = service.getStore();
      const { rows, total } = store.listActionsByUser(userId, limit, offset);
      res.json({
        items: store.toActionApiResponseBatch(rows),
        total,
        limit,
        offset,
      });
    } catch (error) {
      next(error);
    }
  });

  router.get('/api/app/admin/history', (req, res, next) => {
    try {
      const limit = Math.max(1, Math.min(200, Number(req.query.limit) || 50));
      const offset = Math.max(0, Number(req.query.offset) || 0);
      const statusRaw = String(req.query.status ?? '').trim();
      const userId = String(req.query.user_id ?? '').trim() || undefined;
      let status: ActionStatus | undefined;
      if (statusRaw) {
        if (!(ACTION_STATUSES as readonly string[]).includes(statusRaw)) {
          throw new DomainError('INVALID_STATUS', 'Unsupported status filter', 400);
        }
        status = statusRaw as ActionStatus;
      }
      const store = service.getStore();
      const { rows, total } = store.listActionsForAdmin({ limit, offset, status, userId });
      res.json({
        items: store.toActionApiResponseBatch(rows),
        total,
        limit,
        offset,
        filters: { status: status ?? null, user_id: userId ?? null },
      });
    } catch (error) {
      next(error);
    }
  });

  router.get('/api/app/approval', (req, res, next) => {
    try {
      const token = String(req.query.token ?? '').trim();
      const actionId = String(req.query.action_id ?? '').trim();
      const userId = String(req.query.user_id ?? '').trim();

      let view: ReturnType<typeof service.getApprovalView | typeof service.getApprovalViewByActionId>;
      if (token) {
        view = service.getApprovalView(token);
      } else if (actionId && userId) {
        assertActiveUserForActionIdBranch(service, userId);
        view = service.getApprovalViewByActionId(actionId, userId);
      } else {
        throw new DomainError('MISSING_PARAMS', 'Provide token OR action_id+user_id', 400);
      }

      if (!view.valid) {
        return res.status(400).json({
          valid: false,
          reason: view.reason ?? 'Invalid or expired link',
        });
      }
      const action = view.action!;
      const endUser = view.endUser!;
      res.json({
        valid: true,
        token: 'token' in view ? (view as any).token : null,
        already_decided: view.alreadyDecided ?? false,
        decision: view.decision ?? null,
        action: service.getStore().toActionApiResponse(action),
        end_user: {
          id: endUser.id,
          email: endUser.email,
          display_name: endUser.display_name,
        },
      });
    } catch (error) {
      next(error);
    }
  });

  router.post('/api/app/approval/decision', (req, res, next) => {
    try {
      const token = String(req.body?.token ?? '').trim();
      const actionId = String(req.body?.action_id ?? '').trim();
      const userId = String(req.body?.user_id ?? '').trim();

      if (!token && !(actionId && userId)) {
        throw new DomainError('MISSING_PARAMS', 'Provide token OR action_id+user_id', 400);
      }
      const decision = String(req.body?.decision ?? '').toLowerCase();
      if (decision !== 'approve' && decision !== 'deny') {
        throw new DomainError('INVALID_DECISION', 'decision must be approve or deny', 400);
      }
      const sourceRaw = String(req.body?.decision_source ?? 'app_biometric');
      if (!ALLOWED_APP_DECISION_SOURCES.includes(sourceRaw as DecisionSource)) {
        throw new DomainError('INVALID_DECISION_SOURCE', 'decision_source must be app_biometric or web_magic_link', 400);
      }

      let action;
      if (token) {
        action = service.submitApprovalDecision(token, decision as 'approve' | 'deny', sourceRaw as DecisionSource);
      } else {
        assertActiveUserForActionIdBranch(service, userId);
        action = service.submitDecisionByActionId(actionId, userId, decision as 'approve' | 'deny', sourceRaw as DecisionSource);
      }

      res.json({
        ok: true,
        action_id: action.id,
        request_id: action.id,
        status: action.status,
      });
    } catch (error) {
      next(error);
    }
  });

  router.post('/api/app/devices', requireValidUser(service), (req, res, next) => {
    try {
      const userId = (req as any).validatedUserId as string;
      const platform = String(req.body?.platform ?? '').trim();
      const pushToken = String(req.body?.push_token ?? '').trim();
      if (platform !== 'ios' && platform !== 'android') {
        throw new DomainError('INVALID_PLATFORM', 'platform must be ios or android', 400);
      }
      if (!pushToken) throw new DomainError('MISSING_PUSH_TOKEN', 'Body field push_token is required', 400);
      const device = service.getStore().upsertDevice(userId, platform, pushToken);
      res.json({ ok: true, device_id: device.id });
    } catch (error) {
      next(error);
    }
  });

  router.get('/api/app/devices', requireValidUser(service), (req, res, next) => {
    try {
      const userId = (req as any).validatedUserId as string;
      const devices = service.getStore().listDevicesForUser(userId);
      res.json({ devices });
    } catch (error) {
      next(error);
    }
  });

  router.delete('/api/app/devices/:id', requireValidUser(service), (req, res, next) => {
    try {
      const userId = (req as any).validatedUserId as string;
      const deviceId = String(req.params.id);
      const store = service.getStore();
      const devices = store.listDevicesForUser(userId);
      if (!devices.some(d => d.id === deviceId)) {
        throw new DomainError('NOT_FOUND', 'Device not found or not owned by this user', 404);
      }
      store.deleteDevice(deviceId);
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  // ─── Session-based app routes (requireAppSession) ────────────────────────

  router.get('/api/app/plans', (_req, res, next) => {
    try {
      const store = service.getStore();
      const plans = store.listPlans();
      res.json({
        plans: plans.map((p) => ({
          id: p.id,
          name: p.name,
          price_cents: p.price_cents,
          interval: p.interval,
          features: JSON.parse(p.features_json || '[]') as string[],
        })),
      });
    } catch (error) {
      next(error);
    }
  });

  router.get('/api/app/me', requireAppSession(service), (req, res, next) => {
    try {
      const user = (req as any).appEndUser;
      const store = service.getStore();
      const plan = store.getUserPlan(user.id);
      res.json({
        user: { id: user.id, email: user.email, display_name: user.display_name },
        plan: plan ? { id: plan.plan_id, name: plan.name, price_cents: plan.price_cents, interval: plan.interval, features: JSON.parse(plan.features_json || '[]') } : null,
      });
    } catch (error) {
      next(error);
    }
  });

  router.post('/api/app/agents', requireAppSession(service), (req, res, next) => {
    try {
      const userId = (req as any).appUserId as string;
      const name = String(req.body?.name ?? 'My Agent').trim() || 'My Agent';
      const store = service.getStore();
      const crypto = require('node:crypto');
      const apiKey = `aegis_${crypto.randomBytes(24).toString('hex')}`;
      const webhookSecret = `whsec_${crypto.randomBytes(16).toString('hex')}`;
      const agent = store.insertAgent(name, sha256(apiKey), webhookSecret, userId);
      store.linkAgentToUser(agent.id, userId);
      res.status(201).json({
        ok: true,
        agent: { id: agent.id, name: agent.name, status: agent.status, created_at: agent.created_at },
        api_key: apiKey,
        webhook_secret: webhookSecret,
        message: 'Agent created. Store API key securely; it will not be shown again.',
      });
    } catch (error) {
      next(error);
    }
  });

  router.get('/api/app/agents', requireAppSession(service), (req, res, next) => {
    try {
      const userId = (req as any).appUserId as string;
      const store = service.getStore();
      const agents = store.listAgentsByOwner(userId);
      res.json({
        agents: agents.map((a) => ({ id: a.id, name: a.name, status: a.status, created_at: a.created_at })),
      });
    } catch (error) {
      next(error);
    }
  });

  router.delete('/api/app/agents/:id', requireAppSession(service), (req, res, next) => {
    try {
      const userId = (req as any).appUserId as string;
      const agentId = String(req.params.id);
      const store = service.getStore();
      const deleted = store.deleteAgent(agentId, userId);
      if (!deleted) {
        throw new DomainError('NOT_FOUND', 'Agent not found or not owned by you', 404);
      }
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  router.post('/api/app/payment-methods', requireAppSession(service), async (req, res, next) => {
    try {
      const userId = (req as any).appUserId as string;
      const paymentMethodId = String(req.body?.payment_method_id ?? '').trim();
      if (!paymentMethodId || !paymentMethodId.startsWith('pm_')) {
        throw new DomainError('INVALID_PAYMENT_METHOD', 'payment_method_id (Stripe pm_xxx) is required', 400);
      }
      const config = service.getConfig();
      if (!config.stripeSecretKey) {
        throw new DomainError('STRIPE_NOT_CONFIGURED', 'Set STRIPE_SECRET_KEY to add cards', 400);
      }
      const store = service.getStore();
      const endUser = store.getEndUserById(userId)!;
      const stripe = new Stripe(config.stripeSecretKey!, { apiVersion: '2025-01-27.acacia' as any });
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
      });
    } catch (error) {
      next(error);
    }
  });

  router.get('/api/app/payment-methods', requireAppSession(service), (req, res, next) => {
    try {
      const userId = (req as any).appUserId as string;
      const store = service.getStore();
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

  router.delete('/api/app/payment-methods/:id', requireAppSession(service), async (req, res, next) => {
    try {
      const userId = (req as any).appUserId as string;
      const pmId = String(req.params.id);
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
          /* ignore */
        }
      }
      store.deletePaymentMethod(pmId, userId);
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  router.post('/api/app/payment-methods/:id/default', requireAppSession(service), (req, res, next) => {
    try {
      const userId = (req as any).appUserId as string;
      const pmId = String(req.params.id);
      const store = service.getStore();
      const updated = store.setDefaultPaymentMethod(pmId, userId);
      if (!updated) throw new DomainError('NOT_FOUND', 'Payment method not found or not owned by user', 404);
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  router.use((error: unknown, _req: any, res: any, _next: any) => {
    if (error instanceof DomainError) {
      return res.status(error.httpStatus).json({ error: error.code, message: error.message });
    }
    if (error instanceof ZodError) {
      return res.status(400).json({ error: 'INVALID_REQUEST', details: error.issues });
    }
    console.error('[app-router] Unhandled error:', error);
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Unexpected error' });
  });

  return router;
}
