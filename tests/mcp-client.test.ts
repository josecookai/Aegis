import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AegisClient } from '../mcp-server/src/client';

describe('MCP AegisClient (unit, mocked fetch)', () => {
  const baseUrl = 'http://test.local:3000';
  const apiKey = 'test_key';
  const userId = 'usr_test';
  let client: AegisClient;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    client = new AegisClient(baseUrl, apiKey, userId);
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('requestPayment', () => {
    it('succeeds and returns action with approval_url', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            action: {
              action_id: 'act_123',
              status: 'awaiting_approval',
              action_type: 'payment',
              end_user_id: userId,
              details: {
                amount: '20.00',
                currency: 'USD',
                recipient_name: 'Test',
                description: 'Test',
                payment_rail: 'card',
                payment_method_preference: 'card_default',
                recipient_reference: 'merchant_api:mcp',
              },
              callback_url: '',
              expires_at: '2026-01-01T00:00:00Z',
              created_at: '2026-01-01T00:00:00Z',
            },
            links: { approval_url: 'http://test.local/approve/tok_abc' },
          }),
      });

      const result = await client.requestPayment({
        amount: '20.00',
        currency: 'USD',
        recipient_name: 'Test',
        description: 'Test',
        payment_rail: 'card',
      });

      expect(result.action.action_id).toBe('act_123');
      expect(result.action.status).toBe('awaiting_approval');
      expect(result.links?.approval_url).toBe('http://test.local/approve/tok_abc');
      expect(fetchMock).toHaveBeenCalledWith(
        `${baseUrl}/v1/request_action`,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'X-Aegis-API-Key': apiKey,
            'Content-Type': 'application/json',
          }),
        }),
      );
      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.details.recipient_reference).toBe('merchant_api:mcp');
      expect(body.details.payment_method_preference).toBe('card_default');
    });

    it('uses crypto_default and wallet:mcp for crypto rail', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            action: {
              action_id: 'act_crypto',
              status: 'awaiting_approval',
              action_type: 'payment',
              end_user_id: userId,
              details: {
                amount: '5.00',
                currency: 'USDC',
                recipient_name: 'Crypto',
                description: 'Crypto',
                payment_rail: 'crypto',
                payment_method_preference: 'crypto_default',
                recipient_reference: 'wallet:mcp',
              },
              callback_url: '',
              expires_at: '2026-01-01T00:00:00Z',
              created_at: '2026-01-01T00:00:00Z',
            },
            links: {},
          }),
      });

      await client.requestPayment({
        amount: '5.00',
        currency: 'USDC',
        recipient_name: 'Crypto',
        description: 'Crypto',
        payment_rail: 'crypto',
      });

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.details.recipient_reference).toBe('wallet:mcp');
      expect(body.details.payment_method_preference).toBe('crypto_default');
    });

    it('throws on API error response', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: () => Promise.resolve('Unauthorized'),
      });

      await expect(
        client.requestPayment({
          amount: '1.00',
          currency: 'USD',
          recipient_name: 'X',
          description: 'X',
          payment_rail: 'card',
        }),
      ).rejects.toThrow(/Aegis API error 401/);
    });
  });

  describe('getStatus', () => {
    it('succeeds and returns action', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            action: {
              action_id: 'act_123',
              status: 'succeeded',
              action_type: 'payment',
              end_user_id: userId,
              details: {},
              callback_url: '',
              expires_at: '',
              created_at: '',
            },
          }),
      });

      const result = await client.getStatus('act_123');
      expect(result.action.action_id).toBe('act_123');
      expect(result.action.status).toBe('succeeded');
      expect(fetchMock).toHaveBeenCalledWith(
        `${baseUrl}/v1/actions/act_123`,
        expect.objectContaining({ headers: expect.any(Object) }),
      );
    });

    it('throws on 404', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: () => Promise.resolve('Not found'),
      });

      await expect(client.getStatus('act_nonexistent')).rejects.toThrow(/Aegis API error 404/);
    });
  });

  describe('cancel', () => {
    it('succeeds with optional reason', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            action: {
              action_id: 'act_123',
              status: 'canceled',
              action_type: 'payment',
              end_user_id: userId,
              details: {},
              callback_url: '',
              expires_at: '',
              created_at: '',
            },
          }),
      });

      const result = await client.cancel('act_123', 'User requested');
      expect(result.action.status).toBe('canceled');
      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.reason).toBe('User requested');
    });

    it('succeeds without reason', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            action: {
              action_id: 'act_123',
              status: 'canceled',
              action_type: 'payment',
              end_user_id: userId,
              details: {},
              callback_url: '',
              expires_at: '',
              created_at: '',
            },
          }),
      });

      await client.cancel('act_123');
      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body).toEqual({});
    });

    it('throws on API error', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 409,
        text: () => Promise.resolve('Already executed'),
      });

      await expect(client.cancel('act_123')).rejects.toThrow(/Aegis API error 409/);
    });
  });

  describe('capabilities', () => {
    it('succeeds and returns rails and methods', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            end_user_id: userId,
            rails: ['card', 'crypto'],
            methods: [{ id: 'pm_1', rail: 'card', alias: 'Visa **** 4242', is_default: true }],
          }),
      });

      const result = await client.capabilities();
      expect(result.end_user_id).toBe(userId);
      expect(result.rails).toContain('card');
      expect(result.rails).toContain('crypto');
      expect(result.methods).toHaveLength(1);
      expect(fetchMock).toHaveBeenCalledWith(
        `${baseUrl}/v1/payment_methods/capabilities?end_user_id=${encodeURIComponent(userId)}`,
        expect.objectContaining({ headers: expect.any(Object) }),
      );
    });

    it('throws on API error', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: () => Promise.resolve('Missing end_user_id'),
      });

      await expect(client.capabilities()).rejects.toThrow(/Aegis API error 400/);
    });
  });
});
