import { AppConfig } from '../config';
import { hmacSha256Hex } from '../lib/crypto';
import { unixTsSeconds } from '../lib/time';
import { WebhookDeliveryRecord } from './store';

export interface WebhookSendResult {
  ok: boolean;
  status: number | null;
  error?: string;
}

export class WebhookSender {
  constructor(private readonly config: AppConfig) {}

  async deliver(delivery: WebhookDeliveryRecord, agentWebhookSecret: string): Promise<WebhookSendResult> {
    const payload = delivery.payload_json;
    const ts = unixTsSeconds();
    const message = `${ts}.${payload}`;
    const signature = hmacSha256Hex(agentWebhookSecret || this.config.webhookSigningSecret, message);

    try {
      const res = await fetch(delivery.callback_url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-aegis-signature': `t=${ts},v1=${signature}`,
          'x-aegis-event-id': delivery.event_id,
          'x-aegis-event-type': delivery.event_type,
        },
        body: payload,
      });

      if (res.ok) {
        return { ok: true, status: res.status };
      }
      const text = await res.text().catch(() => '');
      return { ok: false, status: res.status, error: text || `HTTP ${res.status}` };
    } catch (error) {
      return { ok: false, status: null, error: error instanceof Error ? error.message : String(error) };
    }
  }
}
