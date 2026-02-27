import { createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AegisClient, verifyWebhookSignature } from '../sdk/typescript/src/index';

describe('SDK AegisClient (unit, mocked fetch)', () => {
  const baseUrl = 'http://test.local:3000';
  const apiKey = 'test_key';
  let client: AegisClient;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    client = new AegisClient({ baseUrl, apiKey });
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('requestAction', () => {
    it('succeeds and returns action', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        text: () =>
          Promise.resolve(
            JSON.stringify({
              action: { action_id: 'act_123', status: 'awaiting_approval' },
              links: { approval_url: 'http://test/approve/x' },
            }),
          ),
      });

      const result = await client.requestAction({
        idempotency_key: 'key1',
        end_user_id: 'usr_1',
        action_type: 'payment',
        details: {
          amount: '10.00',
          currency: 'USD',
          recipient_name: 'Merchant',
          description: 'Test',
          payment_rail: 'card',
          payment_method_preference: 'card_default',
          recipient_reference: 'merchant_api:test',
        },
        callback_url: 'https://agent.example.com/cb',
      });

      expect(result.action.action_id).toBe('act_123');
      expect(result.action.status).toBe('awaiting_approval');
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/v1/request_action'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'x-aegis-api-key': apiKey,
            'content-type': 'application/json',
          }),
        }),
      );
    });

    it('throws with status and body on API error', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: () => Promise.resolve(JSON.stringify({ error: 'INVALID_REQUEST', message: 'Missing field' })),
      });

      try {
        await client.requestAction({
          idempotency_key: 'k',
          end_user_id: 'u',
          action_type: 'payment',
          details: {
            amount: '1',
            currency: 'USD',
            recipient_name: 'X',
            description: 'X',
            payment_rail: 'card',
            payment_method_preference: 'card_default',
            recipient_reference: 'merchant_api:x',
          },
          callback_url: 'https://x.com/cb',
        });
      } catch (e: any) {
        expect(e.message).toBe('Missing field');
        expect(e.status).toBe(400);
        expect(e.body).toEqual({ error: 'INVALID_REQUEST', message: 'Missing field' });
      }
    });
  });

  describe('getAction', () => {
    it('succeeds and returns action', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        text: () =>
          Promise.resolve(
            JSON.stringify({
              action: { action_id: 'act_123', status: 'succeeded' },
            }),
          ),
      });

      const result = await client.getAction('act_123');
      expect(result.action.action_id).toBe('act_123');
      expect(result.action.status).toBe('succeeded');
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/v1/actions/act_123'),
        expect.objectContaining({ method: 'GET' }),
      );
    });
  });

  describe('cancelAction', () => {
    it('succeeds', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        text: () =>
          Promise.resolve(
            JSON.stringify({
              action: { action_id: 'act_123', status: 'canceled' },
            }),
          ),
      });

      const result = await client.cancelAction('act_123');
      expect(result.action.status).toBe('canceled');
    });
  });

  describe('getCapabilities', () => {
    it('succeeds with end_user_id', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        text: () =>
          Promise.resolve(
            JSON.stringify({
              end_user_id: 'usr_1',
              rails: ['card'],
              methods: [],
            }),
          ),
      });

      const result = await client.getCapabilities('usr_1');
      expect(result.end_user_id).toBe('usr_1');
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('end_user_id=usr_1'),
        expect.any(Object),
      );
    });
  });
});

describe('verifyWebhookSignature', () => {
  const secret = 'whsec_test_secret';
  const rawBody = '{"event":"action.approved","action_id":"act_123"}';

  it('returns true for valid signature', () => {
    const ts = Math.floor(Date.now() / 1000);
    const expected = createHmac('sha256', secret).update(`${ts}.${rawBody}`).digest('hex');
    const header = `t=${ts},v1=${expected}`;
    expect(verifyWebhookSignature({ rawBody, signatureHeader: header, secret })).toBe(true);
  });

  it('returns false for invalid signature', () => {
    const ts = Math.floor(Date.now() / 1000);
    const header = `t=${ts},v1=wrong_signature`;
    expect(verifyWebhookSignature({ rawBody, signatureHeader: header, secret })).toBe(false);
  });

  it('returns false for expired timestamp', () => {
    const ts = Math.floor(Date.now() / 1000) - 400;
    const expected = createHmac('sha256', secret).update(`${ts}.${rawBody}`).digest('hex');
    const header = `t=${ts},v1=${expected}`;
    expect(verifyWebhookSignature({ rawBody, signatureHeader: header, secret, toleranceSeconds: 300 })).toBe(false);
  });

  it('returns true when within tolerance with custom now', () => {
    const now = new Date('2026-01-01T12:00:00Z');
    const ts = Math.floor(now.getTime() / 1000);
    const expected = createHmac('sha256', secret).update(`${ts}.${rawBody}`).digest('hex');
    const header = `t=${ts},v1=${expected}`;
    expect(verifyWebhookSignature({ rawBody, signatureHeader: header, secret, now, toleranceSeconds: 300 })).toBe(
      true,
    );
  });

  it('returns false for malformed header (missing v1)', () => {
    expect(verifyWebhookSignature({ rawBody, signatureHeader: 't=123', secret })).toBe(false);
  });

  it('returns false for malformed header (invalid t)', () => {
    expect(verifyWebhookSignature({ rawBody, signatureHeader: 't=abc,v1=xxx', secret })).toBe(false);
  });
});
