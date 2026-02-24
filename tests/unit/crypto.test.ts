import { describe, expect, it } from 'vitest';
import { sha256, hmacSha256Hex, randomToken, randomId, safeJsonParse } from '../../src/lib/crypto';

describe('crypto', () => {
  describe('sha256', () => {
    it('returns hex digest of input', () => {
      const result = sha256('hello');
      expect(result).toMatch(/^[a-f0-9]{64}$/);
      expect(sha256('hello')).toBe(sha256('hello'));
    });
    it('produces different hashes for different inputs', () => {
      expect(sha256('a')).not.toBe(sha256('b'));
    });
  });

  describe('hmacSha256Hex', () => {
    it('returns deterministic hex for same secret and payload', () => {
      const r = hmacSha256Hex('secret', 'payload');
      expect(r).toMatch(/^[a-f0-9]{64}$/);
      expect(hmacSha256Hex('secret', 'payload')).toBe(r);
    });
    it('produces different output for different secrets', () => {
      expect(hmacSha256Hex('a', 'x')).not.toBe(hmacSha256Hex('b', 'x'));
    });
    it('produces different output for different payloads', () => {
      expect(hmacSha256Hex('s', 'a')).not.toBe(hmacSha256Hex('s', 'b'));
    });
  });

  describe('randomToken', () => {
    it('returns hex string of default length', () => {
      const r = randomToken();
      expect(r).toMatch(/^[a-f0-9]+$/);
      expect(r.length).toBe(64);
    });
    it('returns different values on each call', () => {
      const a = randomToken();
      const b = randomToken();
      expect(a).not.toBe(b);
    });
    it('respects bytes parameter', () => {
      const r = randomToken(8);
      expect(r.length).toBe(16);
    });
  });

  describe('randomId', () => {
    it('returns string with prefix', () => {
      const r = randomId('act');
      expect(r).toMatch(/^act_[a-f0-9]+$/);
      expect(r.replace('act_', '')).not.toContain('-');
    });
    it('returns different values on each call', () => {
      expect(randomId('x')).not.toBe(randomId('x'));
    });
  });

  describe('safeJsonParse', () => {
    it('parses valid JSON', () => {
      expect(safeJsonParse('{"a":1}', {})).toEqual({ a: 1 });
    });
    it('returns fallback for null', () => {
      expect(safeJsonParse(null, { x: 1 })).toEqual({ x: 1 });
    });
    it('returns fallback for undefined', () => {
      expect(safeJsonParse(undefined, [])).toEqual([]);
    });
    it('returns fallback for empty string', () => {
      expect(safeJsonParse('', 0)).toBe(0);
    });
    it('returns fallback for invalid JSON', () => {
      expect(safeJsonParse('{invalid}', 'fallback')).toBe('fallback');
    });
  });
});
