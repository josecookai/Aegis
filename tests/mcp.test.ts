import http from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAegisApp } from '../src/app';
import { AegisClient } from '../mcp-server/src/client';

describe('Aegis MCP integration', () => {
  const runtime = createAegisApp({ dbPath: ':memory:', autoStartWorkers: false, baseUrl: 'http://localhost:0' });
  let server: http.Server;
  let baseUrl: string;
  let client: AegisClient;
  let adminCookie: string;

  beforeAll(async () => {
    server = runtime.app.listen(0, '127.0.0.1');
    await new Promise<void>((resolve) => server.once('listening', () => resolve()));
    const addr = server.address();
    if (!addr || typeof addr === 'string') throw new Error('Failed to bind test server');
    baseUrl = `http://127.0.0.1:${addr.port}`;
    runtime.config.baseUrl = baseUrl;
    client = new AegisClient(baseUrl, 'aegis_demo_agent_key', 'usr_demo');

    const loginRes = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'aegis_admin_dev' }),
      redirect: 'manual',
    });
    adminCookie = (loginRes.headers.getSetCookie?.() ?? []).join('; ');
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
    runtime.stop();
  });

  it('lists capabilities for the demo user', async () => {
    const caps = await client.capabilities();
    expect(caps.end_user_id).toBe('usr_demo');
    expect(Array.isArray(caps.rails)).toBe(true);
    expect(caps.rails).toContain('card');
    expect(Array.isArray(caps.methods)).toBe(true);
  });

  it('creates a payment request and retrieves its status', async () => {
    const created = await client.requestPayment({
      amount: '15.00',
      currency: 'USD',
      recipient_name: 'MCP Test Merchant',
      description: 'MCP integration test payment',
      payment_rail: 'card',
    });

    expect(created.action).toBeDefined();
    expect(created.action.action_id).toBeTruthy();
    expect(created.action.status).toBe('awaiting_approval');
    expect(created.links?.approval_url).toBeTruthy();

    const status = await client.getStatus(created.action.action_id);
    expect(status.action.action_id).toBe(created.action.action_id);
    expect(status.action.status).toBe('awaiting_approval');
    expect(status.action.details.amount).toBe('15.00');
    expect(status.action.details.recipient_name).toBe('MCP Test Merchant');
  });

  it('creates a crypto payment request with rail-consistent defaults', async () => {
    const created = await client.requestPayment({
      amount: '5.00',
      currency: 'USDC',
      recipient_name: 'Crypto Merchant',
      description: 'MCP crypto payload test',
      payment_rail: 'crypto',
    });

    expect(created.action.status).toBe('awaiting_approval');
    expect(created.action.details.payment_rail).toBe('crypto');
    expect(created.action.details.payment_method_preference).toBe('crypto_default');
    expect(String(created.action.details.recipient_reference)).toMatch(/^wallet:/);
  });

  it('cancels a pending payment request', async () => {
    const created = await client.requestPayment({
      amount: '25.00',
      currency: 'USD',
      recipient_name: 'Cancel Test',
      description: 'To be cancelled via MCP',
      payment_rail: 'card',
    });

    const cancelled = await client.cancel(created.action.action_id, 'MCP test cancellation');
    expect(cancelled.action.action_id).toBe(created.action.action_id);
    expect(cancelled.action.status).toBe('canceled');
  });

  it('returns error for non-existent action', async () => {
    await expect(client.getStatus('nonexistent_action_id')).rejects.toThrow(/Aegis API error/);
  });

  it('full payment flow: request -> approve -> execute -> verify', async () => {
    const created = await client.requestPayment({
      amount: '99.00',
      currency: 'USD',
      recipient_name: 'E2E Merchant',
      description: 'Full MCP flow test',
      payment_rail: 'card',
    });
    const actionId = created.action.action_id;

    const approveRes = await fetch(`${baseUrl}/api/dev/actions/${actionId}/decision`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ decision: 'approve', decision_source: 'mcp_test' }),
    });
    expect(approveRes.ok).toBe(true);

    await fetch(`${baseUrl}/api/dev/workers/tick`, {
      method: 'POST',
      headers: { Cookie: adminCookie },
    });

    const final = await client.getStatus(actionId);
    expect(['succeeded', 'approved']).toContain(final.action.status);
  });
});
