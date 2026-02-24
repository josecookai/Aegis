import { describe, expect, it } from 'vitest';
import { pickApiErrorMessage } from '../../src/mobile/apiError';

describe('apiError', () => {
  describe('pickApiErrorMessage', () => {
    it('prefers reason over message', () => {
      expect(pickApiErrorMessage({ reason: 'R', message: 'M' }, 'F')).toBe('R');
    });
    it('uses message when reason absent', () => {
      expect(pickApiErrorMessage({ message: 'M' }, 'F')).toBe('M');
    });
    it('returns fallback when both absent', () => {
      expect(pickApiErrorMessage({}, 'Fallback')).toBe('Fallback');
    });
    it('returns fallback for null data', () => {
      expect(pickApiErrorMessage(null, 'F')).toBe('F');
    });
    it('returns fallback for undefined data', () => {
      expect(pickApiErrorMessage(undefined, 'F')).toBe('F');
    });
    it('handles nested error structures', () => {
      expect(pickApiErrorMessage({ error: { reason: 'Nested' } }, 'F')).toBe('F');
    });
  });
});
