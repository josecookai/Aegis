import { describe, expect, it } from 'vitest';
import { ExecutionEngine } from '../../src/services/execution';
import { SandboxFaultService } from '../../src/services/sandboxFaults';
import type { ActionRecord, PaymentMethodRecord } from '../../src/types';

function mockAction(overrides?: Partial<ActionRecord>): ActionRecord {
  return {
    id: 'act_test',
    agent_id: 'agt_demo',
    end_user_id: 'usr_demo',
    status: 'approved',
    payment_rail: 'card',
    amount: '10.00',
    currency: 'USD',
    recipient_name: 'Test',
    description: 'Test',
    recipient_reference: 'merchant_api:test',
    ...overrides,
  } as ActionRecord;
}

function mockPaymentMethod(rail: 'card' | 'crypto'): PaymentMethodRecord {
  return {
    id: 'pm_test',
    end_user_id: 'usr_demo',
    rail,
    alias: 'Test',
    external_token: rail === 'card' ? 'pm_tok_visa4242' : 'wallet_demo_base_usdc',
    metadata_json: '{}',
    is_default: 1,
    created_at: new Date().toISOString(),
  } as PaymentMethodRecord;
}

describe('execution', () => {
  describe('ExecutionEngine without Stripe', () => {
    const engine = new ExecutionEngine(undefined, undefined, true);

    it('isStripeEnabled is false', () => {
      expect(engine.isStripeEnabled).toBe(false);
    });

    it('executeCard returns mock success', async () => {
      const action = mockAction({ payment_rail: 'card' });
      const pm = mockPaymentMethod('card');
      const result = await engine.execute(action, pm);
      expect(result.success).toBe(true);
      expect(result.rail).toBe('card');
      expect(result.provider).toBeTruthy();
    });

    it('executeCrypto returns mock success', async () => {
      const action = mockAction({ payment_rail: 'crypto', recipient_reference: 'wallet:test' });
      const pm = mockPaymentMethod('crypto');
      const result = await engine.execute(action, pm);
      expect(result.success).toBe(true);
      expect(result.rail).toBe('crypto');
    });

    it('returns INVALID_PAYMENT_METHOD for rail mismatch', async () => {
      const action = mockAction({ payment_rail: 'card' });
      const pm = mockPaymentMethod('crypto');
      const result = await engine.execute(action, pm);
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('INVALID_PAYMENT_METHOD');
    });

    it('returns PROVIDER_UNAVAILABLE when mock fallback is disabled', async () => {
      const strictEngine = new ExecutionEngine(undefined, undefined, false);
      const action = mockAction({ payment_rail: 'card' });
      const pm = mockPaymentMethod('card');
      const result = await strictEngine.execute(action, pm);
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('PROVIDER_UNAVAILABLE');
      expect(result.provider).toBe('stripe');
    });
  });

  describe('ExecutionEngine with sandbox fault', () => {
    it('injects decline for card', async () => {
      const sandbox = new SandboxFaultService();
      sandbox.setCardFault('decline');
      const engine = new ExecutionEngine(sandbox, undefined, true);
      const action = mockAction({ payment_rail: 'card' });
      const pm = mockPaymentMethod('card');
      const result = await engine.execute(action, pm);
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('PSP_DECLINED');
    });

    it('injects timeout for card', async () => {
      const sandbox = new SandboxFaultService();
      sandbox.setCardFault('timeout');
      const engine = new ExecutionEngine(sandbox, undefined, true);
      const action = mockAction({ payment_rail: 'card' });
      const pm = mockPaymentMethod('card');
      const result = await engine.execute(action, pm);
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('TIMEOUT');
    });

    it('fault is consumed once (scope once)', async () => {
      const sandbox = new SandboxFaultService();
      sandbox.setCardFault('decline', 'once');
      const engine = new ExecutionEngine(sandbox, undefined, true);
      const action = mockAction({ payment_rail: 'card', recipient_reference: 'merchant_api:test' });
      const pm = mockPaymentMethod('card');
      const r1 = await engine.execute(action, pm);
      expect(r1.success).toBe(false);
      const r2 = await engine.execute({ ...action, id: 'act_2', recipient_reference: 'merchant_api:test' } as ActionRecord, pm);
      expect(r2.success).toBe(true);
    });
  });
});
