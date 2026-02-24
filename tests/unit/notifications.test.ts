import { describe, expect, it, vi } from 'vitest';
import { NotificationService } from '../../src/services/notifications';
import type { AegisStore } from '../../src/services/store';
import type { AppConfig } from '../../src/config';

const mockConfig: AppConfig = {
  port: 3000,
  baseUrl: 'http://localhost:3000',
  dbPath: ':memory:',
  emailFrom: 'test@test.com',
  webhookSigningSecret: 'secret',
  autoStartWorkers: false,
  approvalExpiryMinutesDefault: 15,
  sessionCookieName: 'aegis_session',
  adminPassword: 'x',
  adminSessionSecret: 'x',
  adminSessionCookieName: 'aegis_admin_session',
  stripeSecretKey: null,
  stripePublishableKey: null,
} as AppConfig;

describe('notifications', () => {
  it('sendApprovalEmail calls store.queueEmail with correct params', () => {
    const queueEmail = vi.fn().mockReturnValue('email_id_123');
    const store = { queueEmail } as unknown as AegisStore;

    const service = new NotificationService(store, mockConfig);
    const id = service.sendApprovalEmail({
      toEmail: 'user@example.com',
      userName: 'Test User',
      actionId: 'act_1',
      amount: '10.00',
      currency: 'USD',
      recipientName: 'Merchant',
      magicToken: 'tok_abc',
      expiresAt: '2026-02-24T12:00:00.000Z',
    });

    expect(id).toBe('email_id_123');
    expect(queueEmail).toHaveBeenCalledWith(
      'user@example.com',
      'Aegis Approval Request',
      expect.stringContaining('10.00'),
      expect.stringContaining('Merchant'),
      expect.objectContaining({
        type: 'approval_request',
        action_id: 'act_1',
        approve_url: expect.stringContaining('tok_abc'),
      })
    );
  });
});
