import { describe, expect, it } from 'vitest';
import { requestActionSchema, webhookTestSchema, cancelActionSchema } from '../../src/schemas';

describe('schemas', () => {
  const validRequest = {
    idempotency_key: 'idem_123',
    end_user_id: 'usr_demo',
    action_type: 'payment' as const,
    details: {
      amount: '10.00',
      currency: 'USD',
      recipient_name: 'Merchant',
      description: 'Test payment',
      payment_rail: 'card' as const,
      payment_method_preference: 'card_default',
      recipient_reference: 'merchant_api:test',
    },
  };

  describe('requestActionSchema', () => {
    it('parses valid request without callback_url', () => {
      const r = requestActionSchema.parse(validRequest);
      expect(r.idempotency_key).toBe('idem_123');
      expect(r.end_user_id).toBe('usr_demo');
      expect(r.action_type).toBe('payment');
      expect(r.details.amount).toBe('10.00');
      expect(r.callback_url).toBeUndefined();
    });
    it('parses valid request with callback_url', () => {
      const r = requestActionSchema.parse({ ...validRequest, callback_url: 'https://example.com/cb' });
      expect(r.callback_url).toBe('https://example.com/cb');
    });
    it('rejects empty idempotency_key', () => {
      expect(() => requestActionSchema.parse({ ...validRequest, idempotency_key: '' })).toThrow();
    });
    it('rejects invalid action_type', () => {
      expect(() => requestActionSchema.parse({ ...validRequest, action_type: 'refund' })).toThrow();
    });
    it('rejects invalid amount format', () => {
      expect(() =>
        requestActionSchema.parse({
          ...validRequest,
          details: { ...validRequest.details, amount: 'abc' },
        })
      ).toThrow();
    });
    it('rejects invalid payment_rail', () => {
      expect(() =>
        requestActionSchema.parse({
          ...validRequest,
          details: { ...validRequest.details, payment_rail: 'bank' },
        })
      ).toThrow();
    });
    it('rejects invalid callback_url', () => {
      expect(() => requestActionSchema.parse({ ...validRequest, callback_url: 'not-a-url' })).toThrow();
    });
  });

  describe('webhookTestSchema', () => {
    it('parses valid callback_url', () => {
      const r = webhookTestSchema.parse({ callback_url: 'https://example.com/webhook' });
      expect(r.callback_url).toBe('https://example.com/webhook');
    });
    it('rejects invalid url', () => {
      expect(() => webhookTestSchema.parse({ callback_url: 'invalid' })).toThrow();
    });
    it('rejects missing callback_url', () => {
      expect(() => webhookTestSchema.parse({})).toThrow();
    });
  });

  describe('cancelActionSchema', () => {
    it('parses empty object', () => {
      const r = cancelActionSchema.parse({});
      expect(r.reason).toBeUndefined();
    });
    it('parses valid reason', () => {
      const r = cancelActionSchema.parse({ reason: 'User cancelled' });
      expect(r.reason).toBe('User cancelled');
    });
    it('rejects reason too long', () => {
      expect(() => cancelActionSchema.parse({ reason: 'x'.repeat(201) })).toThrow();
    });
  });
});
