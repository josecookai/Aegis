import { describe, expect, it } from 'vitest';
import { requestActionSchema, webhookTestSchema, cancelActionSchema } from '../../src/schemas';

const validRequestAction = {
  idempotency_key: 'key_123',
  end_user_id: 'usr_demo',
  action_type: 'payment' as const,
  details: {
    amount: '19.99',
    currency: 'USD',
    recipient_name: 'Merchant',
    description: 'Test payment',
    payment_rail: 'card' as const,
    payment_method_preference: 'card_default',
    recipient_reference: 'merchant_api:test',
  },
};

describe('schemas', () => {
  describe('requestActionSchema', () => {
    it('accepts valid minimal input', () => {
      const result = requestActionSchema.parse(validRequestAction);
      expect(result.action_type).toBe('payment');
      expect(result.details.amount).toBe('19.99');
    });
    it('accepts optional callback_url', () => {
      const withCallback = { ...validRequestAction, callback_url: 'https://example.com/cb' };
      const result = requestActionSchema.parse(withCallback);
      expect(result.callback_url).toBe('https://example.com/cb');
    });
    it('accepts optional expires_at', () => {
      const withExpiry = { ...validRequestAction, expires_at: '2026-12-31T23:59:59.000Z' };
      const result = requestActionSchema.parse(withExpiry);
      expect(result.expires_at).toBe('2026-12-31T23:59:59.000Z');
    });
    it('accepts optional metadata', () => {
      const withMeta = { ...validRequestAction, metadata: { foo: 'bar' } };
      const result = requestActionSchema.parse(withMeta);
      expect(result.metadata).toEqual({ foo: 'bar' });
    });
    it('accepts crypto rail', () => {
      const crypto = {
        ...validRequestAction,
        details: {
          ...validRequestAction.details,
          payment_rail: 'crypto' as const,
          payment_method_preference: 'crypto_default',
          currency: 'USDC',
          recipient_reference: 'address:0x1234567890abcdef',
        },
      };
      const result = requestActionSchema.parse(crypto);
      expect(result.details.payment_rail).toBe('crypto');
    });
    it('rejects empty idempotency_key', () => {
      expect(() => requestActionSchema.parse({ ...validRequestAction, idempotency_key: '' })).toThrow();
    });
    it('rejects invalid action_type', () => {
      expect(() => requestActionSchema.parse({ ...validRequestAction, action_type: 'refund' })).toThrow();
    });
    it('rejects invalid amount format', () => {
      expect(() =>
        requestActionSchema.parse({
          ...validRequestAction,
          details: { ...validRequestAction.details, amount: 'abc' },
        })
      ).toThrow();
    });
    it('rejects invalid payment_rail', () => {
      expect(() =>
        requestActionSchema.parse({
          ...validRequestAction,
          details: { ...validRequestAction.details, payment_rail: 'bank' },
        })
      ).toThrow();
    });
    it('rejects invalid callback_url', () => {
      expect(() => requestActionSchema.parse({ ...validRequestAction, callback_url: 'not-a-url' })).toThrow();
    });
  });

  describe('webhookTestSchema', () => {
    it('accepts valid callback_url', () => {
      const result = webhookTestSchema.parse({ callback_url: 'https://example.com/webhook' });
      expect(result.callback_url).toBe('https://example.com/webhook');
    });
    it('rejects invalid url', () => {
      expect(() => webhookTestSchema.parse({ callback_url: 'invalid' })).toThrow();
    });
  });

  describe('cancelActionSchema', () => {
    it('accepts empty object', () => {
      const result = cancelActionSchema.parse({});
      expect(result.reason).toBeUndefined();
    });
    it('accepts optional reason', () => {
      const result = cancelActionSchema.parse({ reason: 'User requested' });
      expect(result.reason).toBe('User requested');
    });
    it('rejects reason over 200 chars', () => {
      expect(() => cancelActionSchema.parse({ reason: 'x'.repeat(201) })).toThrow();
    });
  });
});
