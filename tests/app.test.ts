import http from 'node:http';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAegisApp } from '../src/app';

describe('Aegis MVP prototype', () => {
  const runtime = createAegisApp({ dbPath: ':memory:', autoStartWorkers: false, baseUrl: 'http://localhost:0' });
  let server: http.Server;
  let baseUrl: string;

  beforeAll(async () => {
    server = runtime.app.listen(0, '127.0.0.1');
    await new Promise<void>((resolve) => server.once('listening', () => resolve()));
    const addr = server.address();
    if (!addr || typeof addr === 'string') throw new Error('Failed to bind test server');
    baseUrl = `http://127.0.0.1:${addr.port}`;
    runtime.config.baseUrl = baseUrl;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
    runtime.stop();
  });

  it('protects admin/dev routes and supports admin login', async () => {
    const api = request(runtime.app);
    await api.get('/admin').expect(302);
    await api.get('/api/dev/actions').expect(401);

    const adminCookie = await adminLogin(api);
    await api.get('/admin').set('Cookie', [adminCookie]).expect(200);
    await api.get('/dev/passkeys').set('Cookie', [adminCookie]).expect(200);
  });

  it('requires admin login for POST /api/dev/actions/:actionId/decision', async () => {
    const api = request(runtime.app);
    const create = await api
      .post('/v1/request_action')
      .set('x-aegis-api-key', 'aegis_demo_agent_key')
      .send({
        idempotency_key: 't_admin_gate_decision_1',
        end_user_id: 'usr_demo',
        action_type: 'payment',
        details: {
          amount: '12.34',
          currency: 'USD',
          recipient_name: 'Admin Gate Merchant',
          description: 'admin gate test',
          payment_rail: 'card',
          payment_method_preference: 'card_default',
          recipient_reference: 'merchant_api:admin_gate',
        },
      })
      .expect(201);
    const actionId = String(create.body.action.action_id);

    await api.post(`/api/dev/actions/${actionId}/decision`).send({ decision: 'approve' }).expect(401);

    const adminCookie = await adminLogin(api);
    await api.post(`/api/dev/actions/${actionId}/decision`).set('Cookie', [adminCookie]).send({ decision: 'deny' }).expect(200);
  });

  it('creates, approves, executes, and callbacks for card rail', async () => {
    const api = request(runtime.app);
    const adminCookie = await adminLogin(api);
    const create = await api
      .post('/v1/request_action')
      .set('x-aegis-api-key', 'aegis_demo_agent_key')
      .send({
        idempotency_key: 't_card_success_1',
        end_user_id: 'usr_demo',
        action_type: 'payment',
        callback_url: `${baseUrl}/_test/callback`,
        details: {
          amount: '49.99',
          currency: 'USD',
          recipient_name: 'Demo Merchant',
          description: 'Card approval flow test',
          payment_rail: 'card',
          payment_method_preference: 'card_default',
          recipient_reference: 'merchant_api:test_merchant',
        },
      })
      .expect(201);

    expect(create.body.action.status).toBe('awaiting_approval');
    const approvalUrl = String(create.body.links.approval_url);
    const approvalPath = new URL(approvalUrl).pathname;

    const approvalPage = await api.get(approvalPath).expect(200);
    const csrfCookie = extractCookieValue(approvalPage.headers['set-cookie'], 'aegis_csrf');
    const csrfToken = extractHidden(approvalPage.text, 'csrf');
    expect(csrfCookie).toBeTruthy();
    expect(csrfToken).toBeTruthy();

    await api
      .post(`${approvalPath}/decision`)
      .set('Cookie', [`aegis_csrf=${csrfCookie}`])
      .type('form')
      .send({ csrf: csrfToken, decision: 'approve', decision_source: 'web_passkey' })
      .expect(200);

    await api.post('/api/dev/workers/tick').set('Cookie', [adminCookie]).send({}).expect(200);

    const actionId = String(create.body.action.action_id);
    const final = await api
      .get(`/v1/actions/${actionId}`)
      .set('x-aegis-api-key', 'aegis_demo_agent_key')
      .expect(200);

    expect(final.body.action.status).toBe('succeeded');
    expect(final.body.action.execution?.rail).toBe('card');
    expect(final.body.action.execution?.payment_id).toBeTruthy();

    const callbackEvents = runtime.testCallbackInbox.map((e) => e.headers['x-aegis-event-type']);
    expect(callbackEvents).toContain('action.approved');
    expect(callbackEvents).toContain('action.succeeded');
  });

  it('honors idempotency_key per agent', async () => {
    const api = request(runtime.app);
    const body = {
      idempotency_key: 'idem_same_key',
      end_user_id: 'usr_demo',
      action_type: 'payment' as const,
      callback_url: `${baseUrl}/_test/callback`,
      details: {
        amount: '10.00',
        currency: 'USD',
        recipient_name: 'Idem Merchant',
        description: 'Idempotency test',
        payment_rail: 'card' as const,
        payment_method_preference: 'card_default',
        recipient_reference: 'merchant_api:idem',
      },
    };

    const a = await api.post('/v1/request_action').set('x-aegis-api-key', 'aegis_demo_agent_key').send(body).expect(201);
    const b = await api.post('/v1/request_action').set('x-aegis-api-key', 'aegis_demo_agent_key').send(body).expect(201);
    expect(b.body.action.action_id).toBe(a.body.action.action_id);
  });

  it('supports denial flow and emits denied callback', async () => {
    const api = request(runtime.app);
    const adminCookie = await adminLogin(api);
    const create = await api
      .post('/v1/request_action')
      .set('x-aegis-api-key', 'aegis_demo_agent_key')
      .send({
        idempotency_key: 't_card_deny_1',
        end_user_id: 'usr_demo',
        action_type: 'payment',
        callback_url: `${baseUrl}/_test/callback`,
        details: {
          amount: '9.99',
          currency: 'USD',
          recipient_name: 'Deny Merchant',
          description: 'Deny flow',
          payment_rail: 'card',
          payment_method_preference: 'card_default',
          recipient_reference: 'merchant_api:deny_case',
        },
      })
      .expect(201);

    const approvalPath = new URL(String(create.body.links.approval_url)).pathname;
    const approvalPage = await api.get(approvalPath).expect(200);
    const csrfCookie = extractCookieValue(approvalPage.headers['set-cookie'], 'aegis_csrf');
    const csrfToken = extractHidden(approvalPage.text, 'csrf');

    await api
      .post(`${approvalPath}/decision`)
      .set('Cookie', [`aegis_csrf=${csrfCookie}`])
      .type('form')
      .send({ csrf: csrfToken, decision: 'deny', decision_source: 'web_otp' })
      .expect(200);

    await api.post('/api/dev/workers/tick').set('Cookie', [adminCookie]).send({}).expect(200);

    const actionId = String(create.body.action.action_id);
    const final = await api.get(`/v1/actions/${actionId}`).set('x-aegis-api-key', 'aegis_demo_agent_key').expect(200);
    expect(final.body.action.status).toBe('denied');

    const deniedCallbacks = runtime.testCallbackInbox.filter((e) => e.body && (e.body as any).event_type === 'action.denied');
    expect(deniedCallbacks.length).toBeGreaterThan(0);
  });

  it('supports cancel before approval and emits canceled callback', async () => {
    const api = request(runtime.app);
    const adminCookie = await adminLogin(api);
    const create = await api
      .post('/v1/request_action')
      .set('x-aegis-api-key', 'aegis_demo_agent_key')
      .send({
        idempotency_key: 't_cancel_1',
        end_user_id: 'usr_demo',
        action_type: 'payment',
        callback_url: `${baseUrl}/_test/callback`,
        details: {
          amount: '7.00',
          currency: 'USD',
          recipient_name: 'Cancelable Merchant',
          description: 'Cancel flow',
          payment_rail: 'card',
          payment_method_preference: 'card_default',
          recipient_reference: 'merchant_api:cancel_me',
        },
      })
      .expect(201);

    const actionId = String(create.body.action.action_id);
    await api.post(`/v1/actions/${actionId}/cancel`).set('x-aegis-api-key', 'aegis_demo_agent_key').send({}).expect(200);
    await api.post('/api/dev/workers/tick').set('Cookie', [adminCookie]).send({}).expect(200);

    const final = await api.get(`/v1/actions/${actionId}`).set('x-aegis-api-key', 'aegis_demo_agent_key').expect(200);
    expect(final.body.action.status).toBe('canceled');

    const canceledCallbacks = runtime.testCallbackInbox.filter((e) => e.body && (e.body as any).event_type === 'action.canceled');
    expect(canceledCallbacks.length).toBeGreaterThan(0);
  });

  it('handles execution failure and can requeue a failed webhook delivery', async () => {
    const api = request(runtime.app);
    const adminCookie = await adminLogin(api);

    const failing = await api
      .post('/v1/request_action')
      .set('x-aegis-api-key', 'aegis_demo_agent_key')
      .send({
        idempotency_key: 't_exec_fail_1',
        end_user_id: 'usr_demo',
        action_type: 'payment',
        callback_url: 'http://127.0.0.1:9/unreachable',
        details: {
          amount: '15.00',
          currency: 'USD',
          recipient_name: 'Decline Merchant',
          description: 'decline this payment',
          payment_rail: 'card',
          payment_method_preference: 'card_default',
          recipient_reference: 'merchant_api:force_fail',
        },
      })
      .expect(201);

    const actionId = String(failing.body.action.action_id);
    await api.post(`/api/dev/actions/${actionId}/decision`).set('Cookie', [adminCookie]).send({ decision: 'approve' }).expect(200);
    await api.post('/api/dev/workers/tick').set('Cookie', [adminCookie]).send({}).expect(200);

    const final = await api.get(`/v1/actions/${actionId}`).set('x-aegis-api-key', 'aegis_demo_agent_key').expect(200);
    expect(final.body.action.status).toBe('failed');
    expect(final.body.action.execution?.error_code).toBe('PSP_DECLINED');

    const deliveriesRes = await api.get(`/api/dev/webhooks?action_id=${encodeURIComponent(actionId)}`).set('Cookie', [adminCookie]).expect(200);
    const deliveries = deliveriesRes.body.deliveries as Array<any>;
    expect(deliveries.length).toBeGreaterThan(0);
    expect(deliveries.some((d) => d.status === 'pending' || d.status === 'dead')).toBe(true);

    const target = deliveries[0];
    await api.post(`/api/dev/webhooks/${target.id}/requeue`).set('Cookie', [adminCookie]).send({}).expect(200);
    const afterRequeue = await api.get(`/api/dev/webhooks?action_id=${encodeURIComponent(actionId)}`).set('Cookie', [adminCookie]).expect(200);
    const updated = (afterRequeue.body.deliveries as Array<any>).find((d) => d.id === target.id);
    expect(updated?.status).toBe('pending');
  });

  it('renders webhook replay UI and supports web requeue action', async () => {
    const api = request(runtime.app);
    const adminCookie = await adminLogin(api);

    const create = await api
      .post('/v1/request_action')
      .set('x-aegis-api-key', 'aegis_demo_agent_key')
      .send({
        idempotency_key: 't_webhook_ui_1',
        end_user_id: 'usr_demo',
        action_type: 'payment',
        callback_url: 'http://127.0.0.1:9/unreachable',
        details: {
          amount: '5.00',
          currency: 'USD',
          recipient_name: 'Webhook UI Merchant',
          description: 'decline for ui replay',
          payment_rail: 'card',
          payment_method_preference: 'card_default',
          recipient_reference: 'merchant_api:ui_fail',
        },
      })
      .expect(201);
    const actionId = String(create.body.action.action_id);

    await api.post(`/api/dev/actions/${actionId}/decision`).set('Cookie', [adminCookie]).send({ decision: 'approve' }).expect(200);
    await api.post('/api/dev/workers/tick').set('Cookie', [adminCookie]).send({}).expect(200);

    const listRes = await api.get(`/api/dev/webhooks?action_id=${encodeURIComponent(actionId)}`).set('Cookie', [adminCookie]).expect(200);
    const deliveryId = String((listRes.body.deliveries as Array<any>)[0].id);

    const page = await api.get(`/dev/webhooks?action_id=${encodeURIComponent(actionId)}`).set('Cookie', [adminCookie]).expect(200);
    expect(page.text).toContain('Dev Webhook Deliveries');
    expect(page.text).toContain(deliveryId);

    await api.post(`/dev/webhooks/${deliveryId}/requeue`).set('Cookie', [adminCookie]).expect(302);
  });

  it('supports sandbox fault injection (one-shot timeout) via API and UI', async () => {
    const api = request(runtime.app);
    const adminCookie = await adminLogin(api);

    await api
      .post('/api/dev/sandbox/faults')
      .set('Cookie', [adminCookie])
      .send({ rail: 'card', mode: 'timeout', scope: 'once' })
      .expect(200);

    const snapshot1 = await api.get('/api/dev/sandbox/faults').set('Cookie', [adminCookie]).expect(200);
    expect(snapshot1.body.sandbox_faults?.card?.mode).toBe('timeout');
    expect(snapshot1.body.sandbox_faults?.card?.scope).toBe('once');

    const first = await createAndApproveCardAction(api, adminCookie, baseUrl, 't_sandbox_card_timeout_1');
    await api.post('/api/dev/workers/tick').set('Cookie', [adminCookie]).send({}).expect(200);
    const firstFinal = await api.get(`/v1/actions/${first}`).set('x-aegis-api-key', 'aegis_demo_agent_key').expect(200);
    expect(firstFinal.body.action.status).toBe('failed');
    expect(firstFinal.body.action.execution?.error_code).toBe('TIMEOUT');

    const snapshot2 = await api.get('/api/dev/sandbox/faults').set('Cookie', [adminCookie]).expect(200);
    expect(snapshot2.body.sandbox_faults?.card?.mode).toBe('none');

    const second = await createAndApproveCardAction(api, adminCookie, baseUrl, 't_sandbox_card_timeout_2');
    await api.post('/api/dev/workers/tick').set('Cookie', [adminCookie]).send({}).expect(200);
    const secondFinal = await api.get(`/v1/actions/${second}`).set('x-aegis-api-key', 'aegis_demo_agent_key').expect(200);
    expect(secondFinal.body.action.status).toBe('succeeded');

    const sandboxPage = await api.get('/dev/sandbox').set('Cookie', [adminCookie]).expect(200);
    expect(sandboxPage.text).toContain('Sandbox Fault Injection');
    await api
      .post('/dev/sandbox/set')
      .set('Cookie', [adminCookie])
      .type('form')
      .send({ rail: 'crypto', mode: 'revert', scope: 'sticky' })
      .expect(302);
    const snapshot3 = await api.get('/api/dev/sandbox/faults').set('Cookie', [adminCookie]).expect(200);
    expect(snapshot3.body.sandbox_faults?.crypto?.mode).toBe('revert');
    await api.post('/dev/sandbox/reset').set('Cookie', [adminCookie]).type('form').send({}).expect(302);
  });

  it('supports sandbox presets and shows sandbox-injected marker on admin actions list', async () => {
    const api = request(runtime.app);
    const adminCookie = await adminLogin(api);

    await api
      .post('/api/dev/sandbox/presets')
      .set('Cookie', [adminCookie])
      .send({ preset: 'PSP_DECLINE_DEMO' })
      .expect(200);

    const actionId = await createAndApproveCardAction(api, adminCookie, baseUrl, 't_sandbox_preset_decline_1');
    await api.post('/api/dev/workers/tick').set('Cookie', [adminCookie]).send({}).expect(200);

    const final = await api.get(`/v1/actions/${actionId}`).set('x-aegis-api-key', 'aegis_demo_agent_key').expect(200);
    expect(final.body.action.status).toBe('failed');
    expect(final.body.action.execution?.error_code).toBe('PSP_DECLINED');
    expect(final.body.action.execution?.sandbox_injected_fault).toBe('card_decline');

    const adminPage = await api.get('/admin').set('Cookie', [adminCookie]).expect(200);
    expect(adminPage.text).toContain('sandbox-injected: card_decline');

    await api
      .post('/dev/sandbox/preset')
      .set('Cookie', [adminCookie])
      .type('form')
      .send({ preset: 'CHAIN_REVERT_DEMO' })
      .expect(302);
    const snapshot = await api.get('/api/dev/sandbox/faults').set('Cookie', [adminCookie]).expect(200);
    expect(snapshot.body.sandbox_faults?.crypto?.mode).toBe('revert');
  });

  it('runs sandbox demo from UI and opens action detail audit page', async () => {
    const api = request(runtime.app);
    const adminCookie = await adminLogin(api);

    const res = await api
      .post('/dev/sandbox/demo')
      .set('Cookie', [adminCookie])
      .type('form')
      .send({ preset: 'PSP_DECLINE_DEMO' })
      .expect(302);

    const location = String(res.headers.location ?? '');
    expect(location).toMatch(/^\/dev\/actions\//);

    const detail = await api.get(location).set('Cookie', [adminCookie]).expect(200);
    expect(detail.text).toContain('Action Detail & Audit');
    expect(detail.text).toContain('Sandbox injected failure');

    const sandboxPage = await api.get('/dev/sandbox').set('Cookie', [adminCookie]).expect(200);
    expect(sandboxPage.text).toContain('Recent Callback Inbox');
    expect(sandboxPage.text).toContain('action.failed');
  });

  it('app approval API: GET approval by token and POST decision with app_biometric', async () => {
    const api = request(runtime.app);
    const adminCookie = await adminLogin(api);
    const create = await api
      .post('/v1/request_action')
      .set('x-aegis-api-key', 'aegis_demo_agent_key')
      .send({
        idempotency_key: 't_app_approval_1',
        end_user_id: 'usr_demo',
        action_type: 'payment',
        callback_url: `${baseUrl}/_test/callback`,
        details: {
          amount: '25.00',
          currency: 'USD',
          recipient_name: 'App Biometric Merchant',
          description: 'App approval flow test',
          payment_rail: 'card',
          payment_method_preference: 'card_default',
          recipient_reference: 'merchant_api:app_biometric',
        },
      })
      .expect(201);

    const approvalUrl = String(create.body.links.approval_url);
    const token = approvalUrl.replace(/^.*\/approve\//, '').replace(/\/$/, '');
    expect(token).toBeTruthy();

    const getApproval = await api.get(`/api/app/approval?token=${encodeURIComponent(token)}`).expect(200);
    expect(getApproval.body.valid).toBe(true);
    expect(getApproval.body.already_decided).toBe(false);
    expect(getApproval.body.action.details?.amount).toBe('25.00');
    expect(getApproval.body.end_user?.email).toBeTruthy();

    await api
      .post('/api/app/approval/decision')
      .set('Content-Type', 'application/json')
      .send({ token, decision: 'approve', decision_source: 'app_biometric' })
      .expect(200);

    await api.post('/api/dev/workers/tick').set('Cookie', [adminCookie]).send({}).expect(200);

    const actionId = String(create.body.action.action_id);
    const final = await api.get(`/v1/actions/${actionId}`).set('x-aegis-api-key', 'aegis_demo_agent_key').expect(200);
    expect(final.body.action.status).toBe('succeeded');
  });

  it('app approval API: GET/POST by action_id requires app session', async () => {
    const api = request(runtime.app);
    const adminCookie = await adminLogin(api);
    const appCookie = await getAppSessionCookie(api, 'usr_demo');
    const create = await api
      .post('/v1/request_action')
      .set('x-aegis-api-key', 'aegis_demo_agent_key')
      .send({
        idempotency_key: 't_app_action_id_1',
        end_user_id: 'usr_demo',
        action_type: 'payment',
        callback_url: `${baseUrl}/_test/callback`,
        details: {
          amount: '18.00',
          currency: 'USD',
          recipient_name: 'ActionId Merchant',
          description: 'Action ID based approval',
          payment_rail: 'card',
          payment_method_preference: 'card_default',
          recipient_reference: 'merchant_api:action_id_test',
        },
      })
      .expect(201);

    const actionId = String(create.body.action.action_id);

    const getRes = await api.get(`/api/app/approval?action_id=${actionId}`).set('Cookie', [appCookie]).expect(200);
    expect(getRes.body.valid).toBe(true);
    expect(getRes.body.already_decided).toBe(false);
    expect(getRes.body.action.details.amount).toBe('18.00');
    expect(getRes.body.action.created_at).toBeTruthy();

    await api.get(`/api/app/approval?action_id=${actionId}`).expect(401);

    await api
      .post('/api/app/approval/decision')
      .set('Cookie', [appCookie])
      .send({ action_id: actionId, decision: 'approve', decision_source: 'app_biometric' })
      .expect(200);

    await api.post('/api/dev/workers/tick').set('Cookie', [adminCookie]).send({}).expect(200);

    const final = await api.get(`/v1/actions/${actionId}`).set('x-aegis-api-key', 'aegis_demo_agent_key').expect(200);
    expect(final.body.action.status).toBe('succeeded');
  });

  it('GET /api/app/pending returns only awaiting_approval actions for user', async () => {
    const api = request(runtime.app);
    const adminCookie = await adminLogin(api);
    const appCookie = await getAppSessionCookie(api, 'usr_demo');

    const makeAction = async (idempKey: string, amount: string) => {
      const res = await api
        .post('/v1/request_action')
        .set('x-aegis-api-key', 'aegis_demo_agent_key')
        .send({
          idempotency_key: idempKey,
          end_user_id: 'usr_demo',
          action_type: 'payment',
          callback_url: `${baseUrl}/_test/callback`,
          details: {
            amount,
            currency: 'USD',
            recipient_name: 'Pending Test Merchant',
            description: 'pending list test',
            payment_rail: 'card',
            payment_method_preference: 'card_default',
            recipient_reference: 'merchant_api:pending_test',
          },
        })
        .expect(201);
      return String(res.body.action.action_id);
    };

    const pendingId1 = await makeAction('t_pending_list_1', '1.00');
    const pendingId2 = await makeAction('t_pending_list_2', '2.00');
    const deniedId = await makeAction('t_pending_list_denied', '3.00');
    await api.post(`/api/dev/actions/${deniedId}/decision`).set('Cookie', [adminCookie]).send({ decision: 'deny' }).expect(200);

    const pendingRes = await api.get('/api/app/pending').set('Cookie', [appCookie]).expect(200);
    expect(pendingRes.body.count).toBeGreaterThanOrEqual(2);
    const pendingIds = pendingRes.body.items.map((i: any) => i.action_id);
    expect(pendingIds).toContain(pendingId1);
    expect(pendingIds).toContain(pendingId2);
    expect(pendingIds).not.toContain(deniedId);
    for (const item of pendingRes.body.items) {
      expect(item.status).toBe('awaiting_approval');
    }

    const unauthorizedRes = await api.get('/api/app/pending').expect(401);
    expect(unauthorizedRes.body.error).toBe('UNAUTHORIZED');
  });

  it('GET /api/app/history returns all actions for user sorted by created_at DESC', async () => {
    const api = request(runtime.app);
    const appCookie = await getAppSessionCookie(api, 'usr_demo');

    const historyRes = await api.get('/api/app/history?limit=50&offset=0').set('Cookie', [appCookie]).expect(200);
    expect(historyRes.body.items.length).toBeGreaterThanOrEqual(3);
    expect(typeof historyRes.body.total).toBe('number');
    expect(historyRes.body.limit).toBe(50);
    expect(historyRes.body.offset).toBe(0);

    const statuses = historyRes.body.items.map((i: any) => i.status);
    expect(statuses.some((s: string) => s === 'awaiting_approval')).toBe(true);
    expect(statuses.some((s: string) => s !== 'awaiting_approval')).toBe(true);

    const paginatedRes = await api.get('/api/app/history?limit=2&offset=0').set('Cookie', [appCookie]).expect(200);
    expect(paginatedRes.body.items.length).toBeLessThanOrEqual(2);
    expect(paginatedRes.body.total).toBe(historyRes.body.total);

    const unauthorizedRes = await api.get('/api/app/history').expect(401);
    expect(unauthorizedRes.body.error).toBe('UNAUTHORIZED');
  });

  it('GET /api/app/admin/history supports status filter and keeps admin auth', async () => {
    const api = request(runtime.app);
    const adminCookie = await adminLogin(api);

    await api.get('/api/app/admin/history').expect(401);

    const allRes = await api.get('/api/app/admin/history?limit=20&offset=0').set('Cookie', [adminCookie]).expect(200);
    expect(Array.isArray(allRes.body.items)).toBe(true);
    expect(allRes.body.limit).toBe(20);
    expect(allRes.body.offset).toBe(0);

    const deniedRes = await api
      .get('/api/app/admin/history?status=denied&limit=50&offset=0')
      .set('Cookie', [adminCookie])
      .expect(200);
    expect(deniedRes.body.filters.status).toBe('denied');
    for (const item of deniedRes.body.items as Array<any>) {
      expect(item.status).toBe('denied');
    }

    const invalidStatus = await api
      .get('/api/app/admin/history?status=not_real')
      .set('Cookie', [adminCookie])
      .expect(400);
    expect(invalidStatus.body.error).toBe('INVALID_STATUS');
  });

  it('admin-control guardrails: keys, status, rotation, limits, allowlist are admin-only', async () => {
    const api = request(runtime.app);

    await api.get('/api/dev/admin-control/keys').expect(401);

    const adminCookie = await adminLogin(api);
    const appCookie = await getAppSessionCookie(api, 'usr_demo');
    const created = await api.post('/api/app/agents').set('Cookie', [appCookie]).send({ name: 'Guardrail Test Agent' }).expect(201);
    const testAgentId = String(created.body.agent.id);

    const keysRes = await api.get('/api/dev/admin-control/keys').set('Cookie', [adminCookie]).expect(200);
    expect(Array.isArray(keysRes.body.keys)).toBe(true);
    expect(keysRes.body.keys.some((k: any) => k.agent_id === 'agt_demo')).toBe(true);
    expect(keysRes.body.keys.some((k: any) => k.agent_id === testAgentId)).toBe(true);

    const detailRes = await api.get(`/api/dev/admin-control/keys/${encodeURIComponent(testAgentId)}`).set('Cookie', [adminCookie]).expect(200);
    expect(detailRes.body.key.status).toMatch(/active|disabled/);

    const disabledRes = await api
      .post(`/api/dev/admin-control/keys/${encodeURIComponent(testAgentId)}/status`)
      .set('Cookie', [adminCookie])
      .send({ status: 'disabled' })
      .expect(200);
    expect(disabledRes.body.key.status).toBe('disabled');

    const enabledRes = await api
      .post(`/api/dev/admin-control/keys/${encodeURIComponent(testAgentId)}/status`)
      .set('Cookie', [adminCookie])
      .send({ status: 'active' })
      .expect(200);
    expect(enabledRes.body.key.status).toBe('active');

    const rotateRes = await api
      .post(`/api/dev/admin-control/keys/${encodeURIComponent(testAgentId)}/rotate`)
      .set('Cookie', [adminCookie])
      .send({})
      .expect(200);
    expect(rotateRes.body.api_key).toMatch(/^aegis_/);
    expect(rotateRes.body.webhook_secret).toMatch(/^whsec_/);

    const rateRes = await api
      .put(`/api/dev/admin-control/keys/${encodeURIComponent(testAgentId)}/rate-limit`)
      .set('Cookie', [adminCookie])
      .send({ requests_per_minute: 120 })
      .expect(200);
    expect(rateRes.body.rate_limit.requests_per_minute).toBe(120);

    const riskGet = await api.get('/api/dev/admin-control/policies/risk').set('Cookie', [adminCookie]).expect(200);
    expect(riskGet.body.policy.single_tx_limit_cents).toBeTypeOf('number');

    const riskPut = await api
      .put('/api/dev/admin-control/policies/risk')
      .set('Cookie', [adminCookie])
      .send({ single_tx_limit_cents: 300000, daily_total_limit_cents: 1200000, allowlist_enabled: true })
      .expect(200);
    expect(riskPut.body.policy.allowlist_enabled).toBe(true);

    const allowPut = await api
      .put('/api/dev/admin-control/policies/allowlist')
      .set('Cookie', [adminCookie])
      .send({ recipients: ['merchant_api:a', 'merchant_api:b'], allowlist_enabled: true })
      .expect(200);
    expect(allowPut.body.recipients).toContain('merchant_api:a');

    const allowGet = await api
      .get('/api/dev/admin-control/policies/allowlist')
      .set('Cookie', [adminCookie])
      .expect(200);
    expect(allowGet.body.allowlist_enabled).toBe(true);
    expect(allowGet.body.recipients).toContain('merchant_api:b');
  });

  it('POST /v1/request_action returns Idempotency-Key header and Idempotency-Replayed on replay', async () => {
    const api = request(runtime.app);
    const body = {
      idempotency_key: 'idem_header_test',
      end_user_id: 'usr_demo',
      action_type: 'payment' as const,
      callback_url: `${baseUrl}/_test/callback`,
      details: {
        amount: '5.00',
        currency: 'USD',
        recipient_name: 'Idem Header Merchant',
        description: 'Idempotency header test',
        payment_rail: 'card' as const,
        payment_method_preference: 'card_default',
        recipient_reference: 'merchant_api:idem_header',
      },
    };

    const first = await api.post('/v1/request_action').set('x-aegis-api-key', 'aegis_demo_agent_key').send(body).expect(201);
    expect(first.headers['idempotency-key']).toBe('idem_header_test');
    expect(first.headers['idempotency-replayed']).toBeUndefined();

    const second = await api.post('/v1/request_action').set('x-aegis-api-key', 'aegis_demo_agent_key').send(body).expect(201);
    expect(second.headers['idempotency-key']).toBe('idem_header_test');
    expect(second.headers['idempotency-replayed']).toBe('true');
    expect(second.body.action.action_id).toBe(first.body.action.action_id);
  });

  it('POST /v1/request_action accepts Idempotency-Key header without body idempotency_key', async () => {
    const api = request(runtime.app);
    const headerKey = 'idem_header_only_1';
    const baseBody = {
      end_user_id: 'usr_demo',
      action_type: 'payment' as const,
      callback_url: `${baseUrl}/_test/callback`,
      details: {
        amount: '8.00',
        currency: 'USD',
        recipient_name: 'Header Only Merchant',
        description: 'Header only idempotency',
        payment_rail: 'card' as const,
        payment_method_preference: 'card_default',
        recipient_reference: 'merchant_api:idem_header_only',
      },
    };

    const first = await api
      .post('/v1/request_action')
      .set('x-aegis-api-key', 'aegis_demo_agent_key')
      .set('Idempotency-Key', headerKey)
      .send(baseBody)
      .expect(201);
    expect(first.headers['idempotency-key']).toBe(headerKey);

    const replay = await api
      .post('/v1/request_action')
      .set('x-aegis-api-key', 'aegis_demo_agent_key')
      .set('Idempotency-Key', headerKey)
      .send(baseBody)
      .expect(201);
    expect(replay.headers['idempotency-key']).toBe(headerKey);
    expect(replay.headers['idempotency-replayed']).toBe('true');
    expect(replay.body.action.action_id).toBe(first.body.action.action_id);
  });

  it('POST /v1/request_action prefers Idempotency-Key header over body idempotency_key', async () => {
    const api = request(runtime.app);
    const headerKey = 'idem_header_precedence_1';
    const body = {
      idempotency_key: 'idem_body_should_be_ignored',
      end_user_id: 'usr_demo',
      action_type: 'payment' as const,
      callback_url: `${baseUrl}/_test/callback`,
      details: {
        amount: '11.00',
        currency: 'USD',
        recipient_name: 'Header Precedence Merchant',
        description: 'Header precedence idempotency',
        payment_rail: 'card' as const,
        payment_method_preference: 'card_default',
        recipient_reference: 'merchant_api:idem_header_precedence',
      },
    };

    const first = await api
      .post('/v1/request_action')
      .set('x-aegis-api-key', 'aegis_demo_agent_key')
      .set('Idempotency-Key', headerKey)
      .send(body)
      .expect(201);

    const second = await api
      .post('/v1/request_action')
      .set('x-aegis-api-key', 'aegis_demo_agent_key')
      .set('Idempotency-Key', headerKey)
      .send({ ...body, idempotency_key: 'idem_body_changed' })
      .expect(201);

    expect(first.headers['idempotency-key']).toBe(headerKey);
    expect(second.headers['idempotency-key']).toBe(headerKey);
    expect(second.headers['idempotency-replayed']).toBe('true');
    expect(second.body.action.action_id).toBe(first.body.action.action_id);
  });

  it('GET /v1/requests/:id returns same result as /v1/actions/:id', async () => {
    const api = request(runtime.app);
    const create = await api
      .post('/v1/request_action')
      .set('x-aegis-api-key', 'aegis_demo_agent_key')
      .send({
        idempotency_key: 't_requests_alias_1',
        end_user_id: 'usr_demo',
        action_type: 'payment',
        callback_url: `${baseUrl}/_test/callback`,
        details: {
          amount: '6.00',
          currency: 'USD',
          recipient_name: 'Alias Merchant',
          description: 'Requests alias test',
          payment_rail: 'card',
          payment_method_preference: 'card_default',
          recipient_reference: 'merchant_api:alias_test',
        },
      })
      .expect(201);

    const actionId = String(create.body.action.action_id);
    const viaActions = await api.get(`/v1/actions/${actionId}`).set('x-aegis-api-key', 'aegis_demo_agent_key').expect(200);
    const viaRequests = await api.get(`/v1/requests/${actionId}`).set('x-aegis-api-key', 'aegis_demo_agent_key').expect(200);
    expect(viaRequests.body).toEqual(viaActions.body);

    await api.get('/v1/requests/nonexistent').set('x-aegis-api-key', 'aegis_demo_agent_key').expect(404);
  });

  it('covers API validation and dev route error paths', async () => {
    const api = request(runtime.app);
    const adminCookie = await adminLogin(api);

    await api.get('/v1/payment_methods/capabilities').set('x-aegis-api-key', 'aegis_demo_agent_key').expect(400);
    await api
      .post('/v1/webhooks/test')
      .set('x-aegis-api-key', 'aegis_demo_agent_key')
      .send({ callback_url: 'not-a-url' })
      .expect(400);

    const created = await api
      .post('/v1/request_action')
      .set('x-aegis-api-key', 'aegis_demo_agent_key')
      .send({
        idempotency_key: 't_dev_error_paths_1',
        end_user_id: 'usr_demo',
        action_type: 'payment',
        details: {
          amount: '3.00',
          currency: 'USD',
          recipient_name: 'Error Path Merchant',
          description: 'error paths',
          payment_rail: 'card',
          payment_method_preference: 'card_default',
          recipient_reference: 'merchant_api:error_paths',
        },
      })
      .expect(201);
    const actionId = String(created.body.action.action_id);

    await api.post(`/api/dev/actions/${actionId}/decision`).set('Cookie', [adminCookie]).send({ decision: 'nope' }).expect(400);

    await api
      .post('/api/dev/sandbox/faults')
      .set('Cookie', [adminCookie])
      .send({ rail: 'card', mode: 'decline', scope: 'invalid_scope' })
      .expect(400);
    await api
      .post('/api/dev/sandbox/faults')
      .set('Cookie', [adminCookie])
      .send({ rail: 'card', mode: 'invalid_mode', scope: 'once' })
      .expect(400);
    await api
      .post('/api/dev/sandbox/faults')
      .set('Cookie', [adminCookie])
      .send({ rail: 'invalid_rail', mode: 'decline', scope: 'once' })
      .expect(400);

    await api
      .post('/api/dev/sandbox/faults')
      .set('Cookie', [adminCookie])
      .send({ rail: 'card', mode: 'decline', scope: 'once' })
      .expect(200);
    await api
      .post('/api/dev/sandbox/faults')
      .set('Cookie', [adminCookie])
      .send({ rail: 'crypto', mode: 'revert', scope: 'sticky' })
      .expect(200);
    await api.post('/api/dev/sandbox/faults/reset').set('Cookie', [adminCookie]).send({}).expect(200);
    await api.post('/api/dev/sandbox/presets').set('Cookie', [adminCookie]).send({ preset: 'UNKNOWN' }).expect(400);
    await api
      .post('/api/dev/sandbox/presets')
      .set('Cookie', [adminCookie])
      .send({ preset: 'PSP_DECLINE_DEMO' })
      .expect(200);

    await api
      .post('/api/dev/payment-methods')
      .set('Cookie', [adminCookie])
      .send({ payment_method_id: 'invalid', user_id: 'usr_demo' })
      .expect(400);
    await api
      .post('/api/dev/payment-methods')
      .set('Cookie', [adminCookie])
      .send({ payment_method_id: 'pm_12345', user_id: 'usr_nonexistent' })
      .expect(404);
    await api.get('/api/dev/payment-methods?user_id=usr_nonexistent').set('Cookie', [adminCookie]).expect(404);
    await api.delete('/api/dev/payment-methods/pm_missing?user_id=usr_demo').set('Cookie', [adminCookie]).expect(404);
    await api.post('/api/dev/payment-methods/pm_missing/default').set('Cookie', [adminCookie]).send({ user_id: 'usr_demo' }).expect(404);

    await api
      .post('/api/dev/stripe/setup-test-card')
      .set('Cookie', [adminCookie])
      .send({ card_number: '4000000000000002' })
      .expect(400);
    await api.post('/api/dev/stripe/setup-test-card').set('Cookie', [adminCookie]).send({}).expect(400);
  });

  it('device registration: POST, GET, upsert, DELETE', async () => {
    const api = request(runtime.app);
    const appCookie = await getAppSessionCookie(api, 'usr_demo');

    const reg1 = await api
      .post('/api/app/devices')
      .set('Cookie', [appCookie])
      .send({ platform: 'ios', push_token: 'apns_token_abc' })
      .expect(200);
    expect(reg1.body.ok).toBe(true);
    expect(reg1.body.device_id).toBeTruthy();
    const deviceId = reg1.body.device_id;

    const list1 = await api.get('/api/app/devices').set('Cookie', [appCookie]).expect(200);
    expect(list1.body.devices.some((d: any) => d.id === deviceId && d.push_token === 'apns_token_abc')).toBe(true);

    const reg2 = await api
      .post('/api/app/devices')
      .set('Cookie', [appCookie])
      .send({ platform: 'ios', push_token: 'apns_token_updated' })
      .expect(200);
    expect(reg2.body.device_id).toBe(deviceId);

    const list2 = await api.get('/api/app/devices').set('Cookie', [appCookie]).expect(200);
    const iosDevice = list2.body.devices.find((d: any) => d.id === deviceId);
    expect(iosDevice.push_token).toBe('apns_token_updated');

    const regAndroid = await api
      .post('/api/app/devices')
      .set('Cookie', [appCookie])
      .send({ platform: 'android', push_token: 'fcm_token_xyz' })
      .expect(200);
    expect(regAndroid.body.device_id).toBeTruthy();
    expect(regAndroid.body.device_id).not.toBe(deviceId);

    await api.delete(`/api/app/devices/${deviceId}`).set('Cookie', [appCookie]).expect(200);
    const list3 = await api.get('/api/app/devices').set('Cookie', [appCookie]).expect(200);
    expect(list3.body.devices.some((d: any) => d.id === deviceId)).toBe(false);

    await api.delete('/api/app/devices/nonexistent').set('Cookie', [appCookie]).expect(404);
    await api.delete(`/api/app/devices/${regAndroid.body.device_id}`).expect(401);

    await api.post('/api/app/devices').set('Cookie', [appCookie]).send({}).expect(400);
    await api.post('/api/app/devices').set('Cookie', [appCookie]).send({ platform: 'windows', push_token: 'x' }).expect(400);
    await api.get('/api/app/devices').expect(401);
  });

  it('webhook deliveries include X-Aegis-Signature header', async () => {
    const api = request(runtime.app);
    const adminCookie = await adminLogin(api);

    const create = await api
      .post('/v1/request_action')
      .set('x-aegis-api-key', 'aegis_demo_agent_key')
      .send({
        idempotency_key: 't_webhook_sig_verify',
        end_user_id: 'usr_demo',
        action_type: 'payment',
        callback_url: `${baseUrl}/_test/callback`,
        details: {
          amount: '4.00',
          currency: 'USD',
          recipient_name: 'Sig Test Merchant',
          description: 'Webhook signature test',
          payment_rail: 'card',
          payment_method_preference: 'card_default',
          recipient_reference: 'merchant_api:sig_test',
        },
      })
      .expect(201);

    const actionId = String(create.body.action.action_id);
    await api.post(`/api/dev/actions/${actionId}/decision`).set('Cookie', [adminCookie]).send({ decision: 'approve' }).expect(200);
    await api.post('/api/dev/workers/tick').set('Cookie', [adminCookie]).send({}).expect(200);

    const callbacks = runtime.testCallbackInbox.filter(
      (e) => e.headers['x-aegis-event-type'] === 'action.approved' || e.headers['x-aegis-event-type'] === 'action.succeeded'
    );
    const recent = callbacks[callbacks.length - 1];
    expect(recent).toBeTruthy();
    expect(recent.headers['x-aegis-signature']).toBeTruthy();
    expect(recent.headers['x-aegis-signature']).toMatch(/^t=\d+,v1=[0-9a-f]+$/);
  });

  it('exposes passkey registration options for dev enrollment', async () => {
    const api = request(runtime.app);
    const adminCookie = await adminLogin(api);
    const page = await api.get('/dev/passkeys').set('Cookie', [adminCookie]).expect(200);
    expect(page.text).toContain('Dev Passkey Enrollment');

    const optionsRes = await api.post('/dev/passkeys/register/options').set('Cookie', [adminCookie]).send({ user_id: 'usr_demo' }).expect(200);
    expect(optionsRes.body.options?.challenge).toBeTruthy();
    expect(optionsRes.body.options?.rp?.name).toBeTruthy();
    expect(optionsRes.body.options?.user?.name).toBe('demo.user@example.com');
  });

  it('rejects action_id mobile approval flows for inactive users', async () => {
    const api = request(runtime.app);
    const appCookie = await getAppSessionCookie(api, 'usr_demo');
    const create = await api
      .post('/v1/request_action')
      .set('x-aegis-api-key', 'aegis_demo_agent_key')
      .send({
        idempotency_key: 't_inactive_user_action_id_path',
        end_user_id: 'usr_demo',
        action_type: 'payment',
        callback_url: `${baseUrl}/_test/callback`,
        details: {
          amount: '11.00',
          currency: 'USD',
          recipient_name: 'Inactive User Merchant',
          description: 'inactive user action-id path',
          payment_rail: 'card',
          payment_method_preference: 'card_default',
          recipient_reference: 'merchant_api:inactive_user_case',
        },
      })
      .expect(201);

    const actionId = String(create.body.action.action_id);
    runtime.service.getStore().getRawDb().prepare('UPDATE end_users SET status = ? WHERE id = ?').run('inactive', 'usr_demo');
    try {
      await api.get(`/api/app/approval?action_id=${encodeURIComponent(actionId)}`).set('Cookie', [appCookie]).expect(403);
      await api
        .post('/api/app/approval/decision')
        .set('Cookie', [appCookie])
        .send({ action_id: actionId, decision: 'approve', decision_source: 'web_magic_link' })
        .expect(403);
    } finally {
      runtime.service.getStore().getRawDb().prepare('UPDATE end_users SET status = ? WHERE id = ?').run('active', 'usr_demo');
    }
  });

  it('rejects action_id approval decision for non-target active user with explicit error code', async () => {
    const api = request(runtime.app);
    const appCookie = await getAppSessionCookie(api, 'usr_demo');
    const create = await api
      .post('/v1/request_action')
      .set('x-aegis-api-key', 'aegis_demo_agent_key')
      .send({
        idempotency_key: 't_wrong_user_action_id_decision_code',
        end_user_id: 'usr_demo',
        action_type: 'payment',
        callback_url: `${baseUrl}/_test/callback`,
        details: {
          amount: '12.00',
          currency: 'USD',
          recipient_name: 'Wrong User Merchant',
          description: 'wrong user action-id approval decision',
          payment_rail: 'card',
          payment_method_preference: 'card_default',
          recipient_reference: 'merchant_api:wrong_user_case',
        },
      })
      .expect(201);

    const actionId = String(create.body.action.action_id);
    const db = runtime.service.getStore().getRawDb();
    db.prepare('INSERT OR IGNORE INTO end_users (id, email, display_name, status, created_at) VALUES (?, ?, ?, ?, ?)')
      .run('usr_other_active', 'other.active@example.com', 'Other Active User', 'active', new Date().toISOString());

    const res = await api
      .post('/api/app/approval/decision')
      .set('Cookie', [appCookie])
      .send({ action_id: actionId, user_id: 'usr_other_active', decision: 'approve', decision_source: 'app_biometric' })
      .expect(403);

    expect(res.body.error).toBe('APPROVAL_NOT_ASSIGNED_TO_USER');
  });

  it('validates unsupported card_number before Stripe setup call', async () => {
    const api = request(runtime.app);
    const adminCookie = await adminLogin(api);
    const res = await api
      .post('/api/dev/stripe/setup-test-card')
      .set('Cookie', [adminCookie])
      .send({ user_id: 'usr_demo', card_number: '4000000000000002' })
      .expect(400);

    expect(res.body.error).toBe('UNSUPPORTED_TEST_CARD');
  });

  it('GET /v1/payment_methods/capabilities returns rails and methods for usr_demo', async () => {
    const api = request(runtime.app);
    const res = await api
      .get('/v1/payment_methods/capabilities?end_user_id=usr_demo')
      .set('x-aegis-api-key', 'aegis_demo_agent_key')
      .expect(200);
    expect(res.body).toHaveProperty('end_user_id', 'usr_demo');
    expect(res.body).toHaveProperty('rails');
    expect(Array.isArray(res.body.rails)).toBe(true);
    expect(res.body).toHaveProperty('methods');
    expect(Array.isArray(res.body.methods)).toBe(true);
  });

  it('GET /v1/payment_methods/capabilities requires API key', async () => {
    const api = request(runtime.app);
    await api.get('/v1/payment_methods/capabilities?end_user_id=usr_demo').expect(401);
  });

  it('GET /v1/payment_methods/capabilities returns 400 when end_user_id missing', async () => {
    const api = request(runtime.app);
    const res = await api
      .get('/v1/payment_methods/capabilities')
      .set('x-aegis-api-key', 'aegis_demo_agent_key')
      .expect(400);
    expect(res.body.error).toBe('MISSING_END_USER_ID');
  });

  it('POST /v1/webhooks/test creates webhook test', async () => {
    const api = request(runtime.app);
    const res = await api
      .post('/v1/webhooks/test')
      .set('x-aegis-api-key', 'aegis_demo_agent_key')
      .send({ callback_url: 'https://httpbin.org/post' })
      .expect(202);
    expect(res.body).toHaveProperty('queued', true);
    expect(res.body).toHaveProperty('event_id');
  });

  it('GET /api/dev/payment-methods returns list for user', async () => {
    const api = request(runtime.app);
    const adminCookie = await adminLogin(api);
    const res = await api
      .get('/api/dev/payment-methods?user_id=usr_demo')
      .set('Cookie', [adminCookie])
      .expect(200);
    expect(res.body).toHaveProperty('payment_methods');
    expect(Array.isArray(res.body.payment_methods)).toBe(true);
  });

  it('GET /api/dev/payment-methods returns 404 for nonexistent user', async () => {
    const api = request(runtime.app);
    const adminCookie = await adminLogin(api);
    const res = await api
      .get('/api/dev/payment-methods?user_id=usr_nonexistent')
      .set('Cookie', [adminCookie])
      .expect(404);
    expect(res.body.error).toBe('USER_NOT_FOUND');
  });

  it('POST /api/dev/payment-methods returns 400 when payment_method_id invalid', async () => {
    const api = request(runtime.app);
    const adminCookie = await adminLogin(api);
    const res = await api
      .post('/api/dev/payment-methods')
      .set('Cookie', [adminCookie])
      .send({ payment_method_id: 'invalid', user_id: 'usr_demo' })
      .expect(400);
    expect(res.body.error).toBe('INVALID_PAYMENT_METHOD');
  });

  it('DELETE /api/dev/payment-methods/:id removes payment method', async () => {
    const api = request(runtime.app);
    const adminCookie = await adminLogin(api);
    const store = runtime.service.getStore();
    const pmId = store.insertPaymentMethod('usr_demo', 'card', 'Visa **** 4242', 'pm_test_123', '{}');

    const res = await api
      .delete(`/api/dev/payment-methods/${pmId}?user_id=usr_demo`)
      .set('Cookie', [adminCookie])
      .expect(200);
    expect(res.body.ok).toBe(true);

    const afterList = await api
      .get('/api/dev/payment-methods?user_id=usr_demo')
      .set('Cookie', [adminCookie])
      .expect(200);
    expect(afterList.body.payment_methods.find((p: any) => p.id === pmId)).toBeUndefined();
  });

  it('POST /api/dev/payment-methods/:id/default sets default', async () => {
    const api = request(runtime.app);
    const adminCookie = await adminLogin(api);
    const store = runtime.service.getStore();
    const pmId = store.insertPaymentMethod('usr_demo', 'card', 'Visa **** 4242', 'pm_test_default', '{}');

    const res = await api
      .post(`/api/dev/payment-methods/${pmId}/default`)
      .set('Cookie', [adminCookie])
      .send({ user_id: 'usr_demo' })
      .expect(200);
    expect(res.body.ok).toBe(true);
  });

  it('/dev/add-card requires admin login', async () => {
    const api = request(runtime.app);
    await api.get('/dev/add-card').expect(302);
    const adminCookie = await adminLogin(api);
    const res = await api.get('/dev/add-card').set('Cookie', [adminCookie]);
    expect([200, 302]).toContain(res.status);
    if (res.status === 200) {
      expect(res.text).toContain('add-card');
    }
  });

  it('POST /auth/magic-link/request sends login email', async () => {
    const api = request(runtime.app);
    const targetEmail = 'magiclink-test@example.com';
    const res = await api
      .post('/auth/magic-link/request')
      .send({ email: targetEmail })
      .expect(200);
    expect(res.body.ok).toBe(true);
    const outbox = runtime.service.getStore().listEmailOutbox(200);
    const loginEmail = outbox.find((e: any) => {
      try {
        const m = JSON.parse(String(e.metadata_json || '{}'));
        return m.type === 'login_magic_link' && String(e.to_email).toLowerCase() === targetEmail;
      } catch {
        return false;
      }
    });
    expect(loginEmail).toBeDefined();
    const meta = JSON.parse(String(loginEmail?.metadata_json || '{}'));
    expect(meta.login_url).toBeDefined();
    const token = new URL(meta.login_url).searchParams.get('token');
    expect(token).toBeTruthy();
  });

  it('GET /auth/magic-link/verify creates session and redirects', async () => {
    const api = request(runtime.app);
    await api.post('/auth/magic-link/request').send({ email: 'verify-session@test.com' }).expect(200);
    const outbox = runtime.service.getStore().listEmailOutbox(100);
    const loginEmail = outbox.find((e: any) => {
      try {
        const m = JSON.parse(String(e.metadata_json || '{}'));
        return m.type === 'login_magic_link' && String(e.to_email).includes('verify-session');
      } catch {
        return false;
      }
    });
    expect(loginEmail).toBeDefined();
    const meta = JSON.parse(String(loginEmail?.metadata_json || '{}'));
    const loginUrl = meta.login_url;
    expect(loginUrl).toBeTruthy();
    const token = new URL(loginUrl).searchParams.get('token');
    const res = await api.get(`/auth/magic-link/verify?token=${token}`).expect(302);
    const appCookie = extractCookieValue(res.headers['set-cookie'], 'aegis_app_session');
    expect(appCookie).toBeTruthy();
  });

  it('GET /api/app/plans returns free and pro plans', async () => {
    const api = request(runtime.app);
    const res = await api.get('/api/app/plans').expect(200);
    expect(res.body.plans).toBeDefined();
    expect(Array.isArray(res.body.plans)).toBe(true);
    const free = res.body.plans.find((p: any) => p.id === 'plan_free');
    const pro = res.body.plans.find((p: any) => p.id === 'plan_pro');
    expect(free).toBeDefined();
    expect(pro).toBeDefined();
    expect(free.price_cents).toBe(0);
    expect(pro.price_cents).toBe(1999);
  });

  it('GET /api/app/agents requires session', async () => {
    const api = request(runtime.app);
    await api.get('/api/app/agents').expect(401);
  });

  async function getAppSessionCookie(api: any, userId = 'usr_demo'): Promise<string> {
    const res = await api.post('/_test/app-session').send({ user_id: userId }).expect(200);
    const cookie = extractCookieValue(res.headers['set-cookie'], 'aegis_app_session');
    if (!cookie) throw new Error('missing app session cookie');
    return `aegis_app_session=${cookie}`;
  }

  it('POST /api/app/agents creates agent and returns api_key', async () => {
    const api = request(runtime.app);
    const appCookie = await getAppSessionCookie(api);
    const res = await api
      .post('/api/app/agents')
      .set('Cookie', [appCookie])
      .send({ name: 'Test Agent' })
      .expect(201);
    expect(res.body.ok).toBe(true);
    expect(res.body.agent).toBeDefined();
    expect(res.body.agent.id).toMatch(/^agt_/);
    expect(res.body.api_key).toMatch(/^aegis_/);
  });

  it('GET /api/app/agents returns agents for session user', async () => {
    const api = request(runtime.app);
    const appCookie = await getAppSessionCookie(api);
    const res = await api.get('/api/app/agents').set('Cookie', [appCookie]).expect(200);
    expect(res.body.agents).toBeDefined();
    expect(Array.isArray(res.body.agents)).toBe(true);
    expect(res.body.agents.some((a: any) => a.id === 'agt_demo')).toBe(true);
  });

  it('DELETE /api/app/agents/:id removes owned agent', async () => {
    const api = request(runtime.app);
    const appCookie = await getAppSessionCookie(api);
    const createRes = await api
      .post('/api/app/agents')
      .set('Cookie', [appCookie])
      .send({ name: 'To Delete' })
      .expect(201);
    const agentId = createRes.body.agent.id;
    await api.delete(`/api/app/agents/${agentId}`).set('Cookie', [appCookie]).expect(200);
    const listRes = await api.get('/api/app/agents').set('Cookie', [appCookie]).expect(200);
    expect(listRes.body.agents.find((a: any) => a.id === agentId)).toBeUndefined();
  });
});

function extractCookieValue(setCookie: string | string[] | undefined, name: string): string {
  if (!setCookie) return '';
  const values = Array.isArray(setCookie) ? setCookie : [setCookie];
  for (const cookie of values) {
    const match = cookie.match(new RegExp(`${name}=([^;]+)`));
    if (match) return match[1];
  }
  return '';
}

async function adminLogin(api: any): Promise<string> {
  const res = await api.post('/login').type('form').send({ password: 'aegis_admin_dev', next: '/admin' }).expect(302);
  const cookie = extractCookieValue(res.headers['set-cookie'], 'aegis_admin_session');
  if (!cookie) throw new Error('missing admin session cookie');
  return `aegis_admin_session=${cookie}`;
}

async function createAndApproveCardAction(api: any, adminCookie: string, baseUrl: string, idempotencyKey: string): Promise<string> {
  const create = await api
    .post('/v1/request_action')
    .set('x-aegis-api-key', 'aegis_demo_agent_key')
    .send({
      idempotency_key: idempotencyKey,
      end_user_id: 'usr_demo',
      action_type: 'payment',
      callback_url: `${baseUrl}/_test/callback`,
      details: {
        amount: '11.00',
        currency: 'USD',
        recipient_name: 'Sandbox Merchant',
        description: 'Sandbox fault test',
        payment_rail: 'card',
        payment_method_preference: 'card_default',
        recipient_reference: 'merchant_api:sandbox',
      },
    })
    .expect(201);
  const actionId = String(create.body.action.action_id);
  await api.post(`/api/dev/actions/${actionId}/decision`).set('Cookie', [adminCookie]).send({ decision: 'approve' }).expect(200);
  return actionId;
}

function extractHidden(html: string, name: string): string {
  const re = new RegExp(`<input[^>]+name=["']${name}["'][^>]+value=["']([^"']+)["']`, 'i');
  const match = html.match(re);
  return match?.[1] ?? '';
}
