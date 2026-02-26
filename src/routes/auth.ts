import { Router, Request, Response, NextFunction } from 'express';
import { DomainError, AegisService } from '../services/aegis';
import { addMinutesIso } from '../lib/time';
import { hashPasswordScrypt, randomToken, verifyPasswordScrypt } from '../lib/crypto';
import { renderPasswordResetAuthPage } from '../views';

type OauthProvider = 'google' | 'github';

export function createAuthRouter(service: AegisService): Router {
  const router = Router();
  const config = service.getConfig();
  const store = service.getStore();

  const issueAppSessionCookie = (res: Response, userId: string) => {
    const { token: sessionToken } = store.createAppSession(userId);
    res.cookie(config.appSessionCookieName, sessionToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      maxAge: 12 * 60 * 60 * 1000,
    });
  };

  const providerEnabled = (provider: OauthProvider): boolean => {
    if (provider === 'google') return Boolean(config.googleClientId && config.googleClientSecret);
    return Boolean(config.githubClientId && config.githubClientSecret);
  };

  router.post('/auth/magic-link/request', (req, res, next) => {
    try {
      const email = String(req.body?.email ?? '').trim().toLowerCase();
      if (!email) throw new DomainError('MISSING_EMAIL', 'email is required', 400);
      const endUser = store.listEndUsers().find((u) => u.email.toLowerCase() === email);
      if (!endUser || endUser.status !== 'active') {
        return res.json({ ok: true, message: 'If an account exists, a login link was sent.' });
      }
      const expiresAt = addMinutesIso(new Date().toISOString(), 15);
      const { token } = store.createMagicLink(endUser.id, null, 'login', expiresAt);
      const loginUrl = `${config.baseUrl}/auth/magic-link/verify?token=${encodeURIComponent(token)}`;
      service.getNotifications().sendMagicLinkEmail({
        toEmail: endUser.email,
        userName: endUser.display_name,
        loginUrl,
        expiresAt,
      });
      res.json({ ok: true, message: 'If an account exists, a login link was sent.' });
    } catch (error) {
      next(error);
    }
  });

  router.post('/auth/password-reset/request', (req, res, next) => {
    try {
      const email = normalizeEmail(req.body?.email);
      if (!email) throw new DomainError('MISSING_EMAIL', 'email is required', 400);
      const endUser = store.getEndUserByEmailNormalized(email);
      if (!endUser || endUser.status !== 'active') {
        return res.json({ ok: true, message: 'If an account exists, a password reset link was sent.' });
      }
      const expiresAt = addMinutesIso(new Date().toISOString(), 15);
      const { token } = store.createMagicLink(endUser.id, null, 'password_reset', expiresAt);
      const resetUrl = `${config.baseUrl}/auth/password-reset?token=${encodeURIComponent(token)}`;
      service.getNotifications().sendPasswordResetEmail({
        toEmail: endUser.email,
        userName: endUser.display_name,
        resetUrl,
        expiresAt,
      });
      res.json({ ok: true, message: 'If an account exists, a password reset link was sent.' });
    } catch (error) {
      handleAuthRouteError(req, res, next, error);
    }
  });

  router.get('/auth/password-reset', (req, res, next) => {
    try {
      const token = String(req.query.token ?? '').trim();
      if (!token) throw new DomainError('MISSING_TOKEN', 'token is required', 400);
      const resolved = store.resolveMagicLink(token);
      if (!resolved || resolved.purpose !== 'password_reset') throw new DomainError('INVALID_TOKEN', 'Invalid or expired link', 400);
      if (resolved.consumedAt) throw new DomainError('INVALID_TOKEN', 'Link already used', 400);
      if (new Date(resolved.expiresAt).getTime() < Date.now()) throw new DomainError('EXPIRED_TOKEN', 'Link has expired', 400);
      const endUser = store.getEndUserById(resolved.userId);
      if (!endUser || endUser.status !== 'active') throw new DomainError('INVALID_USER', 'User not found', 403);
      res.type('html').send(renderPasswordResetAuthPage({ token, email: endUser.email }));
    } catch (error) {
      if (error instanceof DomainError) {
        res.status(error.httpStatus).type('html').send(renderPasswordResetAuthPage({ error: error.message }));
        return;
      }
      next(error);
    }
  });

  router.get('/auth/magic-link/verify', (req, res, next) => {
    try {
      const token = String(req.query.token ?? '').trim();
      if (!token) throw new DomainError('MISSING_TOKEN', 'token is required', 400);
      const resolved = store.resolveMagicLink(token);
      if (!resolved || resolved.purpose !== 'login') throw new DomainError('INVALID_TOKEN', 'Invalid or expired link', 400);
      if (new Date(resolved.expiresAt).getTime() < Date.now()) throw new DomainError('EXPIRED_TOKEN', 'Link has expired', 400);
      const endUser = store.getEndUserById(resolved.userId);
      if (!endUser || endUser.status !== 'active') throw new DomainError('INVALID_USER', 'User not found', 403);
      store.consumeMagicLink(resolved.magicLinkId);
      issueAppSessionCookie(res, resolved.userId);
      const nextPath = sanitizeNextPath(String(req.query.next ?? '/dashboard'));
      res.redirect(nextPath);
    } catch (error) {
      next(error);
    }
  });

  router.post('/auth/email/register', (req, res, next) => {
    try {
      const email = normalizeEmail(req.body?.email);
      const password = String(req.body?.password ?? '');
      const displayName = String(req.body?.display_name ?? '').trim() || null;
      const nextPath = sanitizeNextPath(String(req.body?.next ?? req.query.next ?? '/dashboard'));
      if (!email) throw new DomainError('MISSING_EMAIL', 'email is required', 400);
      if (!isValidEmail(email)) throw new DomainError('INVALID_EMAIL', 'email must be valid', 400);
      if (!password) throw new DomainError('MISSING_PASSWORD', 'password is required', 400);
      if (password.length < 8) throw new DomainError('WEAK_PASSWORD', 'password must be at least 8 characters', 400);
      if (store.getUserCredentialByEmail(email)) throw new DomainError('EMAIL_ALREADY_REGISTERED', 'Email already registered', 409);

      let endUser = store.getEndUserByEmailNormalized(email);
      if (!endUser) endUser = store.createEndUserForAuth(email, displayName);
      if (endUser.status !== 'active') throw new DomainError('INACTIVE_USER', 'User account is inactive', 403);

      store.createUserCredential(endUser.id, email, hashPasswordScrypt(password, config.passwordHashPepper ?? 'aegis_password_pepper_dev_only'));
      issueAppSessionCookie(res, endUser.id);
      if (prefersHtml(req)) return res.redirect(nextPath);
      res.status(201).json({ ok: true, user: publicUser(endUser), next: nextPath });
    } catch (error) {
      handleAuthRouteError(req, res, next, error);
    }
  });

  router.post('/auth/email/login', (req, res, next) => {
    try {
      const email = normalizeEmail(req.body?.email);
      const password = String(req.body?.password ?? '');
      const nextPath = sanitizeNextPath(String(req.body?.next ?? req.query.next ?? '/dashboard'));
      if (!email) throw new DomainError('MISSING_EMAIL', 'email is required', 400);
      if (!password) throw new DomainError('MISSING_PASSWORD', 'password is required', 400);
      const credential = store.getUserCredentialByEmail(email);
      if (!credential) throw new DomainError('INVALID_CREDENTIALS', 'Invalid email or password', 401);
      if (!verifyPasswordScrypt(password, config.passwordHashPepper ?? 'aegis_password_pepper_dev_only', credential.password_hash)) {
        throw new DomainError('INVALID_CREDENTIALS', 'Invalid email or password', 401);
      }
      const endUser = store.getEndUserById(credential.user_id);
      if (!endUser || endUser.status !== 'active') throw new DomainError('INACTIVE_USER', 'User account is inactive', 403);
      store.touchUserCredentialLogin(credential.id);
      issueAppSessionCookie(res, endUser.id);
      if (prefersHtml(req)) return res.redirect(nextPath);
      res.json({ ok: true, user: publicUser(endUser), next: nextPath });
    } catch (error) {
      handleAuthRouteError(req, res, next, error);
    }
  });

  router.post('/auth/password-reset/confirm', (req, res, next) => {
    try {
      const token = String(req.body?.token ?? '').trim();
      const password = String(req.body?.password ?? '');
      if (!token) throw new DomainError('MISSING_TOKEN', 'token is required', 400);
      if (!password) throw new DomainError('MISSING_PASSWORD', 'password is required', 400);
      if (password.length < 8) throw new DomainError('WEAK_PASSWORD', 'password must be at least 8 characters', 400);
      const resolved = store.resolveMagicLink(token);
      if (!resolved || resolved.purpose !== 'password_reset') throw new DomainError('INVALID_TOKEN', 'Invalid or expired link', 400);
      if (resolved.consumedAt) throw new DomainError('INVALID_TOKEN', 'Link already used', 400);
      if (new Date(resolved.expiresAt).getTime() < Date.now()) throw new DomainError('EXPIRED_TOKEN', 'Link has expired', 400);
      const endUser = store.getEndUserById(resolved.userId);
      if (!endUser || endUser.status !== 'active') throw new DomainError('INACTIVE_USER', 'User account is inactive', 403);
      const credential = store.getUserCredentialByEmail(endUser.email.toLowerCase());
      if (!credential) throw new DomainError('INVALID_CREDENTIALS', 'Password login is not enabled for this account', 400);
      store.updateUserCredentialPasswordByEmail(
        endUser.email.toLowerCase(),
        hashPasswordScrypt(password, config.passwordHashPepper ?? 'aegis_password_pepper_dev_only')
      );
      store.consumeMagicLink(resolved.magicLinkId);
      if (prefersHtml(req)) return res.redirect('/auth?mode=signin');
      res.json({ ok: true, message: 'Password updated' });
    } catch (error) {
      if (error instanceof DomainError && prefersHtml(req)) {
        res.status(error.httpStatus).type('html').send(renderPasswordResetAuthPage({ token: String(req.body?.token ?? ''), error: error.message }));
        return;
      }
      handleAuthRouteError(req, res, next, error);
    }
  });

  router.get('/auth/oauth/:provider/start', (req, res, next) => {
    void (async () => {
      try {
        const provider = parseProvider(req.params.provider);
        if (!providerEnabled(provider)) throw new DomainError('OAUTH_PROVIDER_NOT_ENABLED', `${provider} auth is not enabled`, 400);
        const nextPath = sanitizeNextPath(String(req.query.next ?? '/dashboard'));
        const state = randomToken(16);
        const expiresAt = addMinutesIso(new Date().toISOString(), config.authOauthStateTtlMinutes ?? 10);
        store.createOauthState(provider, state, nextPath, expiresAt);
        const redirectUrl = buildOauthAuthorizeUrl(config, provider, state);
        res.redirect(redirectUrl);
      } catch (error) {
        handleAuthRouteError(req, res, next, error);
      }
    })();
  });

  router.get('/auth/oauth/:provider/callback', (req, res, next) => {
    void (async () => {
      try {
        const provider = parseProvider(req.params.provider);
        if (!providerEnabled(provider)) throw new DomainError('OAUTH_PROVIDER_NOT_ENABLED', `${provider} auth is not enabled`, 400);
        const code = String(req.query.code ?? '').trim();
        const state = String(req.query.state ?? '').trim();
        if (!code) throw new DomainError('OAUTH_MISSING_CODE', 'Missing OAuth code', 400);
        if (!state) throw new DomainError('OAUTH_INVALID_STATE', 'Missing OAuth state', 400);
        const stateRow = store.consumeOauthState(provider, state);
        if (!stateRow) throw new DomainError('OAUTH_INVALID_STATE', 'Invalid OAuth state', 400);
        if (new Date(stateRow.expires_at).getTime() < Date.now()) throw new DomainError('OAUTH_STATE_EXPIRED', 'OAuth state expired', 400);

        const profile = await exchangeOAuthAndFetchProfile(config, provider, code);
        const email = normalizeEmail(profile.email);
        if (!email) throw new DomainError('OAUTH_EMAIL_REQUIRED', 'OAuth provider did not return an email', 400);

        let endUser = store.getEndUserByEmailNormalized(email);
        if (!endUser) endUser = store.createEndUserForAuth(email, profile.name);
        if (endUser.status !== 'active') throw new DomainError('INACTIVE_USER', 'User account is inactive', 403);

        store.upsertOauthIdentity({
          userId: endUser.id,
          provider,
          providerUserId: profile.providerUserId,
          emailNormalized: email,
          emailVerified: !!profile.emailVerified,
          profile: profile.raw,
        });
        issueAppSessionCookie(res, endUser.id);
        res.redirect(stateRow.next_path || '/dashboard');
      } catch (error) {
        if (prefersHtml(req) && error instanceof DomainError) {
          const code = encodeURIComponent(error.code);
          return res.redirect(`/auth?mode=signin&error=${code}`);
        }
        handleAuthRouteError(req, res, next, error);
      }
    })();
  });

  router.get('/auth/session', (req, res) => {
    const token = String((req as any).cookies?.[config.appSessionCookieName] ?? '').trim();
    if (!token) return res.json({ authenticated: false });
    const session = store.verifyAppSession(token);
    if (!session) return res.json({ authenticated: false });
    const endUser = store.getEndUserById(session.userId);
    if (!endUser || endUser.status !== 'active') return res.json({ authenticated: false });
    res.json({ authenticated: true, user: publicUser(endUser) });
  });

  router.get('/auth/oauth/providers', (_req, res) => {
    res.json({
      google: {
        enabled: Boolean(config.googleClientId && config.googleClientSecret),
        client_id_configured: Boolean(config.googleClientId),
        client_secret_configured: Boolean(config.googleClientSecret),
        redirect_uri: config.googleOauthRedirectUri || `${config.baseUrl}/auth/oauth/google/callback`,
      },
      github: {
        enabled: Boolean(config.githubClientId && config.githubClientSecret),
        client_id_configured: Boolean(config.githubClientId),
        client_secret_configured: Boolean(config.githubClientSecret),
        redirect_uri: config.githubOauthRedirectUri || `${config.baseUrl}/auth/oauth/github/callback`,
      },
    });
  });

  router.post('/auth/logout', (req, res) => {
    const token = (req as any).cookies?.[config.appSessionCookieName];
    if (token) store.deleteAppSessionByToken(token);
    res.clearCookie(config.appSessionCookieName);
    res.redirect('/');
  });

  router.use((error: unknown, req: Request, res: Response, next: NextFunction) => {
    if (!(error instanceof DomainError)) return next(error);
    if (prefersHtml(req)) {
      const mode = String(req.body?.mode ?? req.query.mode ?? 'signin');
      const code = encodeURIComponent(error.code);
      const nextPath = sanitizeNextPath(String(req.body?.next ?? req.query.next ?? '/dashboard'));
      return res.redirect(`/auth?mode=${encodeURIComponent(mode)}&error=${code}&next=${encodeURIComponent(nextPath)}`);
    }
    res.status(error.httpStatus).json({ error: error.code, code: error.code, message: error.message });
  });

  return router;
}

