import { Router } from 'express';
import { DomainError, AegisService } from '../services/aegis';
import { DecisionSource } from '../types';

const ALLOWED_APP_DECISION_SOURCES: DecisionSource[] = ['app_biometric', 'web_magic_link'];

/**
 * App-facing approval API (mobile). Uses magic link token in query/body instead of Agent API Key.
 * Deep link: aegis://approve?token=<magic_link_token>
 */
export function createAppRouter(service: AegisService): Router {
  const router = Router();

  router.get('/api/app/approval', (req, res, next) => {
    try {
      const token = String(req.query.token ?? '').trim();
      if (!token) {
        throw new DomainError('MISSING_TOKEN', 'Query parameter token is required', 400);
      }
      const view = service.getApprovalView(token);
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
        token: view.token,
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
      if (!token) {
        throw new DomainError('MISSING_TOKEN', 'Body field token is required', 400);
      }
      const decision = String(req.body?.decision ?? '').toLowerCase();
      if (decision !== 'approve' && decision !== 'deny') {
        throw new DomainError('INVALID_DECISION', 'decision must be approve or deny', 400);
      }
      const sourceRaw = String(req.body?.decision_source ?? 'app_biometric');
      if (!ALLOWED_APP_DECISION_SOURCES.includes(sourceRaw as DecisionSource)) {
        throw new DomainError('INVALID_DECISION_SOURCE', 'decision_source must be app_biometric or web_magic_link', 400);
      }
      const action = service.submitApprovalDecision(token, decision as 'approve' | 'deny', sourceRaw as DecisionSource);
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

  return router;
}
