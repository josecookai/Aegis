import { randomId } from '../lib/crypto';
import { ActionRecord, ExecutionResult, PaymentMethodRecord } from '../types';

function parseAmount(value: string): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`Invalid amount: ${value}`);
  }
  return n;
}

export class ExecutionEngine {
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
    parseAmount(action.amount);
    const ref = action.recipient_reference;
    if (!(ref.startsWith('merchant_api:') || ref.startsWith('payment_link:'))) {
      return {
        success: false,
        rail: 'card',
        provider: 'mock_psp',
        errorCode: 'UNSUPPORTED_RECIPIENT',
        errorMessage: 'Card rail supports merchant_api:* or payment_link:* recipient_reference in MVP',
      };
    }

    if (ref.includes('3ds_required')) {
      return {
        success: false,
        rail: 'card',
        provider: 'mock_psp',
        errorCode: 'PSP_REQUIRES_ACTION',
        errorMessage: '3DS step-up required (not implemented in MVP prototype)',
      };
    }

    if (ref.includes('fail') || action.description.toLowerCase().includes('decline')) {
      return {
        success: false,
        rail: 'card',
        provider: 'mock_psp',
        errorCode: 'PSP_DECLINED',
        errorMessage: 'Mock PSP declined the payment',
      };
    }

    await delay(150);

    return {
      success: true,
      rail: 'card',
      provider: 'mock_psp',
      providerReference: `ch_${randomId('mock').slice(-18)}`,
      paymentId: `pay_${randomId('mock').slice(-18)}`,
      raw: {
        payment_method_token: maskToken(paymentMethod.external_token),
        mvp_mode: 'supported_recipient_only',
      },
    };
  }

  private async executeCrypto(action: ActionRecord, paymentMethod: PaymentMethodRecord): Promise<ExecutionResult> {
    const amount = parseAmount(action.amount);
    const ref = action.recipient_reference;
    if (!(ref.startsWith('address:0x') || ref.startsWith('wallet:'))) {
      return {
        success: false,
        rail: 'crypto',
        provider: 'mock_mpc',
        errorCode: 'UNSUPPORTED_RECIPIENT',
        errorMessage: 'Crypto rail supports address:0x... or wallet:* recipient_reference in MVP',
      };
    }

    if (amount > 5000 || ref.includes('insufficient')) {
      return {
        success: false,
        rail: 'crypto',
        provider: 'mock_mpc',
        errorCode: 'INSUFFICIENT_FUNDS',
        errorMessage: 'Mock wallet balance insufficient',
      };
    }

    if (ref.includes('revert') || action.description.toLowerCase().includes('revert')) {
      return {
        success: false,
        rail: 'crypto',
        provider: 'mock_mpc',
        errorCode: 'CHAIN_REVERTED',
        errorMessage: 'Mock chain reverted transaction',
      };
    }

    await delay(200);

    return {
      success: true,
      rail: 'crypto',
      provider: 'mock_mpc',
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
