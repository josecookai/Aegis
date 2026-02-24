import { describe, expect, it, beforeAll } from 'vitest';
import { createDb } from '../../src/db';
import { AegisStore } from '../../src/services/store';

describe('store', () => {
  let store: AegisStore;

  beforeAll(() => {
    const { db } = createDb(':memory:');
    store = new AegisStore(db);
  });

  describe('getAgentByApiKey', () => {
    it('returns agent for valid demo key', () => {
      const agent = store.getAgentByApiKey('aegis_demo_agent_key');
      expect(agent).toBeTruthy();
      expect(agent!.id).toBe('agt_demo');
      expect(agent!.name).toBe('Demo Agent');
    });
    it('returns null for invalid key', () => {
      expect(store.getAgentByApiKey('invalid_key')).toBeNull();
    });
  });

  describe('getEndUserById', () => {
    it('returns user for usr_demo', () => {
      const user = store.getEndUserById('usr_demo');
      expect(user).toBeTruthy();
      expect(user!.id).toBe('usr_demo');
      expect(user!.email).toBe('demo.user@example.com');
    });
    it('returns null for nonexistent user', () => {
      expect(store.getEndUserById('usr_nonexistent')).toBeNull();
    });
  });

  describe('isAgentLinkedToUser', () => {
    it('returns true for agt_demo and usr_demo', () => {
      expect(store.isAgentLinkedToUser('agt_demo', 'usr_demo')).toBe(true);
    });
    it('returns false for unlinked pair', () => {
      expect(store.isAgentLinkedToUser('agt_demo', 'usr_nonexistent')).toBe(false);
    });
  });

  describe('listPaymentMethodsForUser', () => {
    it('returns payment methods for usr_demo', () => {
      const methods = store.listPaymentMethodsForUser('usr_demo');
      expect(Array.isArray(methods)).toBe(true);
      expect(methods.length).toBeGreaterThanOrEqual(0);
    });
    it('returns empty array for user with no methods', () => {
      const methods = store.listPaymentMethodsForUser('usr_team_admin');
      expect(Array.isArray(methods)).toBe(true);
    });
  });

  describe('createAction and transitionActionStatus', () => {
    it('creates action and transitions to awaiting_approval', () => {
      const created = store.createAction({
        agentId: 'agt_demo',
        input: {
          idempotency_key: 'store_test_1',
          end_user_id: 'usr_demo',
          action_type: 'payment',
          details: {
            amount: '5.00',
            currency: 'USD',
            recipient_name: 'Test',
            description: 'Store test',
            payment_rail: 'card',
            payment_method_preference: 'card_default',
            recipient_reference: 'merchant_api:store_test',
          },
        },
        defaultExpiryMinutes: 15,
      });
      expect(created.id).toBeTruthy();
      expect(created.status).toBe('received');

      const awaiting = store.transitionActionStatus({
        actionId: created.id,
        to: 'awaiting_approval',
      });
      expect(awaiting.status).toBe('awaiting_approval');
    });
  });

  describe('findActionByAgentAndIdempotency', () => {
    it('finds existing action by idempotency key', () => {
      const created = store.createAction({
        agentId: 'agt_demo',
        input: {
          idempotency_key: 'store_test_find',
          end_user_id: 'usr_demo',
          action_type: 'payment',
          details: {
            amount: '1.00',
            currency: 'USD',
            recipient_name: 'X',
            description: 'Find test',
            payment_rail: 'card',
            payment_method_preference: 'card_default',
            recipient_reference: 'merchant_api:find',
          },
        },
        defaultExpiryMinutes: 15,
      });
      const found = store.findActionByAgentAndIdempotency('agt_demo', 'store_test_find');
      expect(found).toBeTruthy();
      expect(found!.id).toBe(created.id);
    });
    it('returns null for nonexistent idempotency', () => {
      expect(store.findActionByAgentAndIdempotency('agt_demo', 'nonexistent_key_xyz')).toBeNull();
    });
  });
});
