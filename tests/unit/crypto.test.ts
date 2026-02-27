import { describe, expect, it } from 'vitest';
import { sha256, hmacSha256Hex, randomToken, randomId, safeJsonParse } from '../../src/lib/crypto';

describe('crypto', () => {
  describe('sha256', () => {
    it('returns hex digest of input', () => {
      const out = sha256('hello');
      expect(out).toMatch(/^[a-f0-9]{64}$/);
      expect(sha256('hello')).toBe(sha256('hello'));
      expect(sha256('hello')).not.toBe(sha256('world'));
    });
  });

  describe('hmacSha256Hex', () => {
    it('returns deterministic HMAC for same secret and payload', () => {
      const out = hmacSha256Hex('secret', 'payload');
      expect(out).toMatch(/^[a-f0-9]{64}$/);
      expect(hmacSha256Hex('secret', 'payload')).toBe(hmacSha256Hex('secret', 'payload'));
    });
    it('differs for different secrets', () => {
      expect(hmacSha256Hex('secret1', 'payload')).not.toBe(hmacSha256Hex('secret2', 'payload'));
    });
    it('differs for different payloads', () => {
      expect(hmacSha256Hex('secret', 'payload1')).not.toBe(hmacSha256Hex('secret', 'payload2'));
    });
  });

  describe('randomToken', () => {
    it('returns hex string of default 32 bytes', () => {
      const out = randomToken();
      expect(out).toMatch(/^[a-f0-9]{64}$/);
    });
    it('returns hex string of custom bytes', () => {
      expect(randomToken(16)).toMatch(/^[a-f0-9]{32}$/);
      expect(randomToken(8)).toMatch(/^[a-f0-9]{16}$/);
    });
    it('produces different values each call', () => {
      const a = randomToken();
      const b = randomToken();
      expect(a).not.toBe(b);
    });
  });

  describe('randomId', () => {
    it('returns prefix + uuid without dashes', () => {
      const out = randomId('act');
      expect(out).toMatch(/^act_[a-f0-9]{32}$/);
    });
    it('produces different values each call', () => {
      const a = randomId('pm');
      const b = randomId('pm');
      expect(a).not.toBe(b);
    });
  });

  describe('safeJsonParse', () => {
    it('returns fallback for null', () => {
      expect(safeJsonParse(null, { x: 1 })).toEqual({ x: 1 });
    });
    it('returns fallback for undefined', () => {
      expect(safeJsonParse(undefined, 'default')).toBe('default');
    });
    it('returns fallback for empty string', () => {
      expect(safeJsonParse('', [])).toEqual([]);
    });
    it('parses valid JSON', () => {
      expect(safeJsonParse('{"a":1}', {})).toEqual({ a: 1 });
      expect(safeJsonParse('[1,2,3]', [])).toEqual([1, 2, 3]);
    });
    it('returns fallback for invalid JSON', () => {
      expect(safeJsonParse('{invalid}', {})).toEqual({});
      expect(safeJsonParse('not json', 'fallback')).toBe('fallback');
    });
  });
});
