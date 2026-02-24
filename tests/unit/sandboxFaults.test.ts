import { describe, expect, it } from 'vitest';
import { SandboxFaultService } from '../../src/services/sandboxFaults';

describe('sandboxFaults', () => {
  describe('getSnapshot', () => {
    it('returns initial state', () => {
      const svc = new SandboxFaultService();
      const snap = svc.getSnapshot();
      expect(snap.card.mode).toBe('none');
      expect(snap.crypto.mode).toBe('none');
    });
  });

  describe('setCardFault', () => {
    it('sets card fault mode', () => {
      const svc = new SandboxFaultService();
      const snap = svc.setCardFault('decline');
      expect(snap.card.mode).toBe('decline');
    });
  });

  describe('setCryptoFault', () => {
    it('sets crypto fault mode', () => {
      const svc = new SandboxFaultService();
      const snap = svc.setCryptoFault('revert');
      expect(snap.crypto.mode).toBe('revert');
    });
  });

  describe('resetAll', () => {
    it('resets both modes to none', () => {
      const svc = new SandboxFaultService();
      svc.setCardFault('decline');
      svc.setCryptoFault('revert');
      const snap = svc.resetAll();
      expect(snap.card.mode).toBe('none');
      expect(snap.crypto.mode).toBe('none');
    });
  });

  describe('applyPreset', () => {
    it('PSP_DECLINE_DEMO sets card decline', () => {
      const svc = new SandboxFaultService();
      const snap = svc.applyPreset('PSP_DECLINE_DEMO');
      expect(snap.card.mode).toBe('decline');
    });
    it('CHAIN_REVERT_DEMO sets crypto revert', () => {
      const svc = new SandboxFaultService();
      const snap = svc.applyPreset('CHAIN_REVERT_DEMO');
      expect(snap.crypto.mode).toBe('revert');
    });
    it('TIMEOUT_DEMO sets both timeout', () => {
      const svc = new SandboxFaultService();
      const snap = svc.applyPreset('TIMEOUT_DEMO');
      expect(snap.card.mode).toBe('timeout');
      expect(snap.crypto.mode).toBe('timeout');
    });
  });

  describe('consumeForRail', () => {
    it('returns null when mode is none', () => {
      const svc = new SandboxFaultService();
      expect(svc.consumeForRail('card')).toBeNull();
    });
    it('returns decline when card fault is decline', () => {
      const svc = new SandboxFaultService();
      svc.setCardFault('decline');
      expect(svc.consumeForRail('card')).toBe('decline');
    });
    it('consumes once for scope once', () => {
      const svc = new SandboxFaultService();
      svc.setCardFault('decline', 'once');
      expect(svc.consumeForRail('card')).toBe('decline');
      expect(svc.consumeForRail('card')).toBeNull();
    });
  });
});