function parseProvider(input: string): OauthProvider {
  if (input === 'google' || input === 'github') return input;
  throw new DomainError('OAUTH_PROVIDER_NOT_ENABLED', 'Unsupported OAuth provider', 400);
}

function normalizeEmail(input: unknown): string {
  return String(input ?? '').trim().toLowerCase();
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function sanitizeNextPath(input: string): string {
  const value = String(input || '/dashboard').trim();
  if (!value.startsWith('/')) return '/dashboard';
  if (value.startsWith('//')) return '/dashboard';
  return value;
}

function prefersHtml(req: Request): boolean {
  const contentType = String(req.headers['content-type'] ?? '');
  if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) return true;
  const accept = String(req.headers.accept ?? '');
  return accept.includes('text/html');
}

function publicUser(endUser: { id: string; email: string; display_name: string }) {
  return { id: endUser.id, email: endUser.email, display_name: endUser.display_name };
}

function handleAuthRouteError(req: Request, res: Response, next: NextFunction, error: unknown): void {
  if (error instanceof DomainError) {
    if (prefersHtml(req)) {
      const mode = String(req.body?.mode ?? req.query.mode ?? 'signin');
      const code = encodeURIComponent(error.code);
      const nextPath = sanitizeNextPath(String(req.body?.next ?? req.query.next ?? '/dashboard'));
      res.redirect(`/auth?mode=${encodeURIComponent(mode)}&error=${code}&next=${encodeURIComponent(nextPath)}`);
      return;
    }
    res.status(error.httpStatus).json({ error: error.code, code: error.code, message: error.message });
    return;
  }
  next(error);
}

