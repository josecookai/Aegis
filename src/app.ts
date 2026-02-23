import express from 'express';
import cookieParser from 'cookie-parser';
import { loadConfig, AppConfig } from './config';
import { createDb } from './db';
import { AegisStore } from './services/store';
import { NotificationService } from './services/notifications';
import { ExecutionEngine } from './services/execution';
import { WebhookSender } from './services/webhookSender';
import { AegisService } from './services/aegis';
import { AdminAuthService } from './services/adminAuth';
import { SandboxFaultService } from './services/sandboxFaults';
import { WebAuthnService } from './services/webauthn';
import { WorkerScheduler } from './workers';
import { createApiRouter } from './routes/api';
import { createAppRouter } from './routes/app';
import { createWebRouter } from './routes/web';

export interface AppRuntime {
  app: express.Express;
  config: AppConfig;
  service: AegisService;
  workers: WorkerScheduler;
  testCallbackInbox: Array<{ headers: Record<string, string>; body: unknown; received_at: string }>;
  stop: () => void;
}

export function createAegisApp(partialConfig?: Partial<AppConfig>): AppRuntime {
  const config = { ...loadConfig(), ...(partialConfig ?? {}) };
  const { db } = createDb(config.dbPath);
  const store = new AegisStore(db);
  const sandboxFaults = new SandboxFaultService();
  const notifications = new NotificationService(store, config);
  const executionEngine = new ExecutionEngine(sandboxFaults, config.stripeSecretKey);
  const webhookSender = new WebhookSender(config);
  const service = new AegisService(store, notifications, executionEngine, webhookSender, config);
  const adminAuth = new AdminAuthService(config);
  const webauthn = new WebAuthnService(store, config);
  const workers = new WorkerScheduler(service);
  const testCallbackInbox: Array<{ headers: Record<string, string>; body: unknown; received_at: string }> = [];

  const app = express();
  app.disable('x-powered-by');
  (app as any).locals.testCallbackInbox = testCallbackInbox;
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false }));
  app.use(cookieParser());

  app.use((req, res, next) => {
    if (!adminAuth.isEnabled()) return next();
    if (!isProtectedPath(req.path)) return next();

    const token = (req.cookies?.[config.adminSessionCookieName] ?? req.cookies?.aegis_admin_session) as string | undefined;
    if (adminAuth.verifySessionToken(token)) return next();

    if (req.path.startsWith('/api/')) {
      res.status(401).json({ error: 'ADMIN_AUTH_REQUIRED', message: 'Admin login required for dev API routes' });
      return;
    }

    const nextParam = encodeURIComponent(req.originalUrl || req.path || '/admin');
    res.redirect(`/login?next=${nextParam}`);
  });

  app.post('/_test/callback', (req, res) => {
    const headers: Record<string, string> = {};
    for (const [k, v] of Object.entries(req.headers)) {
      headers[k] = Array.isArray(v) ? v.join(',') : String(v ?? '');
    }
    testCallbackInbox.push({ headers, body: req.body, received_at: new Date().toISOString() });
    res.status(200).json({ ok: true });
  });

  app.get('/_test/callbacks', (_req, res) => {
    res.json({ callbacks: testCallbackInbox });
  });

  app.use(createWebRouter(service, webauthn, adminAuth, sandboxFaults));
  app.use(createAppRouter(service));
  app.use(createApiRouter(service, sandboxFaults));

  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Unhandled error' });
  });

  if (config.autoStartWorkers) {
    workers.start();
  }

  return {
    app,
    config,
    service,
    workers,
    testCallbackInbox,
    stop: () => {
      workers.stop();
      db.close();
    },
  };
}

function isProtectedPath(pathname: string): boolean {
  return pathname === '/admin' || pathname === '/dev' || pathname.startsWith('/dev/') || pathname.startsWith('/api/dev/');
}
