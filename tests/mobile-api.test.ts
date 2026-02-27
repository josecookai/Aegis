import { describe, expect, it } from 'vitest';
import { pickApiErrorMessage } from '../src/mobile/apiError';
import { determineApproveDecisionSource, determineDenyDecisionSource } from '../src/mobile/approvalDecision';

describe('mobile API helper and approval decision logic', () => {
  describe('pickApiErrorMessage', () => {
    it('preserves invalid token reason from app approval API payload', () => {
      expect(pickApiErrorMessage({ valid: false, reason: 'Magic link expired' }, 'Fallback')).toBe('Magic link expired');
      expect(pickApiErrorMessage({ message: 'Bad request' }, 'Fallback')).toBe('Bad request');
      expect(pickApiErrorMessage({}, 'Fallback')).toBe('Fallback');
    });

    it('handles more error code shapes', () => {
      expect(pickApiErrorMessage({ code: 'INVALID_TOKEN', reason: 'Token expired' }, 'Unknown')).toBe('Token expired');
      expect(pickApiErrorMessage({ error: 'UNAUTHORIZED', message: 'Invalid API key' }, 'Error')).toBe('Invalid API key');
    });

    it('handles null and undefined data', () => {
      expect(pickApiErrorMessage(null, 'Fallback')).toBe('Fallback');
      expect(pickApiErrorMessage(undefined, 'Fallback')).toBe('Fallback');
    });
  });

  describe('determineApproveDecisionSource', () => {
    it('requires biometric support and success before approving as app_biometric', () => {
      expect(determineApproveDecisionSource({ hasHardware: false, supportedCount: 0, authSuccess: false })).toEqual(
        expect.objectContaining({ proceed: false, reason: 'Biometric authentication is unavailable on this device' }),
      );
      expect(determineApproveDecisionSource({ hasHardware: true, supportedCount: 1, authSuccess: false })).toEqual(
        expect.objectContaining({ proceed: false, reason: 'Biometric authentication was canceled or failed' }),
      );
      expect(determineApproveDecisionSource({ hasHardware: true, supportedCount: 1, authSuccess: true })).toEqual({
        proceed: true,
        source: 'app_biometric',
      });
    });

    it('returns proceed:false when supportedCount is 0 despite hasHardware', () => {
      const result = determineApproveDecisionSource({ hasHardware: true, supportedCount: 0, authSuccess: true });
      expect(result.proceed).toBe(false);
      expect(result.reason).toContain('unavailable');
    });

    it('returns proceed:false when authSuccess is undefined', () => {
      const result = determineApproveDecisionSource({ hasHardware: true, supportedCount: 1 });
      expect(result.proceed).toBe(false);
      expect(result.reason).toContain('canceled or failed');
    });
  });

  describe('determineDenyDecisionSource', () => {
    it('uses a non-biometric decision source for deny actions', () => {
      expect(determineDenyDecisionSource()).toBe('web_magic_link');
    });
  });
});
