import { describe, expect, it } from 'vitest';
import { createAegisApp } from '../../src/app';

describe('aegis', () => {
  const runtime = createAegisApp({ dbPath: ':memory:', autoStartWorkers: false, baseUrl: 'http://test' });
  const { service } = runtime;

  describe('authenticateAgent', () => {
    it('returns agent for valid API key', () => {
      const agent = service.authenticateAgent('aegis_demo_agent_key');
      expect(agent.id).toBe('agt_demo');
      expect(agent.status).toBe('active');
    });
    it('throws for missing API key', () => {
      expect(() => service.authenticateAgent('')).toThrow(/Missing API key/);
      expect(() => service.authenticateAgent(null)).toThrow(/Missing API key/);
      expect(() => service.authenticateAgent(undefined)).toThrow(/Missing API key/);
    });
    it('throws for invalid API key', () => {
      expect(() => service.authenticateAgent('invalid_key')).toThrow(/Invalid API key/);
    });
  });

  describe('createActionRequest', () => {
    const validInput = {
      idempotency_key: 'aegis_test_1',
      end_user_id: 'usr_demo',
      action_type: 'payment' as const,
      callback_url: 'https://example.com/cb',
      details: {
        amount: '10.00',
        currency: 'USD',
        recipient_name: 'Merchant',
        description: 'Test',
        payment_rail: 'card' as const,
        payment_method_preference: 'card_default',
        recipient_reference: 'merchant_api:test',
      },
    };

    it('creates action for valid input', () => {
      const agent = service.authenticateAgent('aegis_demo_agent_key');
      const result = service.createActionRequest(agent, validInput);
      expect(result.action.status).toBe('awaiting_approval');
      expect(result.approvalUrl).toContain('/approve/');
      expect(result.idempotencyReplayed).toBe(false);
    });

    it('throws USER_DISABLED for unknown user', () => {
      const agent = service.authenticateAgent('aegis_demo_agent_key');
      expect(() =>
        service.createActionRequest(agent, {
          ...validInput,
          idempotency_key: 'aegis_unknown_user',
          end_user_id: 'usr_nonexistent',
        })
      ).toThrow(/Unknown or inactive end_user_id/);
    });

    it('throws UNLINKED_END_USER when agent not linked to user', () => {
      const db = service.getStore().getRawDb();
      db.prepare('DELETE FROM agent_user_links WHERE agent_id = ? AND end_user_id = ?').run('agt_demo', 'usr_demo');
      try {
        const agent = service.authenticateAgent('aegis_demo_agent_key');
        expect(() =>
          service.createActionRequest(agent, { ...validInput, idempotency_key: 'aegis_unlinked' })
        ).toThrow(/UNLINKED_END_USER|not linked/);
      } finally {
        db.prepare('INSERT INTO agent_user_links (agent_id, end_user_id, created_at) VALUES (?, ?, ?)').run(
          'agt_demo',
          'usr_demo',
          new Date().toISOString()
        );
      }
    });

    it('throws NO_DEFAULT_PAYMENT_METHOD when user has no payment method', () => {
      const db = service.getStore().getRawDb();
      const backup = db.prepare('SELECT * FROM payment_methods WHERE end_user_id = ?').all('usr_demo') as any[];
      db.prepare('DELETE FROM payment_methods WHERE end_user_id = ?').run('usr_demo');
      try {
        const agent = service.authenticateAgent('aegis_demo_agent_key');
        expect(() =>
          service.createActionRequest(agent, { ...validInput, idempotency_key: 'aegis_no_pm' })
        ).toThrow(/NO_DEFAULT_PAYMENT_METHOD|No .* payment method/);
      } finally {
        for (const row of backup) {
          db.prepare(
            'INSERT INTO payment_methods (id, end_user_id, rail, alias, external_token, metadata_json, is_default, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
          ).run(row.id, row.end_user_id, row.rail, row.alias, row.external_token, row.metadata_json, row.is_default, row.created_at);
        }
      }
    });

    it('replays idempotency for same key', () => {
      const agent = service.authenticateAgent('aegis_demo_agent_key');
      const input = { ...validInput, idempotency_key: 'aegis_idem_replay' };
      const first = service.createActionRequest(agent, input);
      const second = service.createActionRequest(agent, input);
      expect(second.action.id).toBe(first.action.id);
      expect(second.idempotencyReplayed).toBe(true);
    });

    it('throws INVALID_CURRENCY for card with non-USD', () => {
      const agent = service.authenticateAgent('aegis_demo_agent_key');
      expect(() =>
        service.createActionRequest(agent, {
          ...validInput,
          idempotency_key: 'aegis_invalid_currency',
          details: { ...validInput.details, currency: 'EUR' },
        })
      ).toThrow(/INVALID_CURRENCY|Card rail only supports USD/);
    });

    it('throws UNSUPPORTED_RECIPIENT for invalid card recipient_reference', () => {
      const agent = service.authenticateAgent('aegis_demo_agent_key');
      expect(() =>
        service.createActionRequest(agent, {
          ...validInput,
          idempotency_key: 'aegis_invalid_recipient',
          details: { ...validInput.details, recipient_reference: 'invalid:ref' },
        })
      ).toThrow(/UNSUPPORTED_RECIPIENT|recipient_reference/);
    });

    it('throws INVALID_CALLBACK_URL for non-https non-localhost', () => {
      const agent = service.authenticateAgent('aegis_demo_agent_key');
      expect(() =>
        service.createActionRequest(agent, {
          ...validInput,
          idempotency_key: 'aegis_invalid_cb',
          callback_url: 'http://evil.com/callback',
        })
      ).toThrow(/INVALID_CALLBACK_URL|callback_url/);
    });
  });

  describe('getCapabilities', () => {
    it('returns capabilities for linked user', () => {
      const agent = service.authenticateAgent('aegis_demo_agent_key');
      const caps = service.getCapabilities(agent, 'usr_demo');
      expect(caps.end_user_id).toBe('usr_demo');
      expect(caps.rails).toContain('card');
    });
    it('throws for unlinked user', () => {
      const db = service.getStore().getRawDb();
      db.prepare('DELETE FROM agent_user_links WHERE agent_id = ? AND end_user_id = ?').run('agt_demo', 'usr_demo');
      try {
        const agent = service.authenticateAgent('aegis_demo_agent_key');
        expect(() => service.getCapabilities(agent, 'usr_demo')).toThrow(/UNLINKED_END_USER|not linked/);
      } finally {
        db.prepare('INSERT INTO agent_user_links (agent_id, end_user_id, created_at) VALUES (?, ?, ?)').run(
          'agt_demo',
          'usr_demo',
          new Date().toISOString()
        );
      }
    });
  });
});
