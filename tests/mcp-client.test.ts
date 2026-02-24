import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { AegisClient } from '../mcp-server/src/client';

describe('mcp-client', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  const client = new AegisClient('https://api.test', 'test_key', 'usr_demo');

  it('capabilities returns rails and methods on success', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          end_user_id: 'usr_demo',
          rails: ['card', 'crypto'],
          methods: [{ id: 'pm_1', rail: 'card', alias: 'Visa ****', is_default: true }],
        }),
    });

    const result = await client.capabilities();
    expect(result.end_user_id).toBe('usr_demo');
    expect(result.rails).toContain('card');
    expect(result.methods).toHaveLength(1);
  });

  it('capabilities throws on 4xx', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: () => Promise.resolve('Unauthorized'),
    });

    await expect(client.capabilities()).rejects.toThrow('Aegis API error 401');
  });

  it('requestPayment returns action on success', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          action: {
            action_id: 'act_1',
            status: 'awaiting_approval',
            action_type: 'payment',
            end_user_id: 'usr_demo',
            details: { amount: '10', currency: 'USD', recipient_name: 'X', description: 'Y', payment_rail: 'card', payment_method_preference: 'card_default', recipient_reference: 'merchant_api:x' },
            callback_url: '',
            expires_at: '',
            created_at: '',
          },
        }),
    });

    const result = await client.requestPayment({
      amount: '10',
      currency: 'USD',
      recipient_name: 'X',
      description: 'Y',
      payment_rail: 'card',
    });
    expect(result.action.action_id).toBe('act_1');
    expect(result.action.status).toBe('awaiting_approval');
  });

  it('getStatus returns action', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          action: {
            action_id: 'act_1',
            status: 'succeeded',
            action_type: 'payment',
            end_user_id: 'usr_demo',
            details: {},
            callback_url: '',
            expires_at: '',
            created_at: '',
          },
        }),
    });

    const result = await client.getStatus('act_1');
    expect(result.action.status).toBe('succeeded');
  });

  it('cancel returns action', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          action: {
            action_id: 'act_1',
            status: 'canceled',
            action_type: 'payment',
            end_user_id: 'usr_demo',
            details: {},
            callback_url: '',
            expires_at: '',
            created_at: '',
          },
        }),
    });

    const result = await client.cancel('act_1', 'User cancelled');
    expect(result.action.status).toBe('canceled');
  });
});
