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
  appSessionSecret: string;
  appSessionCookieName: string;
  stripeSecretKey: string | null;
  stripePublishableKey: string | null;
  passwordHashPepper?: string;
  authOauthStateTtlMinutes?: number;
  googleClientId?: string | null;
  googleClientSecret?: string | null;
  googleOauthRedirectUri?: string | null;
  githubClientId?: string | null;
  githubClientSecret?: string | null;
  githubOauthRedirectUri?: string | null;
}

function boolFromEnv(value: string | undefined, fallback: boolean): boolean {
  if (value == null) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
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
    appSessionSecret: process.env.APP_SESSION_SECRET ?? 'aegis_app_session_secret_dev_only',
    appSessionCookieName: process.env.APP_SESSION_COOKIE_NAME ?? 'aegis_app_session',
    stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? null,
    stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY ?? null,
    passwordHashPepper: process.env.PASSWORD_HASH_PEPPER ?? 'aegis_password_pepper_dev_only',
    authOauthStateTtlMinutes: Number(process.env.AUTH_OAUTH_STATE_TTL_MINUTES ?? 10),
    googleClientId: process.env.GOOGLE_CLIENT_ID ?? null,
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? null,
    googleOauthRedirectUri: process.env.GOOGLE_OAUTH_REDIRECT_URI ?? null,
    githubClientId: process.env.GITHUB_CLIENT_ID ?? null,
    githubClientSecret: process.env.GITHUB_CLIENT_SECRET ?? null,
    githubOauthRedirectUri: process.env.GITHUB_OAUTH_REDIRECT_URI ?? null,
  };
}
