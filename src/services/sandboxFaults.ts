import { PaymentRail } from '../types';

export type CardFaultMode = 'none' | 'decline' | 'timeout';
export type CryptoFaultMode = 'none' | 'revert' | 'timeout';
export type FaultScope = 'once' | 'sticky';

interface FaultRule<TMode extends string> {
  mode: TMode;
  scope: FaultScope;
  remaining: number | null;
  updatedAt: string;
}

export interface SandboxFaultSnapshot {
  card: FaultRule<CardFaultMode>;
  crypto: FaultRule<CryptoFaultMode>;
}

export class SandboxFaultService {
  private state: SandboxFaultSnapshot = {
    card: { mode: 'none', scope: 'once', remaining: 0, updatedAt: new Date().toISOString() },
    crypto: { mode: 'none', scope: 'once', remaining: 0, updatedAt: new Date().toISOString() },
  };

  getSnapshot(): SandboxFaultSnapshot {
    return JSON.parse(JSON.stringify(this.state));
  }

  setCardFault(mode: CardFaultMode, scope: FaultScope = 'once'): SandboxFaultSnapshot {
    this.state.card = this.buildRule(mode, scope);
    return this.getSnapshot();
  }

  setCryptoFault(mode: CryptoFaultMode, scope: FaultScope = 'once'): SandboxFaultSnapshot {
    this.state.crypto = this.buildRule(mode, scope);
    return this.getSnapshot();
  }

  resetAll(): SandboxFaultSnapshot {
    this.state.card = this.buildRule('none', 'once');
    this.state.crypto = this.buildRule('none', 'once');
    return this.getSnapshot();
  }

  consumeForRail(rail: PaymentRail): CardFaultMode | CryptoFaultMode | null {
    const rule = rail === 'card' ? this.state.card : this.state.crypto;
    if (rule.mode === 'none') return null;

    const activeMode = rule.mode;
    if (rule.scope === 'once') {
      const nextRemaining = Math.max(0, (rule.remaining ?? 1) - 1);
      rule.remaining = nextRemaining;
      if (nextRemaining === 0) {
        if (rail === 'card') this.state.card = this.buildRule('none', 'once');
        else this.state.crypto = this.buildRule('none', 'once');
      }
    }
    return activeMode;
  }

  private buildRule<T extends string>(mode: T, scope: FaultScope): FaultRule<T> {
    return {
      mode,
      scope,
      remaining: mode === 'none' ? 0 : scope === 'once' ? 1 : null,
      updatedAt: new Date().toISOString(),
    };
  }
}
