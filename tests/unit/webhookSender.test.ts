import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WebhookSender } from '../../src/services/webhookSender';
import type { AppConfig } from '../../src/config';
import type { WebhookDeliveryRecord } from '../../src/services/store';

function createConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    port: 3000,
    baseUrl: 'http://localhost:3000',
    dbPath: ':memory:',
    emailFrom: 'no-reply@test.local',
    webhookSigningSecret: 'whsec_test',
    autoStartWorkers: false,
    approvalExpiryMinutesDefault: 15,
    sessionCookieName: 'aegis_session',
    adminPassword: 'test',
    adminSessionSecret: 'test',
    adminSessionCookieName: 'aegis_admin_session',
    appSessionSecret: 'test_app_session_secret',
    appSessionCookieName: 'aegis_app_session',
    stripeSecretKey: null,
    stripePublishableKey: null,
    ...overrides,
  };
}

const mockDelivery: WebhookDeliveryRecord = {
  id: 'wh_1',
  event_id: 'evt_abc',
  action_id: 'act_1',
  agent_id: 'agt_1',
  event_type: 'action.approved',
  callback_url: 'https://example.com/webhook',
  payload_json: '{"event_type":"action.approved","action":{"id":"act_1"}}',
  status: 'pending',
  http_status: null,
  attempts: 0,
  next_attempt_at: null,
  last_error: null,
  last_attempt_at: null,
  delivered_at: null,
  created_at: new Date().toISOString(),
};

describe('WebhookSender', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('sends POST with correct headers and payload', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    globalThis.fetch = fetchMock;

    const sender = new WebhookSender(createConfig());
    const result = await sender.deliver(mockDelivery, 'agent_whsec');

    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe('https://example.com/webhook');
    expect(opts.method).toBe('POST');
    expect(opts.headers['content-type']).toBe('application/json');
    expect(opts.headers['x-aegis-event-id']).toBe('evt_abc');
    expect(opts.headers['x-aegis-event-type']).toBe('action.approved');
    expect(opts.headers['x-aegis-signature']).toMatch(/^t=\d+,v1=[0-9a-f]+$/);
    expect(opts.body).toBe(mockDelivery.payload_json);
  });

  it('uses agent webhook secret when provided', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    globalThis.fetch = fetchMock;

    const sender = new WebhookSender(createConfig({ webhookSigningSecret: 'global_secret' }));
    await sender.deliver(mockDelivery, 'agent_specific_secret');

    const sig = fetchMock.mock.calls[0][1].headers['x-aegis-signature'];
    expect(sig).toMatch(/^t=\d+,v1=[0-9a-f]+$/);
  });

  it('returns ok: false when server returns non-2xx', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500, text: () => Promise.resolve('Server Error') });
    globalThis.fetch = fetchMock;

    const sender = new WebhookSender(createConfig());
    const result = await sender.deliver(mockDelivery, 'agent_whsec');

    expect(result.ok).toBe(false);
    expect(result.status).toBe(500);
    expect(result.error).toBeTruthy();
  });

  it('returns ok: false on network error', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    globalThis.fetch = fetchMock;

    const sender = new WebhookSender(createConfig());
    const result = await sender.deliver(mockDelivery, 'agent_whsec');

    expect(result.ok).toBe(false);
    expect(result.status).toBeNull();
    expect(result.error).toContain('ECONNREFUSED');
  });
});
