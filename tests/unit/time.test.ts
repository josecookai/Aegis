import { describe, expect, it } from 'vitest';
import { nowIso, addMinutesIso, isPast, unixTsSeconds } from '../../src/lib/time';

describe('time', () => {
  describe('nowIso', () => {
    it('returns ISO 8601 string', () => {
      const r = nowIso();
      expect(r).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      expect(() => new Date(r)).not.toThrow();
    });
  });

  describe('addMinutesIso', () => {
    it('adds minutes to base ISO string', () => {
      const base = '2026-02-23T12:00:00.000Z';
      const r = addMinutesIso(base, 30);
      expect(r).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      const d = new Date(r);
      expect(d.getTime()).toBe(new Date(base).getTime() + 30 * 60 * 1000);
    });
    it('handles negative minutes', () => {
      const base = '2026-02-23T12:00:00.000Z';
      const r = addMinutesIso(base, -60);
      expect(new Date(r).getTime()).toBe(new Date(base).getTime() - 60 * 60 * 1000);
    });
  });

  describe('isPast', () => {
    it('returns true for past date', () => {
      expect(isPast('2020-01-01T00:00:00.000Z')).toBe(true);
    });
    it('returns false for future date', () => {
      expect(isPast('2030-01-01T00:00:00.000Z')).toBe(false);
    });
    it('returns true when iso equals ref (edge)', () => {
      const now = new Date();
      expect(isPast(now.toISOString(), now)).toBe(true);
    });
  });

  describe('unixTsSeconds', () => {
    it('returns integer seconds', () => {
      const r = unixTsSeconds();
      expect(Number.isInteger(r)).toBe(true);
      expect(r).toBeGreaterThan(1700000000);
    });
    it('respects date parameter', () => {
      const d = new Date('2020-01-01T00:00:00.000Z');
      expect(unixTsSeconds(d)).toBe(1577836800);
    });
  });
});
