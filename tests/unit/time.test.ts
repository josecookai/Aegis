import { describe, expect, it } from 'vitest';
import { nowIso, addMinutesIso, isPast, unixTsSeconds } from '../../src/lib/time';

describe('time', () => {
  describe('nowIso', () => {
    it('returns ISO 8601 string', () => {
      const out = nowIso();
      expect(out).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      expect(() => new Date(out)).not.toThrow();
    });
  });

  describe('addMinutesIso', () => {
    it('adds minutes to base ISO string', () => {
      const base = '2026-02-23T10:00:00.000Z';
      expect(addMinutesIso(base, 15)).toBe('2026-02-23T10:15:00.000Z');
      expect(addMinutesIso(base, 60)).toBe('2026-02-23T11:00:00.000Z');
      expect(addMinutesIso(base, -30)).toBe('2026-02-23T09:30:00.000Z');
    });
  });

  describe('isPast', () => {
    it('returns true when iso is in the past', () => {
      const past = new Date(Date.now() - 60000).toISOString();
      expect(isPast(past)).toBe(true);
    });
    it('returns false when iso is in the future', () => {
      const future = new Date(Date.now() + 60000).toISOString();
      expect(isPast(future)).toBe(false);
    });
    it('returns true when iso equals ref', () => {
      const now = new Date().toISOString();
      expect(isPast(now, new Date(now))).toBe(true);
    });
  });

  describe('unixTsSeconds', () => {
    it('returns seconds since epoch', () => {
      const d = new Date('1970-01-01T00:00:00.000Z');
      expect(unixTsSeconds(d)).toBe(0);
    });
    it('uses current date when no arg', () => {
      const out = unixTsSeconds();
      expect(out).toBeGreaterThan(1700000000);
      expect(out).toBeLessThan(2000000000);
    });
  });
});
