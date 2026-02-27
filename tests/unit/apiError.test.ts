import { describe, expect, it } from 'vitest';
import { pickApiErrorMessage } from '../../src/mobile/apiError';

describe('apiError', () => {
  describe('pickApiErrorMessage', () => {
    it('prefers reason over message and fallback', () => {
      expect(pickApiErrorMessage({ reason: 'Magic link expired', message: 'Other' }, 'Fallback')).toBe('Magic link expired');
    });

    it('uses message when reason is absent', () => {
      expect(pickApiErrorMessage({ message: 'Bad request' }, 'Fallback')).toBe('Bad request');
    });

    it('uses fallback when data is empty', () => {
      expect(pickApiErrorMessage({}, 'Fallback')).toBe('Fallback');
    });

    it('uses fallback when data is null', () => {
      expect(pickApiErrorMessage(null, 'Fallback')).toBe('Fallback');
    });

    it('uses fallback when data is undefined', () => {
      expect(pickApiErrorMessage(undefined, 'Fallback')).toBe('Fallback');
    });

    it('handles reason as number (coerced to string)', () => {
      expect(pickApiErrorMessage({ reason: 404 }, 'Fallback')).toBe('404');
    });

    it('handles message as empty string (falsy, falls through to fallback)', () => {
      expect(pickApiErrorMessage({ reason: '', message: '' }, 'Fallback')).toBe('Fallback');
    });

    it('handles nested error-like structure', () => {
      expect(pickApiErrorMessage({ error: { message: 'Nested' } }, 'Fallback')).toBe('Fallback');
    });

    it('handles INVALID_TOKEN error code style', () => {
      expect(pickApiErrorMessage({ code: 'INVALID_TOKEN', reason: 'Token expired' }, 'Unknown')).toBe('Token expired');
    });

    it('handles API 400 response shape with message', () => {
      expect(pickApiErrorMessage({ error: 'INVALID_REQUEST', message: 'Missing field' }, 'Error')).toBe('Missing field');
    });
  });
});
