import { describe, expect, it } from 'vitest';
import { ExecutionEngine } from '../../src/services/execution';
import { SandboxFaultService } from '../../src/services/sandboxFaults';
import type { ActionRecord, PaymentMethodRecord } from '../../src/types';


function makeAction(overrides: Partial<ActionRecord> = {}): ActionRecord {
  return {
    id: 'act_test',
    agent_id: 'agt_demo',
    end_user_id: 'usr_demo',
    team_id: null,
    requested_by_user_id: null,
    approval_target_user_id: null,
    approval_policy: null,
    idempotency_key: 'test',
    action_type: 'payment',
    status: 'executing',
    status_reason: null,
    amount: '10.00',
    currency: 'USD',
    recipient_name: 'Test',
    description: 'Test payment',
    payment_rail: 'card',
    payment_method_preference: 'card_default',
    recipient_reference: 'merchant_api:test',
    callback_url: '',
    expires_at: new Date().toISOString(),
    metadata_json: '{}',
    approved_at: null,
    denied_at: null,
    terminal_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

function makePaymentMethod(rail: 'card' | 'crypto', overrides: Partial<PaymentMethodRecord> = {}): PaymentMethodRecord {
  return {
    id: 'pm_test',
    end_user_id: 'usr_demo',
    rail,
    alias: 'Test',
    external_token: 'tok_xxx',
    metadata_json: '{}',
    is_default: 1,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

describe('execution', () => {
  describe('ExecutionEngine (mock, no Stripe)', () => {
    const engine = new ExecutionEngine(undefined, null);

    it('returns rail mismatch for card action with crypto method', async () => {
      const result = await engine.execute(makeAction({ payment_rail: 'card' }), makePaymentMethod('crypto'));
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('INVALID_PAYMENT_METHOD');
      expect(result.errorMessage).toContain('mismatch');
    });

    it('returns rail mismatch for crypto action with card method', async () => {
      const result = await engine.execute(makeAction({ payment_rail: 'crypto' }), makePaymentMethod('card'));
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('INVALID_PAYMENT_METHOD');
    });

    it('succeeds for card with merchant_api recipient', async () => {
      const result = await engine.execute(
        makeAction({ recipient_reference: 'merchant_api:ok' }),
        makePaymentMethod('card')
      );
      expect(result.success).toBe(true);
      expect(result.provider).toBe('mock_psp');
      expect(result.paymentId).toMatch(/^pay_/);
    });

    it('declines for recipient_reference containing fail', async () => {
      const result = await engine.execute(
        makeAction({ recipient_reference: 'merchant_api:fail_test' }),
        makePaymentMethod('card')
      );
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('PSP_DECLINED');
    });

    it('declines for description containing decline', async () => {
      const result = await engine.execute(
        makeAction({ description: 'This will decline', recipient_reference: 'merchant_api:ok' }),
        makePaymentMethod('card')
      );
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('PSP_DECLINED');
    });

    it('returns UNSUPPORTED_RECIPIENT for invalid card recipient', async () => {
      const result = await engine.execute(
        makeAction({ recipient_reference: 'invalid:ref' }),
        makePaymentMethod('card')
      );
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('UNSUPPORTED_RECIPIENT');
    });

    it('returns PSP_REQUIRES_ACTION for 3ds_required recipient', async () => {
      const result = await engine.execute(
        makeAction({ recipient_reference: 'merchant_api:3ds_required_checkout' }),
        makePaymentMethod('card')
      );
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('PSP_REQUIRES_ACTION');
    });

    it('succeeds for payment_link recipient', async () => {
      const result = await engine.execute(
        makeAction({ recipient_reference: 'payment_link:pl_abc123' }),
        makePaymentMethod('card')
      );
      expect(result.success).toBe(true);
    });

    it('fails for crypto with wallet: recipient containing insufficient', async () => {
      const result = await engine.execute(
        makeAction({
          payment_rail: 'crypto',
          currency: 'USDC',
          recipient_reference: 'wallet:insufficient_funds',
          amount: '10',
        }),
        makePaymentMethod('crypto')
      );
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('INSUFFICIENT_FUNDS');
    });

    it('fails for crypto with invalid recipient', async () => {
      const result = await engine.execute(
        makeAction({
          payment_rail: 'crypto',
          currency: 'USDC',
          recipient_reference: 'invalid:ref',
          amount: '10',
        }),
        makePaymentMethod('crypto')
      );
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('UNSUPPORTED_RECIPIENT');
    });

    it('throws for invalid amount', async () => {
      await expect(
        engine.execute(makeAction({ amount: 'invalid' }), makePaymentMethod('card'))
      ).rejects.toThrow(/Invalid amount/);
    });

    it('succeeds for crypto with address:0x recipient', async () => {
      const result = await engine.execute(
        makeAction({
          payment_rail: 'crypto',
          currency: 'USDC',
          recipient_reference: 'address:0x1234567890abcdef',
          amount: '100',
        }),
        makePaymentMethod('crypto')
      );
      expect(result.success).toBe(true);
      expect(result.provider).toBe('mock_mpc');
      expect(result.txHash).toMatch(/^0x/);
    });

    it('fails for crypto with insufficient funds', async () => {
      const result = await engine.execute(
        makeAction({
          payment_rail: 'crypto',
          currency: 'USDC',
          recipient_reference: 'address:0x1234567890abcdef',
          amount: '10000',
        }),
        makePaymentMethod('crypto')
      );
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('INSUFFICIENT_FUNDS');
    });

    it('fails for crypto with revert in description', async () => {
      const result = await engine.execute(
        makeAction({
          payment_rail: 'crypto',
          currency: 'USDC',
          recipient_reference: 'address:0x1234567890abcdef',
          amount: '10',
          description: 'This will revert',
        }),
        makePaymentMethod('crypto')
      );
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('CHAIN_REVERTED');
    });
  });

  describe('ExecutionEngine with SandboxFaultService', () => {
    it('injects card decline fault', async () => {
      const sandbox = new SandboxFaultService();
      sandbox.setCardFault('decline', 'once');
      const engine = new ExecutionEngine(sandbox, null);
      const result = await engine.execute(
        makeAction({ recipient_reference: 'merchant_api:ok' }),
        makePaymentMethod('card')
      );
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('PSP_DECLINED');
      expect(result.raw?.sandbox_injected_fault).toBe('card_decline');
    });

    it('injects card timeout fault', async () => {
      const sandbox = new SandboxFaultService();
      sandbox.setCardFault('timeout', 'once');
      const engine = new ExecutionEngine(sandbox, null);
      const result = await engine.execute(
        makeAction({ recipient_reference: 'merchant_api:ok' }),
        makePaymentMethod('card')
      );
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('TIMEOUT');
    });

    it('injects crypto revert fault', async () => {
      const sandbox = new SandboxFaultService();
      sandbox.setCryptoFault('revert', 'once');
      const engine = new ExecutionEngine(sandbox, null);
      const result = await engine.execute(
        makeAction({
          payment_rail: 'crypto',
          currency: 'USDC',
          recipient_reference: 'address:0x1234567890abcdef',
          amount: '10',
        }),
        makePaymentMethod('crypto')
      );
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('CHAIN_REVERTED');
      expect(result.raw?.sandbox_injected_fault).toBe('crypto_revert');
    });

    it('injects crypto timeout fault', async () => {
      const sandbox = new SandboxFaultService();
      sandbox.setCryptoFault('timeout', 'once');
      const engine = new ExecutionEngine(sandbox, null);
      const result = await engine.execute(
        makeAction({
          payment_rail: 'crypto',
          currency: 'USDC',
          recipient_reference: 'address:0x1234567890abcdef',
          amount: '10',
        }),
        makePaymentMethod('crypto')
      );
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('TIMEOUT');
    });

    it('succeeds after once fault is consumed', async () => {
      const sandbox = new SandboxFaultService();
      sandbox.setCardFault('decline', 'once');
      const engine = new ExecutionEngine(sandbox, null);
      const first = await engine.execute(
        makeAction({ recipient_reference: 'merchant_api:ok' }),
        makePaymentMethod('card')
      );
      expect(first.success).toBe(false);
      const second = await engine.execute(
        makeAction({ recipient_reference: 'merchant_api:ok', id: 'act_2' }),
        makePaymentMethod('card')
      );
      expect(second.success).toBe(true);
    });
  });

  describe('ExecutionEngine isStripeEnabled', () => {
    it('returns false when no Stripe key', () => {
      const engine = new ExecutionEngine(undefined, null);
      expect(engine.isStripeEnabled).toBe(false);
    });
  });
});
