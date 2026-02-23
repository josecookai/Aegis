import path from 'node:path';
import { Router } from 'express';
import { randomToken } from '../lib/crypto';
import { DomainError, AegisService } from '../services/aegis';
import { AdminAuthService } from '../services/adminAuth';
import { SandboxFaultService, FaultScope, SandboxPresetName } from '../services/sandboxFaults';
import { WebAuthnService } from '../services/webauthn';
import { renderAdminLoginPage, renderAdminPage, renderApprovalPage, renderApprovalResultPage, renderEmailOutboxPage, renderHomePage, renderPasskeyDevPage, renderWebhookDevPage, renderSandboxFaultsPage } from '../views';
import { DecisionSource } from '../types';

export function createWebRouter(service: AegisService, webauthn: WebAuthnService, adminAuth: AdminAuthService, sandboxFaults: SandboxFaultService): Router {
  const router = Router();

  router.get('/login', (req, res) => {
    const next = typeof req.query.next === 'string' ? req.query.next : '/admin';
    res.type('html').send(renderAdminLoginPage({ next }));
  });

  router.post('/login', (req, res) => {
    const password = String(req.body?.password ?? '');
    const next = sanitizeNextPath(String(req.body?.next ?? '/admin'));
    if (!adminAuth.verifyPassword(password)) {
      res.status(401).type('html').send(renderAdminLoginPage({ error: 'Invalid password', next }));
      return;
    }
    const token = adminAuth.issueSessionToken();
    res.cookie('aegis_admin_session', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      maxAge: 12 * 60 * 60 * 1000,
    });
    res.redirect(next);
  });

  router.post('/logout', (_req, res) => {
    res.clearCookie('aegis_admin_session');
    res.redirect('/login');
  });

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
    const passkeyCount = view.endUser ? service.getStore().countPasskeysForUser(view.endUser.id) : 0;
    res.type('html').send(renderApprovalPage({ ...view, csrfToken: csrf, passkeyCount }));
  });

  router.post('/approve/:token/passkey/options', async (req, res, next) => {
    try {
      const csrfCookie = req.cookies?.aegis_csrf;
      const csrfBody = req.body?.csrf;
      if (!csrfCookie || !csrfBody || csrfCookie !== csrfBody) {
        throw new DomainError('CSRF_FAILED', 'CSRF validation failed', 403);
      }
      const options = await webauthn.generateApprovalAuthenticationOptions(req.params.token);
      res.json({ options });
    } catch (error) {
      next(error);
    }
  });

  router.post('/approve/:token/passkey-decision', async (req, res, next) => {
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
      await webauthn.verifyApprovalAuthentication(req.params.token, req.body?.assertion);
      const action = service.submitApprovalDecision(req.params.token, decision as 'approve' | 'deny', 'web_passkey');
      res.json({ ok: true, action_id: action.id, status: action.status, redirect_url: `/approve/${encodeURIComponent(req.params.token)}` });
    } catch (error) {
      next(error);
    }
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

  router.get('/dev/passkeys', (req, res) => {
    const users = service.getStore().listEndUsers().map((u) => ({ id: u.id, email: u.email, display_name: u.display_name }));
    const selectedUserId = String(req.query.user_id ?? users[0]?.id ?? '');
    const passkeys = selectedUserId
      ? service.getStore().listPasskeysForUser(selectedUserId).map((p) => ({
          id: p.id,
          user_id: p.user_id,
          credential_id: `${p.credential_id.slice(0, 12)}...`,
          counter: p.counter,
          device_type: p.device_type,
          backed_up: !!p.backed_up,
          transports: p.transports,
          created_at: p.created_at,
          last_used_at: p.last_used_at,
        }))
      : [];
    res.type('html').send(renderPasskeyDevPage({ users, selectedUserId, passkeys }));
  });

  router.get('/dev/webhooks', (req, res) => {
    const actionId = req.query.action_id ? String(req.query.action_id) : undefined;
    const status = req.query.status ? String(req.query.status) : undefined;
    const deliveries = service
      .listWebhookDeliveries({ actionId, status, limit: 200 })
      .map((d: any) => ({ ...d, payload: JSON.parse(String(d.payload_json ?? '{}')) }));
    res.type('html').send(renderWebhookDevPage({ deliveries, filters: { action_id: actionId, status } }));
  });

  router.get('/dev/sandbox', (req, res) => {
    const message = typeof req.query.message === 'string' ? req.query.message : undefined;
    res.type('html').send(renderSandboxFaultsPage({ snapshot: sandboxFaults.getSnapshot(), message }));
  });

  router.post('/dev/sandbox/set', (req, res, next) => {
    try {
      const rail = String(req.body?.rail ?? '');
      const mode = String(req.body?.mode ?? '');
      const scope = (String(req.body?.scope ?? 'once') as FaultScope);
      if (!['once', 'sticky'].includes(scope)) throw new DomainError('INVALID_SCOPE', 'Invalid scope', 400);
      if (rail === 'card') {
        if (!['none', 'decline', 'timeout'].includes(mode)) throw new DomainError('INVALID_MODE', 'Invalid card mode', 400);
        sandboxFaults.setCardFault(mode as any, scope);
      } else if (rail === 'crypto') {
        if (!['none', 'revert', 'timeout'].includes(mode)) throw new DomainError('INVALID_MODE', 'Invalid crypto mode', 400);
        sandboxFaults.setCryptoFault(mode as any, scope);
      } else {
        throw new DomainError('INVALID_RAIL', 'Invalid rail', 400);
      }
      res.redirect(`/dev/sandbox?message=${encodeURIComponent(`Set ${rail}:${mode} (${scope})`)}`);
    } catch (error) {
      next(error);
    }
  });

  router.post('/dev/sandbox/preset', (req, res, next) => {
    try {
      const preset = String(req.body?.preset ?? '') as SandboxPresetName;
      const allowed: SandboxPresetName[] = ['PSP_DECLINE_DEMO', 'CHAIN_REVERT_DEMO', 'TIMEOUT_DEMO'];
      if (!allowed.includes(preset)) throw new DomainError('INVALID_PRESET', 'Invalid preset', 400);
      sandboxFaults.applyPreset(preset);
      res.redirect(`/dev/sandbox?message=${encodeURIComponent(`Applied preset ${preset}`)}`);
    } catch (error) {
      next(error);
    }
  });

  router.post('/dev/sandbox/reset', (_req, res) => {
    sandboxFaults.resetAll();
    res.redirect('/dev/sandbox?message=Sandbox%20faults%20reset');
  });

  router.post('/dev/webhooks/:deliveryId/requeue', (req, res, next) => {
    try {
      service.requeueWebhookDelivery(req.params.deliveryId);
      const back = typeof req.header('referer') === 'string' ? req.header('referer')! : '/dev/webhooks';
      res.redirect(back);
    } catch (error) {
      next(error);
    }
  });

  router.post('/dev/passkeys/register/options', async (req, res, next) => {
    try {
      const userId = String(req.body?.user_id ?? '');
      if (!userId) throw new DomainError('INVALID_END_USER', 'user_id is required', 400);
      const options = await webauthn.generateRegistrationOptionsForUser(userId);
      res.json({ options });
    } catch (error) {
      next(error);
    }
  });

  router.post('/dev/passkeys/register/verify', async (req, res, next) => {
    try {
      const userId = String(req.body?.user_id ?? '');
      if (!userId) throw new DomainError('INVALID_END_USER', 'user_id is required', 400);
      const result = await webauthn.verifyRegistrationForUser(userId, req.body?.response);
      res.json({ ok: true, credential_id: result.credentialId });
    } catch (error) {
      next(error);
    }
  });

  router.post('/dev/passkeys/auth/options', async (req, res, next) => {
    try {
      const userId = String(req.body?.user_id ?? '');
      if (!userId) throw new DomainError('INVALID_END_USER', 'user_id is required', 400);
      const options = await webauthn.generateAuthenticationOptionsForUser(userId);
      res.json({ options });
    } catch (error) {
      next(error);
    }
  });

  router.post('/dev/passkeys/auth/verify', async (req, res, next) => {
    try {
      const userId = String(req.body?.user_id ?? '');
      if (!userId) throw new DomainError('INVALID_END_USER', 'user_id is required', 400);
      const result = await webauthn.verifyAuthenticationForUser(userId, req.body?.response);
      res.json({ ok: result.verified });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

function sanitizeNextPath(input: string): string {
  if (!input.startsWith('/')) return '/admin';
  if (input.startsWith('//')) return '/admin';
  return input;
}
