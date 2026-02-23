import { createHmac, timingSafeEqual } from 'node:crypto';

export type PaymentRail = 'card' | 'crypto';

export interface RequestActionPayload {
  idempotency_key: string;
  end_user_id: string;
  action_type: 'payment';
  details: {
    amount: string;
    currency: string;
    recipient_name: string;
    description: string;
    payment_rail: PaymentRail;
    payment_method_preference: string;
    recipient_reference: string;
  };
  callback_url: string;
  expires_at?: string;
  metadata?: Record<string, unknown>;
}

export interface AegisClientOptions {
  baseUrl: string;
  apiKey: string;
}

export class AegisClient {
  constructor(private readonly opts: AegisClientOptions) {}

  async requestAction(payload: RequestActionPayload): Promise<any> {
    return this.post('/v1/request_action', payload);
  }

  async getAction(actionId: string): Promise<any> {
    return this.get(`/v1/actions/${encodeURIComponent(actionId)}`);
  }

  async cancelAction(actionId: string): Promise<any> {
    return this.post(`/v1/actions/${encodeURIComponent(actionId)}/cancel`, {});
  }

  async getCapabilities(endUserId: string): Promise<any> {
    const url = new URL('/v1/payment_methods/capabilities', this.opts.baseUrl);
    url.searchParams.set('end_user_id', endUserId);
    return this.fetchJson(url.toString(), { method: 'GET' });
  }

  async sendWebhookTest(callbackUrl: string): Promise<any> {
    return this.post('/v1/webhooks/test', { callback_url: callbackUrl });
  }

  private async get(path: string): Promise<any> {
    return this.fetchJson(new URL(path, this.opts.baseUrl).toString(), { method: 'GET' });
  }

  private async post(path: string, body: unknown): Promise<any> {
    return this.fetchJson(new URL(path, this.opts.baseUrl).toString(), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  private async fetchJson(url: string, init: RequestInit): Promise<any> {
    const res = await fetch(url, {
      ...init,
      headers: {
        'x-aegis-api-key': this.opts.apiKey,
        ...(init.headers ?? {}),
      },
    });
    const text = await res.text();
    const data = text ? JSON.parse(text) : null;
    if (!res.ok) {
      const err = new Error(data?.message || `Aegis API error ${res.status}`) as Error & { status?: number; body?: any };
      err.status = res.status;
      err.body = data;
      throw err;
    }
    return data;
  }
}

export function verifyWebhookSignature(params: {
  rawBody: string;
  signatureHeader: string;
  secret: string;
  toleranceSeconds?: number;
  now?: Date;
}): boolean {
  const { rawBody, signatureHeader, secret } = params;
  const toleranceSeconds = params.toleranceSeconds ?? 300;
  const now = params.now ?? new Date();

  const parts = new Map<string, string>();
  for (const part of signatureHeader.split(',')) {
    const [k, v] = part.split('=');
    if (k && v) parts.set(k.trim(), v.trim());
  }
  const ts = Number(parts.get('t'));
  const v1 = parts.get('v1');
  if (!Number.isFinite(ts) || !v1) return false;

  if (Math.abs(Math.floor(now.getTime() / 1000) - ts) > toleranceSeconds) {
    return false;
  }

  const expected = createHmac('sha256', secret).update(`${ts}.${rawBody}`).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(v1);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
