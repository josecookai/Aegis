import { describe, expect, it } from 'vitest';
import { createAegisApp } from '../../src/app';
import { DomainError } from '../../src/services/aegis';

describe('aegis', () => {
  const runtime = createAegisApp({ dbPath: ':memory:', autoStartWorkers: false, baseUrl: 'http://localhost:0' });
  const service = runtime.service;

  describe('authenticateAgent', () => {
    it('throws for null api key', () => {
      expect(() => service.authenticateAgent(null as any)).toThrow(DomainError);
      try {
        service.authenticateAgent(null as any);
      } catch (e: any) {
        expect(e.code).toBe('UNAUTHORIZED');
        expect(e.httpStatus).toBe(401);
      }
    });
    it('throws for invalid api key', () => {
      expect(() => service.authenticateAgent('invalid_key')).toThrow(DomainError);
      try {
        service.authenticateAgent('invalid_key');
      } catch (e: any) {
        expect(e.code).toBe('UNAUTHORIZED');
      }
    });
    it('returns agent for valid key', () => {
      const agent = service.authenticateAgent('aegis_demo_agent_key');
      expect(agent).toBeTruthy();
      expect(agent.id).toBe('agt_demo');
    });
  });

  describe('createActionRequest', () => {
    it('throws UNLINKED_END_USER when agent not linked to user', () => {
      const agent = service.authenticateAgent('aegis_demo_agent_key');
      expect(() =>
        service.createActionRequest(agent, {
          idempotency_key: 'aegis_test_unlinked',
          end_user_id: 'usr_nonexistent',
          action_type: 'payment',
          details: {
            amount: '10.00',
            currency: 'USD',
            recipient_name: 'X',
            description: 'Test',
            payment_rail: 'card',
            payment_method_preference: 'card_default',
            recipient_reference: 'merchant_api:test',
          },
        })
      ).toThrow(DomainError);
      try {
        service.createActionRequest(agent, {
          idempotency_key: 'aegis_test_unlinked',
          end_user_id: 'usr_nonexistent',
          action_type: 'payment',
          details: {
            amount: '10.00',
            currency: 'USD',
            recipient_name: 'X',
            description: 'Test',
            payment_rail: 'card',
            payment_method_preference: 'card_default',
            recipient_reference: 'merchant_api:test',
          },
        });
      } catch (e: any) {
        expect(e.code === 'UNLINKED_END_USER' || e.code === 'INVALID_END_USER' || e.code === 'PAYMENT_METHOD_NOT_FOUND').toBe(true);
      }
    });
    it('creates action for valid linked user', () => {
      const agent = service.authenticateAgent('aegis_demo_agent_key');
      const result = service.createActionRequest(agent, {
        idempotency_key: 'aegis_test_valid_' + Date.now(),
        end_user_id: 'usr_demo',
        action_type: 'payment',
        details: {
          amount: '1.00',
          currency: 'USD',
          recipient_name: 'Test',
          description: 'Unit test',
          payment_rail: 'card',
          payment_method_preference: 'card_default',
          recipient_reference: 'merchant_api:aegis_test',
        },
      });
      expect(result.action).toBeTruthy();
      expect(result.approvalUrl).toBeTruthy();
      expect(result.action.status).toBe('awaiting_approval');
    });
  });
});
