import { describe, expect, it } from 'vitest';
import { canTransition, assertTransition, isTerminalStatus } from '../../src/stateMachine';
import type { ActionStatus } from '../../src/types';

describe('stateMachine', () => {
  describe('canTransition', () => {
    it('allows received -> validation_failed', () => {
      expect(canTransition('received', 'validation_failed')).toBe(true);
    });
    it('allows received -> awaiting_approval', () => {
      expect(canTransition('received', 'awaiting_approval')).toBe(true);
    });
    it('rejects received -> approved', () => {
      expect(canTransition('received', 'approved')).toBe(false);
    });
    it('allows awaiting_approval -> approved', () => {
      expect(canTransition('awaiting_approval', 'approved')).toBe(true);
    });
    it('allows awaiting_approval -> denied', () => {
      expect(canTransition('awaiting_approval', 'denied')).toBe(true);
    });
    it('allows awaiting_approval -> expired', () => {
      expect(canTransition('awaiting_approval', 'expired')).toBe(true);
    });
    it('allows awaiting_approval -> canceled', () => {
      expect(canTransition('awaiting_approval', 'canceled')).toBe(true);
    });
    it('rejects awaiting_approval -> executing', () => {
      expect(canTransition('awaiting_approval', 'executing')).toBe(false);
    });
    it('allows approved -> executing', () => {
      expect(canTransition('approved', 'executing')).toBe(true);
    });
    it('allows executing -> succeeded', () => {
      expect(canTransition('executing', 'succeeded')).toBe(true);
    });
    it('allows executing -> failed', () => {
      expect(canTransition('executing', 'failed')).toBe(true);
    });
    it('rejects terminal status transitions', () => {
      const terminal: ActionStatus[] = ['validation_failed', 'denied', 'expired', 'succeeded', 'failed', 'canceled'];
      for (const t of terminal) {
        expect(canTransition(t, 'awaiting_approval')).toBe(false);
      }
    });
  });

  describe('assertTransition', () => {
    it('does not throw for valid transition', () => {
      expect(() => assertTransition('received', 'awaiting_approval')).not.toThrow();
    });
    it('throws for invalid transition', () => {
      expect(() => assertTransition('received', 'approved')).toThrow('Invalid action status transition: received -> approved');
    });
  });

  describe('isTerminalStatus', () => {
    it('returns true for terminal statuses', () => {
      expect(isTerminalStatus('validation_failed')).toBe(true);
      expect(isTerminalStatus('denied')).toBe(true);
      expect(isTerminalStatus('expired')).toBe(true);
      expect(isTerminalStatus('succeeded')).toBe(true);
      expect(isTerminalStatus('failed')).toBe(true);
      expect(isTerminalStatus('canceled')).toBe(true);
    });
    it('returns false for non-terminal statuses', () => {
      expect(isTerminalStatus('received')).toBe(false);
      expect(isTerminalStatus('awaiting_approval')).toBe(false);
      expect(isTerminalStatus('approved')).toBe(false);
      expect(isTerminalStatus('executing')).toBe(false);
    });
  });
});
