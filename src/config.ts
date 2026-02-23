import path from 'node:path';

export interface AppConfig {
  port: number;
  baseUrl: string;
  dbPath: string;
  emailFrom: string;
  webhookSigningSecret: string;
  autoStartWorkers: boolean;
  approvalExpiryMinutesDefault: number;
  sessionCookieName: string;
  adminPassword: string;
  adminSessionSecret: string;
  adminSessionCookieName: string;
}

function boolFromEnv(value: string | undefined, fallback: boolean): boolean {
  if (value == null) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

export function loadConfig(): AppConfig {
  const cwd = process.cwd();
  return {
    port: Number(process.env.PORT ?? 3000),
    baseUrl: process.env.BASE_URL ?? 'http://localhost:3000',
    dbPath: process.env.DB_PATH ?? path.join(cwd, 'data', 'aegis.db'),
    emailFrom: process.env.EMAIL_FROM ?? 'no-reply@aegis.local',
    webhookSigningSecret: process.env.WEBHOOK_SIGNING_SECRET ?? 'dev_global_secret',
    autoStartWorkers: boolFromEnv(process.env.AUTO_START_WORKERS, true),
    approvalExpiryMinutesDefault: Number(process.env.APPROVAL_EXPIRY_MINUTES ?? 15),
    sessionCookieName: process.env.SESSION_COOKIE_NAME ?? 'aegis_session',
    adminPassword: process.env.ADMIN_PASSWORD ?? 'aegis_admin_dev',
    adminSessionSecret: process.env.ADMIN_SESSION_SECRET ?? 'aegis_admin_session_secret_dev_only',
    adminSessionCookieName: process.env.ADMIN_SESSION_COOKIE_NAME ?? 'aegis_admin_session',
  };
}
