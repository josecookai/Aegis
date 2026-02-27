import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { NotificationService } from '../../src/services/notifications';
import { AegisStore } from '../../src/services/store';
import { createDb } from '../../src/db';
import type { AppConfig } from '../../src/config';

function createConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    port: 3000,
    baseUrl: 'https://aegis.example.com',
    dbPath: ':memory:',
    emailFrom: 'approvals@aegis.example.com',
    webhookSigningSecret: 'test',
    autoStartWorkers: false,
    approvalExpiryMinutesDefault: 15,
    sessionCookieName: 'aegis_session',
    adminPassword: 'test',
    adminSessionSecret: 'test',
    adminSessionCookieName: 'aegis_admin_session',
    appSessionSecret: 'test_app_session_secret',
    appSessionCookieName: 'aegis_app_session',
    stripeSecretKey: null,
    stripePublishableKey: null,
    ...overrides,
  };
}

describe('NotificationService', () => {
  it('sendApprovalEmail writes to outbox with correct params', () => {
    const { db } = createDb(':memory:');
    const store = new AegisStore(db);
    const config = createConfig({ baseUrl: 'https://app.aegis.test' });
    const notifications = new NotificationService(store, config);

    const params = {
      toEmail: 'user@example.com',
      userName: 'Test User',
      actionId: 'act_123',
      amount: '99.99',
      currency: 'USD',
      recipientName: 'Merchant Inc',
      magicToken: 'magic_abc',
      expiresAt: '2026-02-24T12:00:00Z',
    };

    const id = notifications.sendApprovalEmail(params);

    expect(typeof id).toBe('string');
    expect(id).toMatch(/^email_/);

    const outbox = store.listEmailOutbox(10);
    const entry = outbox.find((e: any) => e.id === id);
    expect(entry).toBeTruthy();
    if (!entry) throw new Error('Expected outbox entry');
    expect(entry.to_email).toBe('user@example.com');
    expect(entry.subject).toBe('Aegis Approval Request');
    expect(entry.body_text).toContain('Test User');
    expect(entry.body_text).toContain('99.99');
    expect(entry.body_text).toContain('USD');
    expect(entry.body_text).toContain('Merchant Inc');
    expect(entry.body_text).toContain('act_123');
    expect(entry.body_text).toContain('magic_abc');
    expect(entry.body_text).toContain('https://app.aegis.test/approve/');

    const meta = JSON.parse(entry.metadata_json as string);
    expect(meta.type).toBe('approval_request');
    expect(meta.action_id).toBe('act_123');
    expect(meta.approve_url).toContain('magic_abc');
    expect(meta.expires_at).toBe('2026-02-24T12:00:00Z');
  });

  it('escapeHtml sanitizes user-provided content in HTML body', () => {
    const { db } = createDb(':memory:');
    const store = new AegisStore(db);
    const config = createConfig();
    const notifications = new NotificationService(store, config);

    const params = {
      toEmail: 'x@x.com',
      userName: '<script>alert(1)</script>',
      actionId: 'act_1',
      amount: '1',
      currency: 'USD',
      recipientName: 'Bob & Co',
      magicToken: 't',
      expiresAt: '2026-01-01Z',
    };

    const id = notifications.sendApprovalEmail(params);
    const outbox = store.listEmailOutbox(10);
    const entry = outbox.find((e: any) => e.id === id);
    if (!entry) throw new Error('Expected outbox entry');
    expect(entry.body_html).toContain('&lt;script&gt;');
    expect(entry.body_html).not.toContain('<script>');
    expect(entry.body_html).toContain('Bob &amp; Co');
  });

  it('sendMagicLinkEmail writes to outbox with login URL', () => {
    const { db } = createDb(':memory:');
    const store = new AegisStore(db);
    const config = createConfig({ baseUrl: 'https://app.aegis.test' });
    const notifications = new NotificationService(store, config);

    const id = notifications.sendMagicLinkEmail({
      toEmail: 'user@example.com',
      userName: 'Test User',
      loginUrl: 'https://app.aegis.test/auth/magic-link/verify?token=abc',
      expiresAt: '2026-02-24T12:00:00Z',
    });

    expect(typeof id).toBe('string');
    const outbox = store.listEmailOutbox(10);
    const entry = outbox.find((e: any) => e.id === id);
    expect(entry).toBeTruthy();
    if (!entry) throw new Error('Expected outbox entry');
    expect(entry.subject).toBe('Aegis Login Link');
    expect(entry.body_text).toContain('sign in');
    const meta = JSON.parse(entry.metadata_json as string);
    expect(meta.type).toBe('magic_link_login');
    expect(meta.login_url).toContain('token=abc');
  });
});
