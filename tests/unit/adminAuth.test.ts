import { describe, expect, it } from 'vitest';
import { AdminAuthService } from '../../src/services/adminAuth';
import type { AppConfig } from '../../src/config';

function mockConfig(overrides?: Partial<AppConfig>): AppConfig {
  return {
    port: 3000,
    baseUrl: 'http://localhost:3000',
    dbPath: ':memory:',
    emailFrom: 'test@test.com',
    webhookSigningSecret: 'secret',
    autoStartWorkers: false,
    approvalExpiryMinutesDefault: 15,
    sessionCookieName: 'aegis_session',
    adminPassword: 'test_password',
    adminSessionSecret: 'session_secret',
    adminSessionCookieName: 'aegis_admin_session',
    stripeSecretKey: null,
    stripePublishableKey: null,
    ...overrides,
  } as AppConfig;
}

describe('adminAuth', () => {
  describe('isEnabled', () => {
    it('returns true when adminPassword is set', () => {
      const auth = new AdminAuthService(mockConfig({ adminPassword: 'x' }));
      expect(auth.isEnabled()).toBe(true);
    });
    it('returns false when adminPassword is empty', () => {
      const auth = new AdminAuthService(mockConfig({ adminPassword: '' }));
      expect(auth.isEnabled()).toBe(false);
    });
  });

  describe('verifyPassword', () => {
    it('returns true for correct password', () => {
      const auth = new AdminAuthService(mockConfig({ adminPassword: 'test_password' }));
      expect(auth.verifyPassword('test_password')).toBe(true);
    });
    it('returns false for wrong password', () => {
      const auth = new AdminAuthService(mockConfig({ adminPassword: 'test_password' }));
      expect(auth.verifyPassword('wrong')).toBe(false);
    });
    it('returns false when no adminPassword configured', () => {
      const auth = new AdminAuthService(mockConfig({ adminPassword: '' }));
      expect(auth.verifyPassword('anything')).toBe(false);
    });
  });

  describe('issueSessionToken and verifySessionToken', () => {
    it('issues token that verifies successfully', () => {
      const auth = new AdminAuthService(mockConfig());
      const token = auth.issueSessionToken();
      expect(token).toBeTruthy();
      expect(auth.verifySessionToken(token)).toBe(true);
    });
    it('rejects null token', () => {
      const auth = new AdminAuthService(mockConfig());
      expect(auth.verifySessionToken(null)).toBe(false);
    });
    it('rejects undefined token', () => {
      const auth = new AdminAuthService(mockConfig());
      expect(auth.verifySessionToken(undefined)).toBe(false);
    });
    it('rejects invalid token format', () => {
      const auth = new AdminAuthService(mockConfig());
      expect(auth.verifySessionToken('invalid')).toBe(false);
    });
    it('rejects tampered token', () => {
      const auth = new AdminAuthService(mockConfig());
      const token = auth.issueSessionToken();
      const tampered = token.slice(0, -2) + 'xx';
      expect(auth.verifySessionToken(tampered)).toBe(false);
    });
    it('rejects expired token', () => {
      const auth = new AdminAuthService(mockConfig());
      const past = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const token = auth.issueSessionToken(past);
      const now = new Date();
      expect(auth.verifySessionToken(token, now)).toBe(false);
    });
  });
});
