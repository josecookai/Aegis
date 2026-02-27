import { describe, expect, it } from 'vitest';
import { determineApproveDecisionSource, determineDenyDecisionSource } from '../../src/mobile/approvalDecision';

describe('approvalDecision', () => {
  describe('determineApproveDecisionSource', () => {
    it('returns proceed:false when hasHardware is false', () => {
      const result = determineApproveDecisionSource({
        hasHardware: false,
        supportedCount: 1,
        authSuccess: true,
      });
      expect(result).toEqual({
        proceed: false,
        reason: 'Biometric authentication is unavailable on this device',
      });
    });

    it('returns proceed:false when supportedCount is 0', () => {
      const result = determineApproveDecisionSource({
        hasHardware: true,
        supportedCount: 0,
        authSuccess: true,
      });
      expect(result).toEqual({
        proceed: false,
        reason: 'Biometric authentication is unavailable on this device',
      });
    });

    it('returns proceed:false when supportedCount is negative', () => {
      const result = determineApproveDecisionSource({
        hasHardware: true,
        supportedCount: -1,
        authSuccess: true,
      });
      expect(result).toEqual({
        proceed: false,
        reason: 'Biometric authentication is unavailable on this device',
      });
    });

    it('returns proceed:false when authSuccess is false', () => {
      const result = determineApproveDecisionSource({
        hasHardware: true,
        supportedCount: 1,
        authSuccess: false,
      });
      expect(result).toEqual({
        proceed: false,
        reason: 'Biometric authentication was canceled or failed',
      });
    });

    it('returns proceed:false when authSuccess is undefined (falsy)', () => {
      const result = determineApproveDecisionSource({
        hasHardware: true,
        supportedCount: 1,
      });
      expect(result).toEqual({
        proceed: false,
        reason: 'Biometric authentication was canceled or failed',
      });
    });

    it('returns proceed:true with app_biometric when all conditions pass', () => {
      const result = determineApproveDecisionSource({
        hasHardware: true,
        supportedCount: 1,
        authSuccess: true,
      });
      expect(result).toEqual({
        proceed: true,
        source: 'app_biometric',
      });
    });

    it('returns proceed:true with multiple supported types', () => {
      const result = determineApproveDecisionSource({
        hasHardware: true,
        supportedCount: 2,
        authSuccess: true,
      });
      expect(result).toEqual({
        proceed: true,
        source: 'app_biometric',
      });
    });
  });

  describe('determineDenyDecisionSource', () => {
    it('always returns web_magic_link', () => {
      expect(determineDenyDecisionSource()).toBe('web_magic_link');
    });
  });
});
