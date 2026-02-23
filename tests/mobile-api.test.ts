import { describe, expect, it } from 'vitest';
import { pickApiErrorMessage } from '../src/mobile/apiError';
import { determineApproveDecisionSource } from '../src/mobile/approvalDecision';

describe('mobile API helper and approval decision logic', () => {
  it('preserves invalid token reason from app approval API payload', async () => {
    expect(pickApiErrorMessage({ valid: false, reason: 'Magic link expired' }, 'Fallback')).toBe('Magic link expired');
    expect(pickApiErrorMessage({ message: 'Bad request' }, 'Fallback')).toBe('Bad request');
    expect(pickApiErrorMessage({}, 'Fallback')).toBe('Fallback');
  });

  it('requires biometric support and success before approving as app_biometric', () => {
    expect(determineApproveDecisionSource({ hasHardware: false, supportedCount: 0, authSuccess: false })).toEqual(
      expect.objectContaining({ proceed: false })
    );
    expect(determineApproveDecisionSource({ hasHardware: true, supportedCount: 1, authSuccess: false })).toEqual(
      expect.objectContaining({ proceed: false })
    );
    expect(determineApproveDecisionSource({ hasHardware: true, supportedCount: 1, authSuccess: true })).toEqual({
      proceed: true,
      source: 'app_biometric',
    });
  });
});
