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
  appSessionCookieName: string;
  appSessionTtlMinutes: number;
  stripeSecretKey: string | null;
  stripePublishableKey: string | null;
  allowMockCardExecution: boolean;
  googleClientId: string | null;
  googleClientSecret: string | null;
}

function boolFromEnv(value: string | undefined, fallback: boolean): boolean {
  if (value == null) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

export function isProductionHttps(config: Pick<AppConfig, 'baseUrl'>): boolean {
  return config.baseUrl.startsWith('https');
}

export function loadConfig(): AppConfig {
  const cwd = process.cwd();
  const runningOnVercel = Boolean(process.env.VERCEL);
  const defaultDbPath = runningOnVercel ? '/tmp/aegis.db' : path.join(cwd, 'data', 'aegis.db');
  return {
    port: Number(process.env.PORT ?? 3000),
    baseUrl: process.env.BASE_URL ?? 'http://localhost:3000',
    dbPath: process.env.DB_PATH ?? defaultDbPath,
    emailFrom: process.env.EMAIL_FROM ?? 'no-reply@aegis.local',
    webhookSigningSecret: process.env.WEBHOOK_SIGNING_SECRET ?? 'dev_global_secret',
    autoStartWorkers: process.env.VERCEL ? false : boolFromEnv(process.env.AUTO_START_WORKERS, true),
    approvalExpiryMinutesDefault: Number(process.env.APPROVAL_EXPIRY_MINUTES ?? 15),
    sessionCookieName: process.env.SESSION_COOKIE_NAME ?? 'aegis_session',
    adminPassword: process.env.ADMIN_PASSWORD ?? 'aegis_admin_dev',
    adminSessionSecret: process.env.ADMIN_SESSION_SECRET ?? 'aegis_admin_session_secret_dev_only',
    adminSessionCookieName: process.env.ADMIN_SESSION_COOKIE_NAME ?? 'aegis_admin_session',
    appSessionCookieName: process.env.APP_SESSION_COOKIE_NAME ?? 'aegis_app_session',
    appSessionTtlMinutes: Number(process.env.APP_SESSION_TTL_MINUTES ?? 10080), // 7 days
    stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? null,
    stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY ?? null,
    allowMockCardExecution: boolFromEnv(process.env.ALLOW_MOCK_CARD_EXECUTION, process.env.NODE_ENV !== 'production'),
    googleClientId: process.env.GOOGLE_CLIENT_ID ?? null,
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? null,
  };
}
