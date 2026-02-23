import Stripe from 'stripe';
import { randomId, safeJsonParse } from '../lib/crypto';
import { SandboxFaultService } from './sandboxFaults';
import { ActionRecord, ExecutionResult, PaymentMethodRecord } from '../types';

function parseAmount(value: string): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`Invalid amount: ${value}`);
  }
  return n;
}

const CURRENCY_ZERO_DECIMAL = new Set(['JPY', 'KRW', 'VND', 'BIF', 'CLP', 'DJF', 'GNF', 'KMF', 'MGA', 'PYG', 'RWF', 'UGX', 'XAF', 'XOF', 'XPF']);

function toStripeAmount(amount: string, currency: string): number {
  const n = parseAmount(amount);
  if (CURRENCY_ZERO_DECIMAL.has(currency.toUpperCase())) {
    return Math.round(n);
  }
  return Math.round(n * 100);
}

export class ExecutionEngine {
  private stripe: Stripe | null = null;

  constructor(
    private readonly sandboxFaults?: SandboxFaultService,
    stripeSecretKey?: string | null,
  ) {
    if (stripeSecretKey) {
      this.stripe = new Stripe(stripeSecretKey, { apiVersion: '2025-01-27.acacia' as any });
    }
  }

  get isStripeEnabled(): boolean {
    return this.stripe !== null;
  }

  async execute(action: ActionRecord, paymentMethod: PaymentMethodRecord): Promise<ExecutionResult> {
    if (action.payment_rail !== paymentMethod.rail) {
      return {
        success: false,
        rail: action.payment_rail,
        provider: 'aegis_mismatch_guard',
        errorCode: 'INVALID_PAYMENT_METHOD',
        errorMessage: 'Payment method rail mismatch',
      };
    }

    if (action.payment_rail === 'card') {
      return this.executeCard(action, paymentMethod);
    }
    return this.executeCrypto(action, paymentMethod);
  }

  private async executeCard(action: ActionRecord, paymentMethod: PaymentMethodRecord): Promise<ExecutionResult> {
    const injected = this.sandboxFaults?.consumeForRail('card');
    if (injected === 'decline') {
      return {
        success: false, rail: 'card', provider: this.stripe ? 'stripe' : 'mock_psp',
        errorCode: 'PSP_DECLINED', errorMessage: 'Sandbox injected PSP decline',
        raw: { sandbox_injected_fault: 'card_decline' },
      };
    }
    if (injected === 'timeout') {
      return {
        success: false, rail: 'card', provider: this.stripe ? 'stripe' : 'mock_psp',
        errorCode: 'TIMEOUT', errorMessage: 'Sandbox injected card timeout',
        raw: { sandbox_injected_fault: 'card_timeout' },
      };
    }

    if (this.stripe) {
      return this.executeCardStripe(action, paymentMethod);
    }
    return this.executeCardMock(action, paymentMethod);
  }

  // ─── Stripe real card payment ───────────────────────────────────────
  private async executeCardStripe(action: ActionRecord, paymentMethod: PaymentMethodRecord): Promise<ExecutionResult> {
    const meta = safeJsonParse<Record<string, unknown>>(paymentMethod.metadata_json, {});
    const customerId = meta.stripe_customer_id as string | undefined;
    const paymentMethodId = paymentMethod.external_token;

    if (!customerId || !paymentMethodId.startsWith('pm_')) {
      return {
        success: false, rail: 'card', provider: 'stripe',
        errorCode: 'INVALID_PAYMENT_METHOD',
        errorMessage: `Payment method not linked to Stripe (token=${maskToken(paymentMethodId)}, customer=${customerId ?? 'none'})`,
      };
    }

    try {
      const intent = await this.stripe!.paymentIntents.create({
        amount: toStripeAmount(action.amount, action.currency),
        currency: action.currency.toLowerCase(),
        customer: customerId,
        payment_method: paymentMethodId,
        confirm: true,
        off_session: true,
        description: `Aegis: ${action.description}`.slice(0, 500),
        metadata: {
          aegis_action_id: action.id,
          recipient: action.recipient_name,
        },
      });

      if (intent.status === 'succeeded') {
        return {
          success: true,
          rail: 'card',
          provider: 'stripe',
          providerReference: intent.id,
          paymentId: intent.id,
          raw: {
            stripe_status: intent.status,
            stripe_amount: intent.amount,
            stripe_currency: intent.currency,
          },
        };
      }

      return {
        success: false, rail: 'card', provider: 'stripe',
        errorCode: intent.status === 'requires_action' ? 'PSP_REQUIRES_ACTION' : 'PSP_INCOMPLETE',
        errorMessage: `Stripe PaymentIntent status: ${intent.status}`,
        raw: { stripe_status: intent.status, stripe_pi: intent.id },
      };
    } catch (err) {
      const stripeErr = err as Stripe.errors.StripeError;
      return {
        success: false, rail: 'card', provider: 'stripe',
        errorCode: stripeErr.code === 'card_declined'
          ? 'PSP_DECLINED'
          : stripeErr.code === 'authentication_required'
            ? 'PSP_REQUIRES_ACTION'
            : 'PSP_ERROR',
        errorMessage: stripeErr.message ?? 'Stripe error',
        raw: { stripe_code: stripeErr.code, stripe_type: stripeErr.type },
      };
    }
  }

