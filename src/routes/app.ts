import { Router, Request, Response, NextFunction } from 'express';
import { DomainError, AegisService } from '../services/aegis';
import { DecisionSource } from '../types';
import { ZodError } from 'zod';
import Stripe from 'stripe';
import { safeJsonParse } from '../lib/crypto';

const ALLOWED_APP_DECISION_SOURCES: DecisionSource[] = ['app_biometric', 'web_magic_link'];

/**
 * Validates app session cookie. Sets validatedUserId from session.
 */
function requireAppSession(service: AegisService) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const config = service.getConfig();
    const token = (req as any).cookies?.[config.appSessionCookieName];
    if (!token) {
      return next(new DomainError('UNAUTHORIZED', 'App session required', 401));
    }
    const session = service.getStore().verifyAppSession(token);
    if (!session) {
      return next(new DomainError('UNAUTHORIZED', 'Invalid or expired session', 401));
    }
    const endUser = service.getStore().getEndUserById(session.userId);
    if (!endUser || endUser.status !== 'active') {
      return next(new DomainError('INVALID_USER', 'User not found', 403));
    }
    (req as any).validatedUserId = session.userId;
    (req as any).validatedEndUser = endUser;
    next();
  };
}

/**
 * Tries app session first, then user_id param (backward compat).
 */
function requireAppSessionOrUser(service: AegisService) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const config = service.getConfig();
    const token = (req as any).cookies?.[config.appSessionCookieName];
    if (token) {
      const session = service.getStore().verifyAppSession(token);
      if (session) {
        const endUser = service.getStore().getEndUserById(session.userId);
        if (endUser && endUser.status === 'active') {
          (req as any).validatedUserId = session.userId;
          (req as any).validatedEndUser = endUser;
          return next();
        }
      }
    }
    const userId = String((req.query.user_id ?? req.body?.user_id) ?? '').trim();
    if (!userId) return next(new DomainError('MISSING_USER_ID', 'user_id or app session required', 400));
    const endUser = service.getStore().getEndUserById(userId);
    if (!endUser || endUser.status !== 'active') return next(new DomainError('INVALID_USER', 'Unknown or inactive user', 403));
    (req as any).validatedUserId = userId;
    (req as any).validatedEndUser = endUser;
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

