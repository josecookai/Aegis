import crypto from 'node:crypto';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { AegisClient, verifyWebhookSignature } from '../sdk/typescript/src/index';

describe('sdk', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  const client = new AegisClient({ baseUrl: 'https://api.test', apiKey: 'test_key' });

  describe('AegisClient', () => {
    it('requestAction returns data on success', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () =>
          Promise.resolve(
            JSON.stringify({
              action: { action_id: 'act_1', status: 'awaiting_approval' },
              links: { approval_url: 'https://aegis.app/approve/x' },
            })
          ),
      });

      const result = await client.requestAction({
        idempotency_key: 'idem_1',
        end_user_id: 'usr_demo',
        action_type: 'payment',
        callback_url: 'https://example.com/cb',
        details: {
          amount: '10',
          currency: 'USD',
          recipient_name: 'X',
          description: 'Y',
          payment_rail: 'card',
          payment_method_preference: 'card_default',
          recipient_reference: 'merchant_api:x',
        },
      });
      expect(result.action.action_id).toBe('act_1');
    });

    it('getAction returns action', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () =>
          Promise.resolve(
            JSON.stringify({
              action: { action_id: 'act_1', status: 'succeeded' },
            })
          ),
      });

      const result = await client.getAction('act_1');
      expect(result.action.status).toBe('succeeded');
    });

    it('getCapabilities returns capabilities', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () =>
          Promise.resolve(
            JSON.stringify({
              end_user_id: 'usr_demo',
              rails: ['card'],
              methods: [],
            })
          ),
      });

      const result = await client.getCapabilities('usr_demo');
      expect(result.rails).toContain('card');
    });

    it('throws on API error', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: () => Promise.resolve(JSON.stringify({ message: 'Bad request' })),
      });

      await expect(
        client.requestAction({
          idempotency_key: 'x',
          end_user_id: 'usr_demo',
          action_type: 'payment',
          callback_url: 'https://x.com/cb',
          details: {
            amount: '10',
            currency: 'USD',
            recipient_name: 'X',
            description: 'Y',
            payment_rail: 'card',
            payment_method_preference: 'card_default',
            recipient_reference: 'merchant_api:x',
          },
        })
      ).rejects.toThrow();
    });
  });

  describe('verifyWebhookSignature', () => {
    it('returns true for valid signature', () => {
      const ts = Math.floor(Date.now() / 1000);
      const payload = '{"action":{"id":"act_1"}}';
      const expected = crypto.createHmac('sha256', 'secret').update(`${ts}.${payload}`).digest('hex');
      const sig = `t=${ts},v1=${expected}`;
      expect(verifyWebhookSignature({ rawBody: payload, signatureHeader: sig, secret: 'secret' })).toBe(true);
    });
    it('returns false for invalid signature', () => {
      const ts = Math.floor(Date.now() / 1000);
      const payload = '{"action":{"id":"act_1"}}';
      const sig = `t=${ts},v1=wronghex`;
      expect(verifyWebhookSignature({ rawBody: payload, signatureHeader: sig, secret: 'secret' })).toBe(false);
    });
    it('returns false for expired timestamp', () => {
      const ts = Math.floor(Date.now() / 1000) - 400;
      const payload = '{}';
      const expected = crypto.createHmac('sha256', 'secret').update(`${ts}.${payload}`).digest('hex');
      const sig = `t=${ts},v1=${expected}`;
      expect(verifyWebhookSignature({ rawBody: payload, signatureHeader: sig, secret: 'secret' })).toBe(false);
    });
  });
});
