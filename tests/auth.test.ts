import http from 'node:http';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAegisApp } from '../src/app';

describe('end-user auth portal', () => {
  const runtime = createAegisApp({
    dbPath: ':memory:',
    autoStartWorkers: false,
    baseUrl: 'http://localhost:0',
    googleClientId: null,
    googleClientSecret: null,
    githubClientId: null,
    githubClientSecret: null,
  } as any);
  let server: http.Server;
  let baseUrl: string;

  beforeAll(async () => {
    server = runtime.app.listen(0, '127.0.0.1');
    await new Promise<void>((resolve) => server.once('listening', () => resolve()));
    const addr = server.address();
    if (!addr || typeof addr === 'string') throw new Error('Failed to bind test server');
    baseUrl = `http://127.0.0.1:${addr.port}`;
    runtime.config.baseUrl = baseUrl;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
    runtime.stop();
  });

  it('renders /auth signup page with three login modes', async () => {
    const api = request(runtime.app);
    const res = await api.get('/auth?mode=signup').expect(200);
    expect(res.text).toContain('Create your account');
    expect(res.text).toContain('GitHub');
    expect(res.text).toContain('Google');
    expect(res.text).toContain('Email address');
  });

  it('registers and signs in with email/password, then shows signed-in auth page', async () => {
    const api = request(runtime.app);
    const register = await api
      .post('/auth/email/register')
      .send({ email: 'new.user@example.com', password: 'Password123!', display_name: 'New User', next: '/dashboard' })
      .expect(201);
    expect(register.body.ok).toBe(true);
    expect(register.body.user.email).toBe('new.user@example.com');

    const cookies = register.headers['set-cookie'] ?? [];
    const authPage = await api.get('/auth').set('Cookie', cookies).expect(200);
    expect(authPage.text).toContain('Signed in');
    expect(authPage.text).toContain('new.user@example.com');

    await api.post('/auth/logout').set('Cookie', cookies).expect(302);

    const login = await api
      .post('/auth/email/login')
      .send({ email: 'new.user@example.com', password: 'Password123!', next: '/dashboard' })
      .expect(200);
    expect(login.body.ok).toBe(true);
  });

  it('rejects invalid credentials', async () => {
    const api = request(runtime.app);
    await api.post('/auth/email/login').send({ email: 'demo.user@example.com', password: 'wrong-pass' }).expect(401);
  });

  it('returns provider disabled for OAuth start when provider is not configured', async () => {
    const api = request(runtime.app);
    const res = await api.get('/auth/oauth/google/start').set('Accept', 'application/json').expect(400);
    expect(res.body.error).toBe('OAUTH_PROVIDER_NOT_ENABLED');
  });

  it('returns oauth provider configuration status', async () => {
    const api = request(runtime.app);
    const res = await api.get('/auth/oauth/providers').expect(200);
    expect(res.body.google.enabled).toBe(false);
    expect(res.body.github.enabled).toBe(false);
    expect(String(res.body.google.redirect_uri)).toContain('/auth/oauth/google/callback');
  });

  it('rejects OAuth callback with invalid state', async () => {
    const runtime2 = createAegisApp({
      dbPath: ':memory:',
      autoStartWorkers: false,
      baseUrl: 'http://localhost:3000',
      githubClientId: 'gh_id',
      githubClientSecret: 'gh_secret',
    } as any);
    try {
      const api = request(runtime2.app);
      await api.get('/auth/oauth/github/callback?code=abc&state=bad').set('Accept', 'application/json').expect(400);
    } finally {
      runtime2.stop();
    }
  });

  it('completes GitHub OAuth callback success with mocked provider fetch', async () => {
    const runtime3 = createAegisApp({
      dbPath: ':memory:',
      autoStartWorkers: false,
      baseUrl: 'http://localhost:3000',
      githubClientId: 'gh_id',
      githubClientSecret: 'gh_secret',
    } as any);
    const originalFetch = globalThis.fetch;
    const mkJson = (obj: unknown, ok = true) =>
      ({
        ok,
        status: ok ? 200 : 500,
        json: async () => obj,
      } as any);
    globalThis.fetch = (async (url: any) => {
      const s = String(url);
      if (s.includes('/login/oauth/access_token')) return mkJson({ access_token: 'tok' });
      if (s.endsWith('/user')) return mkJson({ id: 12345, login: 'ghuser', name: 'GH User' });
      if (s.endsWith('/user/emails')) return mkJson([{ email: 'gh.user@example.com', verified: true, primary: true }]);
      throw new Error(`Unexpected fetch: ${s}`);
    }) as any;

    try {
      const store = runtime3.service.getStore();
      store.createOauthState('github', 'state123', '/dashboard', new Date(Date.now() + 60_000).toISOString());
      const api = request(runtime3.app);
      const res = await api.get('/auth/oauth/github/callback?code=abc&state=state123').expect(302);
      expect(String(res.headers.location)).toBe('/dashboard');
      const sessionRes = await api.get('/auth/session').set('Cookie', res.headers['set-cookie'] ?? []).expect(200);
      expect(sessionRes.body.authenticated).toBe(true);
      expect(sessionRes.body.user.email).toBe('gh.user@example.com');
    } finally {
      globalThis.fetch = originalFetch;
      runtime3.stop();
    }
  });

  it('completes Google OAuth callback success with mocked provider fetch', async () => {
    const runtime4 = createAegisApp({
      dbPath: ':memory:',
      autoStartWorkers: false,
      baseUrl: 'http://localhost:3000',
      googleClientId: 'g_id',
      googleClientSecret: 'g_secret',
    } as any);
    const originalFetch = globalThis.fetch;
    const mkJson = (obj: unknown, ok = true) =>
      ({
        ok,
        status: ok ? 200 : 500,
        json: async () => obj,
      } as any);
    globalThis.fetch = (async (url: any) => {
      const s = String(url);
      if (s.includes('oauth2.googleapis.com/token')) return mkJson({ access_token: 'g_tok' });
      if (s.includes('openidconnect.googleapis.com')) {
        return mkJson({ sub: 'google_123', email: 'google.user@example.com', email_verified: true, name: 'Google User' });
      }
      throw new Error(`Unexpected fetch: ${s}`);
    }) as any;
    try {
      runtime4.service.getStore().createOauthState('google', 'gstate123', '/dashboard', new Date(Date.now() + 60_000).toISOString());
      const api = request(runtime4.app);
      const res = await api.get('/auth/oauth/google/callback?code=abc&state=gstate123').expect(302);
      expect(String(res.headers.location)).toBe('/dashboard');
      const sessionRes = await api.get('/auth/session').set('Cookie', res.headers['set-cookie'] ?? []).expect(200);
      expect(sessionRes.body.authenticated).toBe(true);
      expect(sessionRes.body.user.email).toBe('google.user@example.com');
    } finally {
      globalThis.fetch = originalFetch;
      runtime4.stop();
    }
  });

  it('requests password reset link and writes dev email outbox entry', async () => {
    const api = request(runtime.app);
    const res = await api.post('/auth/password-reset/request').send({ email: 'demo.user@example.com' }).expect(200);
    expect(res.body.ok).toBe(true);
    const emails = runtime.service.getStore().listEmailOutbox(20);
    expect(emails.some((e: any) => String(e.subject).includes('Password Reset'))).toBe(true);
  });

  it('completes password reset confirm flow and allows login with new password', async () => {
    const api = request(runtime.app);
    // Ensure credential exists for demo user.
    await api.post('/auth/email/register').send({ email: 'reset.user@example.com', password: 'OldPassword1!', next: '/dashboard' }).expect(201);
    await api.post('/auth/logout').expect(302);

    await api.post('/auth/password-reset/request').send({ email: 'reset.user@example.com' }).expect(200);
    const emails = runtime.service.getStore().listEmailOutbox(50);
    const resetEmail = emails.find((e: any) => String(e.subject).includes('Password Reset') && String(e.to_email) === 'reset.user@example.com') as any;
    expect(resetEmail).toBeTruthy();
    const md = JSON.parse(String(resetEmail.metadata_json ?? '{}'));
    const resetUrl = String(md.reset_url ?? '');
    const token = new URL(resetUrl).searchParams.get('token');
    expect(token).toBeTruthy();

    await api.get(`/auth/password-reset?token=${encodeURIComponent(String(token))}`).expect(200);
    await api
      .post('/auth/password-reset/confirm')
      .send({ token, password: 'NewPassword2!' })
      .expect(200);

    await api.post('/auth/email/login').send({ email: 'reset.user@example.com', password: 'OldPassword1!' }).expect(401);
    await api.post('/auth/email/login').send({ email: 'reset.user@example.com', password: 'NewPassword2!' }).expect(200);
  });

  it('uses app session for /dashboard and redirects unauthenticated users to /auth', async () => {
    const api = request(runtime.app);
    await api.get('/dashboard').expect(302).expect('Location', /\/auth\?mode=signin/);

    const register = await api
      .post('/auth/email/register')
      .send({ email: 'dash.user@example.com', password: 'Password123!', display_name: 'Dash User', next: '/dashboard' })
      .expect(201);
    const cookies = register.headers['set-cookie'] ?? [];

    const dashboard = await api.get('/dashboard').set('Cookie', cookies).expect(200);
    expect(dashboard.text).toContain('Dashboard');
    expect(dashboard.text).toContain('Dash User');
    expect(dashboard.text).not.toContain('切换用户');

    const apiKeys = await api.get('/settings/api-keys').set('Cookie', cookies).expect(200);
    expect(apiKeys.text).toContain('API Key 管理');
    expect(apiKeys.text).not.toContain('切换用户');
  });
});