function buildOauthAuthorizeUrl(config: ReturnType<AegisService['getConfig']>, provider: OauthProvider, state: string): string {
  if (provider === 'google') {
    const params = new URLSearchParams({
      client_id: String(config.googleClientId),
      redirect_uri: config.googleOauthRedirectUri || `${config.baseUrl}/auth/oauth/google/callback`,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      access_type: 'offline',
      prompt: 'consent',
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }
  const params = new URLSearchParams({
    client_id: String(config.githubClientId),
    redirect_uri: config.githubOauthRedirectUri || `${config.baseUrl}/auth/oauth/github/callback`,
    scope: 'read:user user:email',
    state,
  });
  return `https://github.com/login/oauth/authorize?${params.toString()}`;
}

async function exchangeOAuthAndFetchProfile(
  config: ReturnType<AegisService['getConfig']>,
  provider: OauthProvider,
  code: string
): Promise<{ providerUserId: string; email: string; emailVerified: boolean; name: string; raw: Record<string, unknown> }> {
  if (provider === 'google') {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: String(config.googleClientId),
        client_secret: String(config.googleClientSecret),
        redirect_uri: config.googleOauthRedirectUri || `${config.baseUrl}/auth/oauth/google/callback`,
        grant_type: 'authorization_code',
      }),
    });
    if (!tokenRes.ok) throw new DomainError('OAUTH_TOKEN_EXCHANGE_FAILED', 'Failed to exchange OAuth token', 502);
    const tokenData = (await tokenRes.json()) as Record<string, unknown>;
    const accessToken = String(tokenData.access_token ?? '');
    if (!accessToken) throw new DomainError('OAUTH_TOKEN_EXCHANGE_FAILED', 'Missing access token', 502);
    const profileRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    if (!profileRes.ok) throw new DomainError('OAUTH_PROFILE_FETCH_FAILED', 'Failed to load Google profile', 502);
    const profile = (await profileRes.json()) as Record<string, unknown>;
    return {
      providerUserId: String(profile.sub ?? ''),
      email: String(profile.email ?? ''),
      emailVerified: Boolean(profile.email_verified),
      name: String(profile.name ?? profile.given_name ?? ''),
      raw: profile,
    };
  }

  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: String(config.githubClientId),
      client_secret: String(config.githubClientSecret),
      redirect_uri: config.githubOauthRedirectUri || `${config.baseUrl}/auth/oauth/github/callback`,
    }),
  });
  if (!tokenRes.ok) throw new DomainError('OAUTH_TOKEN_EXCHANGE_FAILED', 'Failed to exchange OAuth token', 502);
  const tokenData = (await tokenRes.json()) as Record<string, unknown>;
  const accessToken = String(tokenData.access_token ?? '');
  if (!accessToken) throw new DomainError('OAUTH_TOKEN_EXCHANGE_FAILED', 'Missing access token', 502);
  const [userRes, emailsRes] = await Promise.all([
    fetch('https://api.github.com/user', { headers: { authorization: `Bearer ${accessToken}`, 'user-agent': 'Aegis-MVP' } }),
    fetch('https://api.github.com/user/emails', { headers: { authorization: `Bearer ${accessToken}`, 'user-agent': 'Aegis-MVP' } }),
  ]);
  if (!userRes.ok || !emailsRes.ok) throw new DomainError('OAUTH_PROFILE_FETCH_FAILED', 'Failed to load GitHub profile', 502);
  const user = (await userRes.json()) as Record<string, unknown>;
  const emails = (await emailsRes.json()) as Array<Record<string, unknown>>;
  const selected =
    emails.find((e) => e.primary && e.verified) ??
    emails.find((e) => e.verified) ??
    emails.find((e) => typeof e.email === 'string');
  return {
    providerUserId: String(user.id ?? ''),
    email: String(selected?.email ?? ''),
    emailVerified: Boolean(selected?.verified),
    name: String(user.name ?? user.login ?? ''),
    raw: { user, emails },
  };
}
