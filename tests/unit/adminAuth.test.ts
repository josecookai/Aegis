import { describe, expect, it } from 'vitest';
import { AdminAuthService } from '../../src/services/adminAuth';
import type { AppConfig } from '../../src/config';

function createConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    port: 3000,
    baseUrl: 'http://localhost:3000',
    dbPath: ':memory:',
    emailFrom: 'no-reply@test.local',
    webhookSigningSecret: 'test_secret',
    autoStartWorkers: false,
    approvalExpiryMinutesDefault: 15,
    sessionCookieName: 'aegis_session',
    adminPassword: 'test_admin_pass',
    adminSessionSecret: 'test_session_secret',
    adminSessionCookieName: 'aegis_admin_session',
    appSessionSecret: 'test_app_session_secret',
    appSessionCookieName: 'aegis_app_session',
    stripeSecretKey: null,
    stripePublishableKey: null,
    ...overrides,
  };
}

describe('AdminAuthService', () => {
  describe('isEnabled', () => {
    it('returns true when adminPassword is set', () => {
      const auth = new AdminAuthService(createConfig({ adminPassword: 'x' }));
      expect(auth.isEnabled()).toBe(true);
    });

    it('returns false when adminPassword is empty', () => {
      const auth = new AdminAuthService(createConfig({ adminPassword: '' }));
      expect(auth.isEnabled()).toBe(false);
    });
  });

  describe('verifyPassword', () => {
    it('returns true for correct password', () => {
      const auth = new AdminAuthService(createConfig({ adminPassword: 'correct' }));
      expect(auth.verifyPassword('correct')).toBe(true);
    });

    it('returns false for wrong password', () => {
      const auth = new AdminAuthService(createConfig({ adminPassword: 'correct' }));
      expect(auth.verifyPassword('wrong')).toBe(false);
    });

    it('returns false when adminPassword is not configured', () => {
      const auth = new AdminAuthService(createConfig({ adminPassword: '' }));
      expect(auth.verifyPassword('anything')).toBe(false);
    });
  });

  describe('issueSessionToken', () => {
    it('returns a JWT-like token with body and signature', () => {
      const auth = new AdminAuthService(createConfig());
      const token = auth.issueSessionToken();
      expect(typeof token).toBe('string');
      const parts = token.split('.');
      expect(parts.length).toBe(2);
      expect(parts[0].length).toBeGreaterThan(0);
      expect(parts[1].length).toBeGreaterThan(0);
    });

    it('produces tokens that verifySessionToken accepts', () => {
      const auth = new AdminAuthService(createConfig());
      const token = auth.issueSessionToken();
      expect(auth.verifySessionToken(token)).toBe(true);
    });
  });

  describe('verifySessionToken', () => {
    it('accepts valid token from issueSessionToken', () => {
      const auth = new AdminAuthService(createConfig());
      const token = auth.issueSessionToken();
      expect(auth.verifySessionToken(token)).toBe(true);
    });

    it('rejects null or undefined', () => {
      const auth = new AdminAuthService(createConfig());
      expect(auth.verifySessionToken(null)).toBe(false);
      expect(auth.verifySessionToken(undefined)).toBe(false);
    });

    it('rejects empty string', () => {
      const auth = new AdminAuthService(createConfig());
      expect(auth.verifySessionToken('')).toBe(false);
    });

    it('rejects malformed token (no dot)', () => {
      const auth = new AdminAuthService(createConfig());
      expect(auth.verifySessionToken('invalid')).toBe(false);
    });

    it('rejects token with tampered signature', () => {
      const auth = new AdminAuthService(createConfig());
      const token = auth.issueSessionToken();
      const [body] = token.split('.');
      expect(auth.verifySessionToken(`${body}.tampered_sig`)).toBe(false);
    });

    it('rejects expired token', () => {
      const auth = new AdminAuthService(createConfig());
      const past = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const token = auth.issueSessionToken(past);
      expect(auth.verifySessionToken(token, new Date())).toBe(false);
    });
  });
});
