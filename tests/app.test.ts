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

  it('creates, approves, executes, and callbacks for card rail', async () => {
    const api = request(runtime.app);
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

    await api.post('/api/dev/workers/tick').send({}).expect(200);

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

    await api.post('/api/dev/workers/tick').send({}).expect(200);

    const actionId = String(create.body.action.action_id);
    const final = await api.get(`/v1/actions/${actionId}`).set('x-aegis-api-key', 'aegis_demo_agent_key').expect(200);
    expect(final.body.action.status).toBe('denied');

    const deniedCallbacks = runtime.testCallbackInbox.filter((e) => e.body && (e.body as any).event_type === 'action.denied');
    expect(deniedCallbacks.length).toBeGreaterThan(0);
  });

  it('supports cancel before approval and emits canceled callback', async () => {
    const api = request(runtime.app);
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
    await api.post('/api/dev/workers/tick').send({}).expect(200);

    const final = await api.get(`/v1/actions/${actionId}`).set('x-aegis-api-key', 'aegis_demo_agent_key').expect(200);
    expect(final.body.action.status).toBe('canceled');

    const canceledCallbacks = runtime.testCallbackInbox.filter((e) => e.body && (e.body as any).event_type === 'action.canceled');
    expect(canceledCallbacks.length).toBeGreaterThan(0);
  });

  it('handles execution failure and can requeue a failed webhook delivery', async () => {
    const api = request(runtime.app);

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
    await api.post(`/api/dev/actions/${actionId}/decision`).send({ decision: 'approve' }).expect(200);
    await api.post('/api/dev/workers/tick').send({}).expect(200);

    const final = await api.get(`/v1/actions/${actionId}`).set('x-aegis-api-key', 'aegis_demo_agent_key').expect(200);
    expect(final.body.action.status).toBe('failed');
    expect(final.body.action.execution?.error_code).toBe('PSP_DECLINED');

    const deliveriesRes = await api.get(`/api/dev/webhooks?action_id=${encodeURIComponent(actionId)}`).expect(200);
    const deliveries = deliveriesRes.body.deliveries as Array<any>;
    expect(deliveries.length).toBeGreaterThan(0);
    expect(deliveries.some((d) => d.status === 'pending' || d.status === 'dead')).toBe(true);

    const target = deliveries[0];
    await api.post(`/api/dev/webhooks/${target.id}/requeue`).send({}).expect(200);
    const afterRequeue = await api.get(`/api/dev/webhooks?action_id=${encodeURIComponent(actionId)}`).expect(200);
    const updated = (afterRequeue.body.deliveries as Array<any>).find((d) => d.id === target.id);
    expect(updated?.status).toBe('pending');
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

function extractHidden(html: string, name: string): string {
  const re = new RegExp(`<input[^>]+name=["']${name}["'][^>]+value=["']([^"']+)["']`, 'i');
  const match = html.match(re);
  return match?.[1] ?? '';
}