function requireAdminUser(service: AegisService) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      const userId = String((req.query.user_id ?? req.body?.user_id) ?? '').trim();
      if (!userId) throw new DomainError('MISSING_USER_ID', 'user_id is required', 400);
      const ctx = service.resolveUserContext(userId);
      if (ctx.endUser.status !== 'active' || ctx.membershipStatus !== 'active') {
        throw new DomainError('INVALID_USER', 'Unknown or inactive user', 403);
      }
      if (ctx.role !== 'admin') throw new DomainError('ADMIN_AUTH_REQUIRED', 'Admin team member required', 403);
      (req as any).validatedUserId = userId;
      (req as any).validatedUserContext = ctx;
      next();
    } catch (error) {
      next(error);
    }
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

  router.get('/api/app/me', requireAppSession(service), (req, res, next) => {
    try {
      const userId = (req as any).validatedUserId as string;
      const endUser = (req as any).validatedEndUser;
      const store = service.getStore();
      const userPlan = store.getUserPlan(userId);
      res.json({
        id: endUser.id,
        email: endUser.email,
        display_name: endUser.display_name,
        plan: userPlan ? { id: userPlan.plan.id, name: userPlan.plan.name, slug: userPlan.plan.slug } : null,
      });
    } catch (error) {
      next(error);
    }
  });

  router.get('/api/app/plans', (req, res, next) => {
    try {
      const plans = service.getStore().listPlans();
      res.json({
        plans: plans.map((p) => ({
          id: p.id,
          name: p.name,
          slug: p.slug,
          price_cents: p.price_cents,
          interval: p.interval,
          features: safeJsonParse(p.features_json, {} as Record<string, unknown>),
        })),
      });
    } catch (error) {
      next(error);
    }
  });

  router.post('/api/app/agents', requireAppSession(service), (req, res, next) => {
    try {
      const userId = (req as any).validatedUserId as string;
      const name = String(req.body?.name ?? 'My Agent').trim();
      if (!name) throw new DomainError('INVALID_NAME', 'name is required', 400);
      const { agent, apiKey } = service.getStore().createAgentForUser(userId, name);
      res.status(201).json({
        agent: { id: agent.id, name: agent.name, status: agent.status, created_at: agent.created_at },
        api_key: apiKey,
        message: 'API key is shown only once. Store it securely.',
      });
    } catch (error) {
      next(error);
    }
  });

  router.get('/api/app/agents', requireAppSession(service), (req, res, next) => {
    try {
      const userId = (req as any).validatedUserId as string;
      const agents = service.getStore().listAgentsByOwner(userId);
      res.json({
        agents: agents.map((a) => ({ id: a.id, name: a.name, status: a.status, created_at: a.created_at })),
      });
    } catch (error) {
      next(error);
    }
  });

  router.delete('/api/app/agents/:id', requireAppSession(service), (req, res, next) => {
    try {
      const userId = (req as any).validatedUserId as string;
      const agentId = String(req.params.id);
      const ok = service.getStore().deleteAgentIfOwned(agentId, userId);
      if (!ok) throw new DomainError('NOT_FOUND', 'Agent not found or not owned by you', 404);
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  router.get('/api/app/pending', requireAppSessionOrUser(service), (req, res, next) => {
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

  router.get('/api/app/history', requireAppSessionOrUser(service), (req, res, next) => {
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

  router.get('/api/app/admin/history', requireAdminUser(service), (req, res, next) => {
    try {
      const userId = (req as any).validatedUserId as string;
      const limit = Math.max(1, Math.min(200, Number(req.query.limit) || 50));
      const offset = Math.max(0, Number(req.query.offset) || 0);
      res.json(service.getTeamHistoryForAdmin(userId, { limit, offset }));
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

  router.post('/api/app/devices', requireAppSessionOrUser(service), (req, res, next) => {
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

  router.post('/api/app/payment-methods', requireAppSessionOrUser(service), async (req, res, next) => {
    try {
      const paymentMethodId = String(req.body?.payment_method_id ?? '').trim();
      const userId = (req as any).validatedUserId as string;
      if (!paymentMethodId || !paymentMethodId.startsWith('pm_')) {
        throw new DomainError('INVALID_PAYMENT_METHOD', 'payment_method_id (Stripe pm_xxx) is required', 400);
      }
      const config = service.getConfig();
      if (!config.stripeSecretKey) {
        throw new DomainError('STRIPE_NOT_CONFIGURED', 'Set STRIPE_SECRET_KEY and STRIPE_PUBLISHABLE_KEY to add cards', 400);
      }
      const store = service.getStore();
      const endUser = store.getEndUserById(userId);
      if (!endUser) throw new DomainError('USER_NOT_FOUND', `User ${userId} not found`, 404);

      const stripe = new Stripe(config.stripeSecretKey, { apiVersion: '2025-01-27.acacia' as any });
      const pm = await stripe.paymentMethods.retrieve(paymentMethodId);
      if (pm.type !== 'card' || !pm.card) {
        throw new DomainError('INVALID_PAYMENT_METHOD', 'Only card payment methods are supported', 400);
      }

      const existingPm = store.getPreferredPaymentMethod(userId, 'card', 'card_default');
      const existingMeta = existingPm ? safeJsonParse<Record<string, unknown>>(existingPm.metadata_json, {}) : {};
      let customerId = typeof existingMeta.stripe_customer_id === 'string' ? existingMeta.stripe_customer_id : '';
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: endUser.email,
          name: endUser.display_name,
          metadata: { aegis_user_id: userId },
        });
        customerId = customer.id;
      }

      await stripe.paymentMethods.attach(paymentMethodId, { customer: customerId }).catch((attachErr: any) => {
        if (attachErr?.code === 'resource_already_attached_to_customer') {
          throw new DomainError('CARD_ALREADY_SAVED', 'This card is already saved to another account', 400);
        }
        throw attachErr;
      });
      await stripe.customers.update(customerId, { invoice_settings: { default_payment_method: paymentMethodId } });

      const brand = pm.card.brand ?? 'card';
      const last4 = pm.card.last4 ?? '****';
      const alias = `${brand.charAt(0).toUpperCase() + brand.slice(1)} **** ${last4}`;
      const metadataJson = JSON.stringify({
        psp: 'stripe',
        brand,
        last4,
        exp_month: pm.card.exp_month ?? null,
        exp_year: pm.card.exp_year ?? null,
        stripe_customer_id: customerId,
      });
      const id = store.insertPaymentMethod(userId, 'card', alias, paymentMethodId, metadataJson);
      res.status(201).json({ ok: true, payment_method_id: id });
    } catch (error) {
      next(error);
    }
  });

  router.get('/api/app/payment-methods', requireAppSessionOrUser(service), (req, res, next) => {
    try {
      const userId = (req as any).validatedUserId as string;
      const methods = service
        .getStore()
        .listPaymentMethodsForUser(userId)
        .filter((m) => m.rail === 'card')
        .map((m) => {
          const md = safeJsonParse<Record<string, unknown>>(m.metadata_json, {});
          return {
            payment_method_id: m.id,
            alias: m.alias,
            brand: typeof md.brand === 'string' ? md.brand : null,
            last4: typeof md.last4 === 'string' ? md.last4 : null,
            exp_month: typeof md.exp_month === 'number' ? md.exp_month : null,
            exp_year: typeof md.exp_year === 'number' ? md.exp_year : null,
            is_default: !!m.is_default,
            created_at: m.created_at,
          };
        });
      res.json({ payment_methods: methods });
    } catch (error) {
      next(error);
    }
  });

  router.post('/api/app/payment-methods/:id/default', requireAppSessionOrUser(service), (req, res, next) => {
    try {
      const userId = (req as any).validatedUserId as string;
      const ok = service.getStore().setDefaultPaymentMethod(String(req.params.id), userId);
      if (!ok) throw new DomainError('PAYMENT_METHOD_NOT_FOUND', 'Payment method not found or not owned by user', 404);
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  router.delete('/api/app/payment-methods/:id', requireAppSessionOrUser(service), async (req, res, next) => {
    try {
      const userId = (req as any).validatedUserId as string;
      const pmId = String(req.params.id);
      const store = service.getStore();
      const pm = store.getPaymentMethodById(pmId);
      if (!pm || pm.end_user_id !== userId || pm.rail !== 'card') {
        throw new DomainError('PAYMENT_METHOD_NOT_FOUND', 'Payment method not found or not owned by user', 404);
      }
      const config = service.getConfig();
      if (config.stripeSecretKey) {
        try {
          const stripe = new Stripe(config.stripeSecretKey, { apiVersion: '2025-01-27.acacia' as any });
          await stripe.paymentMethods.detach(pm.external_token);
        } catch {
          // Ignore detach failures; local record deletion is the source of truth for MVP.
        }
      }
      store.deletePaymentMethod(pmId, userId);
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  router.get('/api/app/devices', requireAppSessionOrUser(service), (req, res, next) => {
    try {
      const userId = (req as any).validatedUserId as string;
      const devices = service.getStore().listDevicesForUser(userId);
      res.json({ devices });
    } catch (error) {
      next(error);
    }
  });

  router.delete('/api/app/devices/:id', requireAppSessionOrUser(service), (req, res, next) => {
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
