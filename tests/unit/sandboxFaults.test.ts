import { describe, expect, it } from 'vitest';
import { SandboxFaultService } from '../../src/services/sandboxFaults';

describe('SandboxFaultService', () => {
  it('getSnapshot returns initial none state', () => {
    const svc = new SandboxFaultService();
    const snap = svc.getSnapshot();
    expect(snap.card.mode).toBe('none');
    expect(snap.crypto.mode).toBe('none');
    expect(snap.card.scope).toBe('once');
    expect(snap.crypto.scope).toBe('once');
  });

  it('setCardFault updates card mode', () => {
    const svc = new SandboxFaultService();
    const snap = svc.setCardFault('decline', 'once');
    expect(snap.card.mode).toBe('decline');
    expect(snap.card.scope).toBe('once');
    expect(snap.crypto.mode).toBe('none');
  });

  it('setCryptoFault updates crypto mode', () => {
    const svc = new SandboxFaultService();
    const snap = svc.setCryptoFault('revert', 'sticky');
    expect(snap.crypto.mode).toBe('revert');
    expect(snap.crypto.scope).toBe('sticky');
    expect(snap.card.mode).toBe('none');
  });

  it('resetAll clears both rails', () => {
    const svc = new SandboxFaultService();
    svc.setCardFault('timeout', 'once');
    svc.setCryptoFault('revert', 'sticky');
    const snap = svc.resetAll();
    expect(snap.card.mode).toBe('none');
    expect(snap.crypto.mode).toBe('none');
  });

  describe('applyPreset', () => {
    it('PSP_DECLINE_DEMO sets card decline', () => {
      const svc = new SandboxFaultService();
      const snap = svc.applyPreset('PSP_DECLINE_DEMO');
      expect(snap.card.mode).toBe('decline');
      expect(snap.card.scope).toBe('once');
      expect(snap.crypto.mode).toBe('none');
    });

    it('CHAIN_REVERT_DEMO sets crypto revert', () => {
      const svc = new SandboxFaultService();
      const snap = svc.applyPreset('CHAIN_REVERT_DEMO');
      expect(snap.crypto.mode).toBe('revert');
      expect(snap.crypto.scope).toBe('once');
      expect(snap.card.mode).toBe('none');
    });

    it('TIMEOUT_DEMO sets both card and crypto timeout', () => {
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
      expect(svc.consumeForRail('crypto')).toBeNull();
    });

    it('returns fault mode for once scope and resets after consume', () => {
      const svc = new SandboxFaultService();
      svc.setCardFault('decline', 'once');
      expect(svc.consumeForRail('card')).toBe('decline');
      expect(svc.consumeForRail('card')).toBeNull();
      expect(svc.getSnapshot().card.mode).toBe('none');
    });

    it('sticky scope persists across consumes', () => {
      const svc = new SandboxFaultService();
      svc.setCardFault('timeout', 'sticky');
      expect(svc.consumeForRail('card')).toBe('timeout');
      expect(svc.consumeForRail('card')).toBe('timeout');
      expect(svc.getSnapshot().card.mode).toBe('timeout');
    });
  });
});
