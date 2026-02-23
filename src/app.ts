import express from 'express';
import cookieParser from 'cookie-parser';
import { loadConfig, AppConfig } from './config';
import { createDb } from './db';
import { AegisStore } from './services/store';
import { NotificationService } from './services/notifications';
import { ExecutionEngine } from './services/execution';
import { WebhookSender } from './services/webhookSender';
import { AegisService } from './services/aegis';
import { WorkerScheduler } from './workers';
import { createApiRouter } from './routes/api';
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
  const notifications = new NotificationService(store, config);
  const executionEngine = new ExecutionEngine();
  const webhookSender = new WebhookSender(config);
  const service = new AegisService(store, notifications, executionEngine, webhookSender, config);
  const workers = new WorkerScheduler(service);
  const testCallbackInbox: Array<{ headers: Record<string, string>; body: unknown; received_at: string }> = [];

  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false }));
  app.use(cookieParser());

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

  app.use(createWebRouter(service));
  app.use(createApiRouter(service));

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
