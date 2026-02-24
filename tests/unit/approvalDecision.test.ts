import { describe, expect, it } from 'vitest';
import { determineApproveDecisionSource, determineDenyDecisionSource } from '../../src/mobile/approvalDecision';

describe('approvalDecision', () => {
  describe('determineApproveDecisionSource', () => {
    it('returns proceed false when no hardware', () => {
      const r = determineApproveDecisionSource({ hasHardware: false, supportedCount: 1, authSuccess: true });
      expect(r.proceed).toBe(false);
      expect(r.reason).toContain('unavailable');
    });
    it('returns proceed false when supportedCount is 0', () => {
      const r = determineApproveDecisionSource({ hasHardware: true, supportedCount: 0, authSuccess: true });
      expect(r.proceed).toBe(false);
    });
    it('returns proceed false when authSuccess is false', () => {
      const r = determineApproveDecisionSource({ hasHardware: true, supportedCount: 1, authSuccess: false });
      expect(r.proceed).toBe(false);
      expect(r.reason).toContain('canceled or failed');
    });
    it('returns proceed false when authSuccess is undefined', () => {
      const r = determineApproveDecisionSource({ hasHardware: true, supportedCount: 1 });
      expect(r.proceed).toBe(false);
    });
    it('returns proceed true with app_biometric when all conditions met', () => {
      const r = determineApproveDecisionSource({ hasHardware: true, supportedCount: 1, authSuccess: true });
      expect(r.proceed).toBe(true);
      expect(r.source).toBe('app_biometric');
    });
  });

  describe('determineDenyDecisionSource', () => {
    it('returns web_magic_link', () => {
      expect(determineDenyDecisionSource()).toBe('web_magic_link');
    });
  });
});
