import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { WebhookSender } from '../../src/services/webhookSender';
import type { AppConfig } from '../../src/config';
import type { WebhookDeliveryRecord } from '../../src/services/store';

const mockConfig: AppConfig = {
  port: 3000,
  baseUrl: 'http://localhost:3000',
  dbPath: ':memory:',
  emailFrom: 'test@test.com',
  webhookSigningSecret: 'secret',
  autoStartWorkers: false,
  approvalExpiryMinutesDefault: 15,
  sessionCookieName: 'aegis_session',
  adminPassword: 'x',
  adminSessionSecret: 'x',
  adminSessionCookieName: 'aegis_admin_session',
  stripeSecretKey: null,
  stripePublishableKey: null,
} as AppConfig;

const mockDelivery: WebhookDeliveryRecord = {
  id: 'del_1',
  event_id: 'evt_1',
  action_id: 'act_1',
  agent_id: 'agt_1',
  event_type: 'action.succeeded',
  callback_url: 'https://example.com/webhook',
  payload_json: '{"action":{"id":"act_1","status":"succeeded"}}',
  status: 'pending',
  http_status: null,
  attempts: 0,
  next_attempt_at: null,
  last_error: null,
  last_attempt_at: null,
  delivered_at: null,
  created_at: new Date().toISOString(),
};

describe('webhookSender', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('sends POST with correct headers and body', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    globalThis.fetch = fetchMock;

    const sender = new WebhookSender(mockConfig);
    const result = await sender.deliver(mockDelivery, 'agent_webhook_secret');

    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.com/webhook',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'content-type': 'application/json',
          'x-aegis-signature': expect.stringMatching(/^t=\d+,v1=[a-f0-9]+$/),
          'x-aegis-event-id': 'evt_1',
          'x-aegis-event-type': 'action.succeeded',
        }),
        body: mockDelivery.payload_json,
      })
    );
  });

  it('returns error when fetch fails', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500, text: () => Promise.resolve('Server Error') });

    const sender = new WebhookSender(mockConfig);
    const result = await sender.deliver(mockDelivery, 'agent_webhook_secret');

    expect(result.ok).toBe(false);
    expect(result.status).toBe(500);
  });

  it('returns error when fetch throws', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    const sender = new WebhookSender(mockConfig);
    const result = await sender.deliver(mockDelivery, 'agent_webhook_secret');

    expect(result.ok).toBe(false);
    expect(result.status).toBeNull();
    expect(result.error).toContain('Network error');
  });
});
