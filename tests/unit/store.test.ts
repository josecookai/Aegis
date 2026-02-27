import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { createDb } from '../../src/db';
import { AegisStore } from '../../src/services/store';

describe('store', () => {
  let store: AegisStore;
  let db: Database.Database;

  beforeEach(() => {
    const ctx = createDb(':memory:');
    db = ctx.db;
    store = new AegisStore(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('getAgentByApiKey', () => {
    it('returns agent for valid demo key', () => {
      const agent = store.getAgentByApiKey('aegis_demo_agent_key');
      expect(agent).not.toBeNull();
      expect(agent!.id).toBe('agt_demo');
      expect(agent!.status).toBe('active');
    });
    it('returns null for unknown key', () => {
      expect(store.getAgentByApiKey('invalid_key')).toBeNull();
    });
  });

  describe('getEndUserById', () => {
    it('returns user for usr_demo', () => {
      const user = store.getEndUserById('usr_demo');
      expect(user).not.toBeNull();
      expect(user!.email).toBe('demo.user@example.com');
    });
    it('returns null for unknown user', () => {
      expect(store.getEndUserById('usr_unknown')).toBeNull();
    });
  });

  describe('isAgentLinkedToUser', () => {
    it('returns true for linked agent-user', () => {
      expect(store.isAgentLinkedToUser('agt_demo', 'usr_demo')).toBe(true);
    });
    it('returns false for unlinked', () => {
      expect(store.isAgentLinkedToUser('agt_demo', 'usr_nonexistent')).toBe(false);
    });
  });

  describe('listPaymentMethodsForUser', () => {
    it('returns payment methods for usr_demo', () => {
      const methods = store.listPaymentMethodsForUser('usr_demo');
      expect(methods.length).toBeGreaterThanOrEqual(1);
      expect(methods.some((m) => m.rail === 'card')).toBe(true);
    });
    it('returns empty for user with no methods', () => {
      const methods = store.listPaymentMethodsForUser('usr_team_01');
      expect(methods).toEqual([]);
    });
  });

  describe('createAction', () => {
    it('creates action and returns record', () => {
      const input = {
        idempotency_key: 'store_test_1',
        end_user_id: 'usr_demo',
        action_type: 'payment' as const,
        details: {
          amount: '10.00',
          currency: 'USD',
          recipient_name: 'Test',
          description: 'Store test',
          payment_rail: 'card' as const,
          payment_method_preference: 'card_default',
          recipient_reference: 'merchant_api:test',
        },
      };
      const action = store.createAction({
        agentId: 'agt_demo',
        input,
        defaultExpiryMinutes: 15,
      });
      expect(action.id).toMatch(/^act_/);
      expect(action.status).toBe('received');
      expect(action.amount).toBe('10.00');
    });
  });

  describe('transitionActionStatus', () => {
    it('transitions received -> awaiting_approval -> approved -> executing -> succeeded', () => {
      const input = {
        idempotency_key: 'store_trans_1',
        end_user_id: 'usr_demo',
        action_type: 'payment' as const,
        details: {
          amount: '5.00',
          currency: 'USD',
          recipient_name: 'T',
          description: 'T',
          payment_rail: 'card' as const,
          payment_method_preference: 'card_default',
          recipient_reference: 'merchant_api:t',
        },
      };
      const created = store.createAction({ agentId: 'agt_demo', input, defaultExpiryMinutes: 15 });
      const awaiting = store.transitionActionStatus({ actionId: created.id, to: 'awaiting_approval' });
      expect(awaiting.status).toBe('awaiting_approval');

      const approved = store.transitionActionStatus({ actionId: awaiting.id, to: 'approved' });
      expect(approved.status).toBe('approved');

      const executing = store.transitionActionStatus({ actionId: approved.id, to: 'executing' });
      expect(executing.status).toBe('executing');

      const succeeded = store.transitionActionStatus({ actionId: executing.id, to: 'succeeded' });
      expect(succeeded.status).toBe('succeeded');
    });
    it('throws for invalid transition', () => {
      const input = {
        idempotency_key: 'store_invalid_1',
        end_user_id: 'usr_demo',
        action_type: 'payment' as const,
        details: {
          amount: '1.00',
          currency: 'USD',
          recipient_name: 'T',
          description: 'T',
          payment_rail: 'card' as const,
          payment_method_preference: 'card_default',
          recipient_reference: 'merchant_api:t',
        },
      };
      const created = store.createAction({ agentId: 'agt_demo', input, defaultExpiryMinutes: 15 });
      expect(() =>
        store.transitionActionStatus({ actionId: created.id, to: 'succeeded' })
      ).toThrow(/Invalid action status transition/);
    });
  });

  describe('listActionsByUserAndStatus', () => {
    it('returns pending actions for user', () => {
      const input = {
        idempotency_key: 'store_list_1',
        end_user_id: 'usr_demo',
        action_type: 'payment' as const,
        details: {
          amount: '1.00',
          currency: 'USD',
          recipient_name: 'T',
          description: 'T',
          payment_rail: 'card' as const,
          payment_method_preference: 'card_default',
          recipient_reference: 'merchant_api:t',
        },
      };
      const created = store.createAction({ agentId: 'agt_demo', input, defaultExpiryMinutes: 15 });
      const awaiting = store.transitionActionStatus({ actionId: created.id, to: 'awaiting_approval' });
      const pending = store.listActionsByUserAndStatus('usr_demo', 'awaiting_approval');
      expect(pending.some((a) => a.id === awaiting.id)).toBe(true);
    });
  });

  describe('listActionsByUser', () => {
    it('returns paginated history', () => {
      const { rows, total } = store.listActionsByUser('usr_demo', 5, 0);
      expect(Array.isArray(rows)).toBe(true);
      expect(typeof total).toBe('number');
      expect(rows.length).toBeLessThanOrEqual(5);
    });
  });
});
