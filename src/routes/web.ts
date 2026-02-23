import path from 'node:path';
import { Router } from 'express';
import { randomToken } from '../lib/crypto';
import { DomainError, AegisService } from '../services/aegis';
import { renderAdminPage, renderApprovalPage, renderApprovalResultPage, renderEmailOutboxPage, renderHomePage } from '../views';
import { DecisionSource } from '../types';

export function createWebRouter(service: AegisService): Router {
  const router = Router();

  router.get('/', (_req, res) => {
    res.type('html').send(renderHomePage());
  });

  router.get('/healthz', (_req, res) => {
    res.json({ ok: true, service: 'aegis-mvp', time: new Date().toISOString() });
  });

  router.get('/docs/openapi.yaml', (_req, res) => {
    const file = path.join(process.cwd(), 'docs', 'openapi.yaml');
    res.type('yaml').sendFile(file);
  });

  router.get('/approve/:token', (req, res) => {
    const view = service.getApprovalView(req.params.token);
    const csrf = randomToken(16);
    res.cookie('aegis_csrf', csrf, {
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      maxAge: 15 * 60 * 1000,
    });
    res.type('html').send(renderApprovalPage({ ...view, csrfToken: csrf }));
  });

  router.post('/approve/:token/decision', (req, res, next) => {
    try {
      const csrfCookie = req.cookies?.aegis_csrf;
      const csrfBody = req.body?.csrf;
      if (!csrfCookie || !csrfBody || csrfCookie !== csrfBody) {
        throw new DomainError('CSRF_FAILED', 'CSRF validation failed', 403);
      }

      const decision = String(req.body?.decision ?? '');
      if (decision !== 'approve' && decision !== 'deny') {
        throw new DomainError('INVALID_DECISION', 'decision must be approve or deny', 400);
      }
      const sourceRaw = String(req.body?.decision_source ?? 'web_magic_link');
      const allowedSources = new Set<DecisionSource>(['web_passkey', 'web_otp', 'web_magic_link']);
      if (!allowedSources.has(sourceRaw as DecisionSource)) {
        throw new DomainError('INVALID_DECISION_SOURCE', 'Unsupported decision source', 400);
      }

      const action = service.submitApprovalDecision(req.params.token, decision as 'approve' | 'deny', sourceRaw as DecisionSource);
      const msg = decision === 'approve' ? 'Request approved. Execution will continue asynchronously.' : 'Request denied.';
      res.type('html').send(renderApprovalResultPage({ status: 'ok', message: msg, action }));
    } catch (error) {
      if (error instanceof DomainError) {
        const view = service.getApprovalView(req.params.token);
        res.status(error.httpStatus).type('html').send(renderApprovalResultPage({ status: 'error', message: error.message, action: view.action }));
        return;
      }
      next(error);
    }
  });

  router.get('/admin', (_req, res) => {
    res.type('html').send(renderAdminPage(service.getAdminDashboardData()));
  });

  router.get('/dev/emails', (_req, res) => {
    res.type('html').send(renderEmailOutboxPage(service.getStore().listEmailOutbox(100)));
  });

  return router;
}
