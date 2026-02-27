import http from 'node:http';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAegisApp } from '../src/app';
import { addMinutesIso } from '../src/lib/time';

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

  it('app approval API: GET/POST by action_id+user_id (no token needed)', async () => {
    const api = request(runtime.app);
    const adminCookie = await adminLogin(api);
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

    const getRes = await api
      .get(`/api/app/approval?action_id=${actionId}&user_id=usr_demo`)
      .expect(200);
    expect(getRes.body.valid).toBe(true);
    expect(getRes.body.already_decided).toBe(false);
    expect(getRes.body.action.details.amount).toBe('18.00');
    expect(getRes.body.action.created_at).toBeTruthy();

    const wrongUser = await api
      .get(`/api/app/approval?action_id=${actionId}&user_id=usr_other`)
      .expect(403);
    expect(wrongUser.body.error).toBe('INVALID_USER');

    await api
      .post('/api/app/approval/decision')
      .send({ action_id: actionId, user_id: 'usr_demo', decision: 'approve', decision_source: 'app_biometric' })
      .expect(200);

    await api.post('/api/dev/workers/tick').set('Cookie', [adminCookie]).send({}).expect(200);

    const final = await api.get(`/v1/actions/${actionId}`).set('x-aegis-api-key', 'aegis_demo_agent_key').expect(200);
    expect(final.body.action.status).toBe('succeeded');
  });

  it('GET /api/app/pending returns only awaiting_approval actions for user', async () => {
    const api = request(runtime.app);
    const adminCookie = await adminLogin(api);

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

    const pendingRes = await api.get('/api/app/pending?user_id=usr_demo').expect(200);
    expect(pendingRes.body.count).toBeGreaterThanOrEqual(2);
    const pendingIds = pendingRes.body.items.map((i: any) => i.action_id);
    expect(pendingIds).toContain(pendingId1);
    expect(pendingIds).toContain(pendingId2);
    expect(pendingIds).not.toContain(deniedId);
    for (const item of pendingRes.body.items) {
      expect(item.status).toBe('awaiting_approval');
    }

    const emptyRes = await api.get('/api/app/pending?user_id=usr_nonexistent').expect(403);
    expect(emptyRes.body.error).toBe('INVALID_USER');

    const missingRes = await api.get('/api/app/pending').expect(400);
    expect(missingRes.body.error).toBe('MISSING_USER_ID');
  });

  it('GET /api/app/history returns all actions for user sorted by created_at DESC', async () => {
    const api = request(runtime.app);

    const historyRes = await api.get('/api/app/history?user_id=usr_demo&limit=50&offset=0').expect(200);
    expect(historyRes.body.items.length).toBeGreaterThanOrEqual(3);
    expect(typeof historyRes.body.total).toBe('number');
    expect(historyRes.body.limit).toBe(50);
    expect(historyRes.body.offset).toBe(0);

    const statuses = historyRes.body.items.map((i: any) => i.status);
    expect(statuses.some((s: string) => s === 'awaiting_approval')).toBe(true);
    expect(statuses.some((s: string) => s !== 'awaiting_approval')).toBe(true);

    const paginatedRes = await api.get('/api/app/history?user_id=usr_demo&limit=2&offset=0').expect(200);
    expect(paginatedRes.body.items.length).toBeLessThanOrEqual(2);
    expect(paginatedRes.body.total).toBe(historyRes.body.total);

    const emptyRes = await api.get('/api/app/history?user_id=usr_nonexistent').expect(403);
    expect(emptyRes.body.error).toBe('INVALID_USER');

    const missingRes = await api.get('/api/app/history').expect(400);
    expect(missingRes.body.error).toBe('MISSING_USER_ID');
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

  it('device registration: POST, GET, upsert, DELETE', async () => {
    const api = request(runtime.app);

    const reg1 = await api
      .post('/api/app/devices')
      .send({ user_id: 'usr_demo', platform: 'ios', push_token: 'apns_token_abc' })
      .expect(200);
    expect(reg1.body.ok).toBe(true);
    expect(reg1.body.device_id).toBeTruthy();
    const deviceId = reg1.body.device_id;

    const list1 = await api.get('/api/app/devices?user_id=usr_demo').expect(200);
    expect(list1.body.devices.some((d: any) => d.id === deviceId && d.push_token === 'apns_token_abc')).toBe(true);

    const reg2 = await api
      .post('/api/app/devices')
      .send({ user_id: 'usr_demo', platform: 'ios', push_token: 'apns_token_updated' })
      .expect(200);
    expect(reg2.body.device_id).toBe(deviceId);

    const list2 = await api.get('/api/app/devices?user_id=usr_demo').expect(200);
    const iosDevice = list2.body.devices.find((d: any) => d.id === deviceId);
    expect(iosDevice.push_token).toBe('apns_token_updated');

    const regAndroid = await api
      .post('/api/app/devices')
      .send({ user_id: 'usr_demo', platform: 'android', push_token: 'fcm_token_xyz' })
      .expect(200);
    expect(regAndroid.body.device_id).toBeTruthy();
    expect(regAndroid.body.device_id).not.toBe(deviceId);

    await api.delete(`/api/app/devices/${deviceId}?user_id=usr_demo`).expect(200);
    const list3 = await api.get('/api/app/devices?user_id=usr_demo').expect(200);
    expect(list3.body.devices.some((d: any) => d.id === deviceId)).toBe(false);

    await api.delete('/api/app/devices/nonexistent?user_id=usr_demo').expect(404);
    await api.delete(`/api/app/devices/${regAndroid.body.device_id}?user_id=usr_nonexistent`).expect(403);

    await api.post('/api/app/devices').send({ user_id: 'usr_demo' }).expect(400);
    await api.post('/api/app/devices').send({ user_id: 'usr_demo', platform: 'windows', push_token: 'x' }).expect(400);
    const missingUserId = await api.get('/api/app/devices');
    expect([400, 401]).toContain(missingUserId.status);
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
      await api.get(`/api/app/approval?action_id=${encodeURIComponent(actionId)}&user_id=usr_demo`).expect(403);
      await api
        .post('/api/app/approval/decision')
        .send({ action_id: actionId, user_id: 'usr_demo', decision: 'approve', decision_source: 'web_magic_link' })
        .expect(403);
    } finally {
      runtime.service.getStore().getRawDb().prepare('UPDATE end_users SET status = ? WHERE id = ?').run('active', 'usr_demo');
    }
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

  it('includes team/self-approval fields on action response and enforces team membership', async () => {
    const api = request(runtime.app);
    const ok = await api
      .post('/v1/request_action')
      .set('x-aegis-api-key', 'aegis_demo_agent_key')
      .send({
        idempotency_key: 't_team_fields_1',
        end_user_id: 'usr_team_01',
        action_type: 'payment',
        callback_url: `${baseUrl}/_test/callback`,
        details: {
          amount: '1.00',
          currency: 'USD',
          recipient_name: 'Team Merchant',
          description: 'team member self approval',
          payment_rail: 'card',
          payment_method_preference: 'card_default',
          recipient_reference: 'merchant_api:team_test',
        },
      })
      .expect(400); // no default card yet for usr_team_01
    expect(ok.body.error).toBe('NO_DEFAULT_PAYMENT_METHOD');

    const db = runtime.service.getStore().getRawDb();
    db.prepare('INSERT INTO end_users (id, email, display_name, status, created_at) VALUES (?, ?, ?, ?, ?)')
      .run('usr_not_in_team', 'not.in.team@example.com', 'Not In Team', 'active', new Date().toISOString());
    db.prepare('INSERT INTO agent_user_links (agent_id, end_user_id, created_at) VALUES (?, ?, ?)')
      .run('agt_demo', 'usr_not_in_team', new Date().toISOString());

    const denied = await api
      .post('/v1/request_action')
      .set('x-aegis-api-key', 'aegis_demo_agent_key')
      .send({
        idempotency_key: 't_team_fields_2',
        end_user_id: 'usr_not_in_team',
        action_type: 'payment',
        callback_url: `${baseUrl}/_test/callback`,
        details: {
          amount: '1.00',
          currency: 'USD',
          recipient_name: 'Team Merchant',
          description: 'not in team',
          payment_rail: 'card',
          payment_method_preference: 'card_default',
          recipient_reference: 'merchant_api:team_test',
        },
      })
      .expect(403);
    expect(denied.body.error).toBe('USER_NOT_IN_TEAM');
  });

  it('supports app payment-method management and admin team history read-only', async () => {
    const api = request(runtime.app);
    const store = runtime.service.getStore();

    const list = await api.get('/api/app/payment-methods?user_id=usr_demo').expect(200);
    expect(Array.isArray(list.body.payment_methods)).toBe(true);
    expect(list.body.payment_methods[0]).toMatchObject({
      payment_method_id: expect.any(String),
      is_default: expect.any(Boolean),
    });

    const initialPmId = String(list.body.payment_methods[0].payment_method_id);
    const copiedPmId = store.insertPaymentMethod(
      'usr_demo',
      'card',
      'Visa **** 5555',
      'pm_tok_5555',
      JSON.stringify({ psp: 'mock_psp', brand: 'visa', last4: '5555', exp_month: 1, exp_year: 2030 })
    );
    await api.post(`/api/app/payment-methods/${encodeURIComponent(copiedPmId)}/default`).send({ user_id: 'usr_demo' }).expect(200);
    const list2 = await api.get('/api/app/payment-methods?user_id=usr_demo').expect(200);
    expect(list2.body.payment_methods.find((m: any) => m.payment_method_id === copiedPmId)?.is_default).toBe(true);

    await api.delete(`/api/app/payment-methods/${encodeURIComponent(copiedPmId)}?user_id=usr_demo`).expect(200);
    await api.delete(`/api/app/payment-methods/${encodeURIComponent(initialPmId)}?user_id=usr_team_01`).expect(404);

    const create = await api
      .post('/v1/request_action')
      .set('x-aegis-api-key', 'aegis_demo_agent_key')
      .send({
        idempotency_key: 't_admin_history_1',
        end_user_id: 'usr_demo',
        action_type: 'payment',
        callback_url: `${baseUrl}/_test/callback`,
        details: {
          amount: '2.00',
          currency: 'USD',
          recipient_name: 'History Merchant',
          description: 'history test',
          payment_rail: 'card',
          payment_method_preference: 'card_default',
          recipient_reference: 'merchant_api:history_test',
        },
      })
      .expect(201);
    expect(create.body.action.team_id).toBe('team_demo_01');
    expect(create.body.action.approval_policy).toBe('self');
    expect(create.body.action.requested_by_user_id).toBe('usr_demo');
    expect(create.body.action.approval_target_user_id).toBe('usr_demo');

    const adminHistory = await api.get('/api/app/admin/history?user_id=usr_team_admin').expect(200);
    expect(adminHistory.body.team_id).toBe('team_demo_01');
    expect(adminHistory.body.items.some((a: any) => a.action_id === create.body.action.action_id)).toBe(true);

    await api.get('/api/app/admin/history?user_id=usr_demo').expect(403);
  });

  it('GET /v1/payment_methods/capabilities returns rails and methods for linked end_user', async () => {
    const api = request(runtime.app);
    const res = await api
      .get('/v1/payment_methods/capabilities?end_user_id=usr_demo')
      .set('x-aegis-api-key', 'aegis_demo_agent_key')
      .expect(200);
    expect(res.body.end_user_id).toBe('usr_demo');
    expect(Array.isArray(res.body.rails)).toBe(true);
    expect(Array.isArray(res.body.methods)).toBe(true);
    expect(res.body.rails).toContain('card');
    expect(res.body.methods.length).toBeGreaterThanOrEqual(1);
    expect(res.body.methods[0]).toMatchObject({
      id: expect.any(String),
      rail: expect.any(String),
      alias: expect.any(String),
      is_default: expect.any(Boolean),
      metadata: expect.any(Object),
    });
  });

  it('GET /v1/payment_methods/capabilities returns empty arrays when user has no payment methods', async () => {
    const api = request(runtime.app);
    const res = await api
      .get('/v1/payment_methods/capabilities?end_user_id=usr_team_01')
      .set('x-aegis-api-key', 'aegis_demo_agent_key')
      .expect(200);
    expect(res.body.end_user_id).toBe('usr_team_01');
    expect(res.body.rails).toEqual([]);
    expect(res.body.methods).toEqual([]);
  });

  it('GET /v1/payment_methods/capabilities requires end_user_id and rejects unlinked user', async () => {
    const api = request(runtime.app);
    await api.get('/v1/payment_methods/capabilities').set('x-aegis-api-key', 'aegis_demo_agent_key').expect(400);
    const missing = await api
      .get('/v1/payment_methods/capabilities?end_user_id=')
      .set('x-aegis-api-key', 'aegis_demo_agent_key')
      .expect(400);
    expect(missing.body.error).toBe('MISSING_END_USER_ID');

    const db = runtime.service.getStore().getRawDb();
    db.prepare('INSERT OR IGNORE INTO end_users (id, email, display_name, status, created_at) VALUES (?, ?, ?, ?, ?)').run(
      'usr_unlinked_caps',
      'unlinked@example.com',
      'Unlinked User',
      'active',
      new Date().toISOString()
    );
    const unlinked = await api
      .get('/v1/payment_methods/capabilities?end_user_id=usr_unlinked_caps')
      .set('x-aegis-api-key', 'aegis_demo_agent_key')
      .expect(403);
    expect(unlinked.body.error).toBe('UNLINKED_END_USER');
  });

  it('POST /api/dev/payment-methods returns STRIPE_NOT_CONFIGURED when Stripe is not set', async () => {
    const api = request(runtime.app);
    const adminCookie = await adminLogin(api);
    const res = await api
      .post('/api/dev/payment-methods')
      .set('Cookie', [adminCookie])
      .send({ payment_method_id: 'pm_xxx_test', user_id: 'usr_demo' })
      .expect(400);
    expect(res.body.error).toBe('STRIPE_NOT_CONFIGURED');
  });

  it('POST /api/dev/payment-methods rejects invalid payment_method_id', async () => {
    const api = request(runtime.app);
    const adminCookie = await adminLogin(api);
    const res = await api
      .post('/api/dev/payment-methods')
      .set('Cookie', [adminCookie])
      .send({ payment_method_id: 'invalid', user_id: 'usr_demo' })
      .expect(400);
    expect(res.body.error).toBe('INVALID_PAYMENT_METHOD');
  });

  it('GET /api/dev/payment-methods returns payment methods for user', async () => {
    const api = request(runtime.app);
    const adminCookie = await adminLogin(api);
    const res = await api
      .get('/api/dev/payment-methods?user_id=usr_demo')
      .set('Cookie', [adminCookie])
      .expect(200);
    expect(Array.isArray(res.body.payment_methods)).toBe(true);
    expect(res.body.payment_methods.length).toBeGreaterThanOrEqual(1);
    expect(res.body.payment_methods[0]).toMatchObject({
      id: expect.any(String),
      alias: expect.any(String),
      is_default: expect.any(Boolean),
      created_at: expect.any(String),
    });
  });

  it('DELETE /api/dev/payment-methods/:id and POST :id/default work with admin auth', async () => {
    const api = request(runtime.app);
    const adminCookie = await adminLogin(api);
    const store = runtime.service.getStore();
    const extraPmId = store.insertPaymentMethod(
      'usr_demo',
      'card',
      'Test **** 9999',
      'pm_test_9999',
      JSON.stringify({ psp: 'mock_psp', brand: 'visa', last4: '9999' })
    );

    await api.get('/api/dev/payment-methods?user_id=usr_demo').set('Cookie', [adminCookie]).expect(200);

    await api
      .post(`/api/dev/payment-methods/${extraPmId}/default`)
      .set('Cookie', [adminCookie])
      .send({ user_id: 'usr_demo' })
      .expect(200);

    const listAfter = await api.get('/api/dev/payment-methods?user_id=usr_demo').set('Cookie', [adminCookie]).expect(200);
    expect(listAfter.body.payment_methods.find((m: any) => m.id === extraPmId)?.is_default).toBe(true);

    await api
      .delete(`/api/dev/payment-methods/${extraPmId}?user_id=usr_demo`)
      .set('Cookie', [adminCookie])
      .expect(200);

    const listFinal = await api.get('/api/dev/payment-methods?user_id=usr_demo').set('Cookie', [adminCookie]).expect(200);
    expect(listFinal.body.payment_methods.some((m: any) => m.id === extraPmId)).toBe(false);
  });

  it('/dev/add-card requires admin login and renders page', async () => {
    const api = request(runtime.app);
    await api.get('/dev/add-card').expect(302);

    const adminCookie = await adminLogin(api);
    const page = await api.get('/dev/add-card?user_id=usr_demo').set('Cookie', [adminCookie]).expect(200);
    expect(page.text).toContain('添加支付方式');
    expect(page.text).toContain('添加信用卡');
    expect(page.text).toContain('usr_demo');
    expect(page.text).toContain('STRIPE_SECRET_KEY');
  });

  it('D2-1: /dev/add-card and /settings/payment-methods pages load', async () => {
    const api = request(runtime.app);
    const adminCookie = await adminLogin(api);
    const addCardPage = await api.get('/dev/add-card?user_id=usr_demo').set('Cookie', [adminCookie]).expect(200);
    expect(addCardPage.text).toContain('添加');
    expect(addCardPage.text).toContain('usr_demo');

    const pmPage = await api.get('/settings/payment-methods?user_id=usr_demo').expect(200);
    expect(pmPage.text).toContain('成员信用卡管理');
    expect(pmPage.text).toContain('usr_demo');
  });

  it('D2-2: add-card page has Stripe Elements container when Stripe configured', async () => {
    const api = request(runtime.app);
    const adminCookie = await adminLogin(api);
    const page = await api.get('/dev/add-card?user_id=usr_demo').set('Cookie', [adminCookie]).expect(200);
    expect(page.text).toMatch(/card-element|添加信用卡/);
  });

  it('D2-4: payment_methods table stores alias/token only, not raw card number', async () => {
    const store = runtime.service.getStore();
    const db = store.getRawDb();
    const rows = db.prepare('SELECT rail, alias, external_token, metadata_json FROM payment_methods WHERE rail = ?').all('card') as Array<{
      rail: string;
      alias: string;
      external_token: string;
      metadata_json: string;
    }>;
    for (const r of rows) {
      expect(r.alias).not.toMatch(/\d{13,19}/);
      expect(r.external_token).toMatch(/^pm_|^tok_/);
      const meta = JSON.parse(r.metadata_json || '{}');
      expect(meta.cvv).toBeUndefined();
      expect(meta.card_number).toBeUndefined();
    }
  });

  it('D3-1: aegis_request_payment returns action_id', async () => {
    const api = request(runtime.app);
    const create = await api
      .post('/v1/request_action')
      .set('x-aegis-api-key', 'aegis_demo_agent_key')
      .send({
        idempotency_key: 'd3_verify_1',
        end_user_id: 'usr_demo',
        action_type: 'payment',
        callback_url: `${baseUrl}/_test/callback`,
        details: {
          amount: '20',
          currency: 'USD',
          recipient_name: 'Cursor',
          description: 'Cursor Pro 月费',
          payment_rail: 'card',
          payment_method_preference: 'card_default',
          recipient_reference: 'merchant_api:cursor',
        },
      })
      .expect(201);
    expect(create.body.action.action_id).toBeTruthy();
    expect(create.body.links.approval_url).toBeTruthy();
  });

  it('D3-2: approval page shows amount, recipient, description', async () => {
    const api = request(runtime.app);
    const create = await api
      .post('/v1/request_action')
      .set('x-aegis-api-key', 'aegis_demo_agent_key')
      .send({
        idempotency_key: 'd3_verify_2',
        end_user_id: 'usr_demo',
        action_type: 'payment',
        callback_url: `${baseUrl}/_test/callback`,
        details: {
          amount: '20',
          currency: 'USD',
          recipient_name: 'Cursor',
          description: 'Cursor Pro 月费',
          payment_rail: 'card',
          payment_method_preference: 'card_default',
          recipient_reference: 'merchant_api:cursor',
        },
      })
      .expect(201);
    const approvalUrl = String(create.body.links.approval_url);
    const approvalPath = new URL(approvalUrl).pathname;
    const approvalPage = await api.get(approvalPath).expect(200);
    expect(approvalPage.text).toContain('20');
    expect(approvalPage.text).toContain('Cursor');
    expect(approvalPage.text).toContain('月费');
  });

  it('GET /dashboard renders user, plan, agents', async () => {
    const api = request(runtime.app);
    const page = await api.get('/dashboard?user_id=usr_demo').expect(200);
    expect(page.text).toContain('Dashboard');
    expect(page.text).toContain('usr_demo');
    expect(page.text).toContain('Demo');
    expect(page.text).toContain('agt_demo');
  });

  it('portal pages prioritize app session over query user_id fallback', async () => {
    const api = request(runtime.app);
    const sessionRes = await api.post('/_test/app-session').send({ user_id: 'usr_demo' }).expect(200);
    const sessionCookie = extractCookieValue(sessionRes.headers['set-cookie'], 'aegis_app_session');
    const appCookie = `aegis_app_session=${sessionCookie}`;

    const pmPage = await api.get('/settings/payment-methods?user_id=usr_team_01').set('Cookie', [appCookie]).expect(200);
    expect(pmPage.text).toContain('当前用户：<code>usr_demo</code>（来自登录态）');
    expect(pmPage.text).not.toContain('当前用户：<code>usr_team_01</code>');
  });

  it('GET /settings/api-keys renders agents list', async () => {
    const api = request(runtime.app);
    const page = await api.get('/settings/api-keys?user_id=usr_demo').expect(200);
    expect(page.text).toContain('API Key');
    expect(page.text).toContain('aegis_demo_agent_key');
  });

  it('dashboard renders pre-check recovery placeholder guidance', async () => {
    const api = request(runtime.app);
    const page = await api.get('/dashboard?user_id=usr_demo&precheck_code=NO_DEFAULT_PAYMENT_METHOD').expect(200);
    expect(page.text).toContain('支付前检查失败恢复');
    expect(page.text).toContain('无默认支付方式');
    expect(page.text).toContain('去管理支付方式');
  });

  it('does not SSR-render member card aliases on /settings/payment-methods', async () => {
    const api = request(runtime.app);
    const uniqueAlias = 'SSR-LEAK-CHECK-9999';
    runtime.service
      .getStore()
      .insertPaymentMethod(
        'usr_demo',
        'card',
        uniqueAlias,
        'pm_ssr_leak_check',
        JSON.stringify({ psp: 'mock_psp', brand: 'visa', last4: '9999', exp_month: 12, exp_year: 2031 })
      );

    const page = await api.get('/settings/payment-methods?user_id=usr_demo').expect(200);
    expect(page.text).toContain('成员信用卡管理');
    expect(page.text).toContain('/api/app/payment-methods');
    expect(page.text).not.toContain(uniqueAlias);
    expect(page.text).toContain('加载中...');
  });

  it('Tavily: magic link verify creates session', async () => {
    const api = request(runtime.app);
    const store = runtime.service.getStore();
    const { token } = store.createMagicLink('usr_demo', null, 'login', addMinutesIso(new Date().toISOString(), 15));
    const verifyRes = await api.get(`/auth/magic-link/verify?token=${encodeURIComponent(token)}`).expect(302);
    const sessionCookie = extractCookieValue(verifyRes.headers['set-cookie'], 'aegis_app_session');
    expect(sessionCookie).toBeTruthy();
    expect(verifyRes.headers.location).toContain('/dashboard');
  });

  it('Tavily: magic link request returns ok for known user', async () => {
    const api = request(runtime.app);
    const reqRes = await api.post('/auth/magic-link/request').send({ email: 'demo.user@example.com' }).expect(200);
    expect(reqRes.body.ok).toBe(true);
    expect(reqRes.body.message).toContain('login link');
  });

  it('Tavily: GET /api/app/plans returns free and pro', async () => {
    const api = request(runtime.app);
    const res = await api.get('/api/app/plans').expect(200);
    expect(Array.isArray(res.body.plans)).toBe(true);
    expect(res.body.plans.length).toBeGreaterThanOrEqual(2);
    const free = res.body.plans.find((p: any) => p.slug === 'free');
    const pro = res.body.plans.find((p: any) => p.slug === 'pro');
    expect(free).toBeTruthy();
    expect(pro).toBeTruthy();
    expect(free.price_cents).toBe(0);
    expect(pro.price_cents).toBe(1999);
  });

  it('Tavily: POST/GET/DELETE /api/app/agents with app session', async () => {
    const api = request(runtime.app);
    await api.post('/api/app/agents').expect(401);

    const sessionRes = await api.post('/_test/app-session').send({ user_id: 'usr_demo' }).expect(200);
    const sessionCookie = extractCookieValue(sessionRes.headers['set-cookie'], 'aegis_app_session');
    const appCookie = `aegis_app_session=${sessionCookie}`;

    const createRes = await api
      .post('/api/app/agents')
      .set('Cookie', [appCookie])
      .send({ name: 'Test Agent' })
      .expect(201);
    expect(createRes.body.agent.id).toBeTruthy();
    expect(createRes.body.api_key).toMatch(/^aegis_/);

    const listRes = await api.get('/api/app/agents').set('Cookie', [appCookie]).expect(200);
    expect(listRes.body.agents.some((a: any) => a.name === 'Test Agent')).toBe(true);

    const agentId = createRes.body.agent.id;
    await api.delete(`/api/app/agents/${agentId}`).set('Cookie', [appCookie]).expect(200);
    const listAfter = await api.get('/api/app/agents').set('Cookie', [appCookie]).expect(200);
    expect(listAfter.body.agents.some((a: any) => a.id === agentId)).toBe(false);
  });

  it('Tavily: GET /api/app/me returns user and plan', async () => {
    const api = request(runtime.app);
    await api.get('/api/app/me').expect(401);

    const sessionRes = await api.post('/_test/app-session').send({ user_id: 'usr_demo' }).expect(200);
    const sessionCookie = extractCookieValue(sessionRes.headers['set-cookie'], 'aegis_app_session');
    const meRes = await api.get('/api/app/me').set('Cookie', [`aegis_app_session=${sessionCookie}`]).expect(200);
    expect(meRes.body.id).toBe('usr_demo');
    expect(meRes.body.email).toBe('demo.user@example.com');
    expect(meRes.body.plan).toBeTruthy();
    expect(meRes.body.plan.slug).toBe('free');
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