  // ─── Mock card payment (no Stripe key) ──────────────────────────────
  private async executeCardMock(action: ActionRecord, paymentMethod: PaymentMethodRecord): Promise<ExecutionResult> {
    parseAmount(action.amount);
    const ref = action.recipient_reference;
    if (!(ref.startsWith('merchant_api:') || ref.startsWith('payment_link:'))) {
      return {
        success: false, rail: 'card', provider: 'mock_psp',
        errorCode: 'UNSUPPORTED_RECIPIENT',
        errorMessage: 'Card rail supports merchant_api:* or payment_link:* recipient_reference in MVP',
      };
    }
    if (ref.includes('3ds_required')) {
      return {
        success: false, rail: 'card', provider: 'mock_psp',
        errorCode: 'PSP_REQUIRES_ACTION',
        errorMessage: '3DS step-up required (not implemented in MVP prototype)',
      };
    }
    if (ref.includes('fail') || action.description.toLowerCase().includes('decline')) {
      return {
        success: false, rail: 'card', provider: 'mock_psp',
        errorCode: 'PSP_DECLINED', errorMessage: 'Mock PSP declined the payment',
      };
    }

    await delay(150);
    return {
      success: true, rail: 'card', provider: 'mock_psp',
      providerReference: `ch_${randomId('mock').slice(-18)}`,
      paymentId: `pay_${randomId('mock').slice(-18)}`,
      raw: {
        payment_method_token: maskToken(paymentMethod.external_token),
        mvp_mode: 'supported_recipient_only',
      },
    };
  }

  // ─── Crypto (unchanged — still mock) ────────────────────────────────
  private async executeCrypto(action: ActionRecord, paymentMethod: PaymentMethodRecord): Promise<ExecutionResult> {
    const injected = this.sandboxFaults?.consumeForRail('crypto');
    if (injected === 'revert') {
      return {
        success: false, rail: 'crypto', provider: 'mock_mpc',
        errorCode: 'CHAIN_REVERTED', errorMessage: 'Sandbox injected chain revert',
        raw: { sandbox_injected_fault: 'crypto_revert' },
      };
    }
    if (injected === 'timeout') {
      return {
        success: false, rail: 'crypto', provider: 'mock_mpc',
        errorCode: 'TIMEOUT', errorMessage: 'Sandbox injected crypto timeout',
        raw: { sandbox_injected_fault: 'crypto_timeout' },
      };
    }

    const amount = parseAmount(action.amount);
    const ref = action.recipient_reference;
    if (!(ref.startsWith('address:0x') || ref.startsWith('wallet:'))) {
      return {
        success: false, rail: 'crypto', provider: 'mock_mpc',
        errorCode: 'UNSUPPORTED_RECIPIENT',
        errorMessage: 'Crypto rail supports address:0x... or wallet:* recipient_reference in MVP',
      };
    }
    if (amount > 5000 || ref.includes('insufficient')) {
      return {
        success: false, rail: 'crypto', provider: 'mock_mpc',
        errorCode: 'INSUFFICIENT_FUNDS', errorMessage: 'Mock wallet balance insufficient',
      };
    }
    if (ref.includes('revert') || action.description.toLowerCase().includes('revert')) {
      return {
        success: false, rail: 'crypto', provider: 'mock_mpc',
        errorCode: 'CHAIN_REVERTED', errorMessage: 'Mock chain reverted transaction',
      };
    }

    await delay(200);
    return {
      success: true, rail: 'crypto', provider: 'mock_mpc',
      providerReference: `txreq_${randomId('mock').slice(-18)}`,
      txHash: `0x${randomId('hash').replace(/^hash_/, '').slice(0, 64).padEnd(64, '0')}`,
      raw: {
        custody: 'mock_mpc',
        payment_method_token: maskToken(paymentMethod.external_token),
      },
    };
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function maskToken(token: string): string {
  if (token.length <= 8) return '***';
  return `${token.slice(0, 4)}...${token.slice(-4)}`;
}
