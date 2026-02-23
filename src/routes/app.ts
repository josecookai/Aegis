import { Router, Request, Response, NextFunction } from 'express';
import { DomainError, AegisService } from '../services/aegis';
import { DecisionSource } from '../types';
import { ZodError } from 'zod';

const ALLOWED_APP_DECISION_SOURCES: DecisionSource[] = ['app_biometric', 'web_magic_link'];

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
