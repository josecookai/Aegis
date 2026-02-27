export interface RequestPaymentParams {
  amount: string;
  currency: string;
  recipient_name: string;
  description: string;
  payment_rail: 'card' | 'crypto';
}

export interface ActionResponse {
  action: {
    action_id: string;
    status: string;
    action_type: string;
    end_user_id: string;
    details: {
      amount: string;
      currency: string;
      recipient_name: string;
      description: string;
      payment_rail: string;
      payment_method_preference: string;
      recipient_reference: string;
    };
    callback_url: string;
    expires_at: string;
    created_at: string;
    [key: string]: unknown;
  };
  links?: { approval_url?: string };
}

export interface CapabilitiesResponse {
  end_user_id: string;
  rails: string[];
  methods: Array<{
    id: string;
    rail: string;
    alias: string;
    is_default: boolean;
    [key: string]: unknown;
  }>;
}

export class AegisClient {
  constructor(
    private baseUrl: string,
    private apiKey: string,
    private userId: string,
  ) {}

  private headers(): Record<string, string> {
    return {
      'X-Aegis-API-Key': this.apiKey,
      'Content-Type': 'application/json',
    };
  }

  async requestPayment(params: RequestPaymentParams): Promise<ActionResponse> {
    const idempotencyKey = `mcp_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const railDefaults =
      params.payment_rail === 'crypto'
        ? {
            payment_method_preference: 'crypto_default',
            recipient_reference: 'wallet:mcp',
          }
        : {
            payment_method_preference: 'card_default',
            recipient_reference: 'merchant_api:mcp',
          };
    const res = await fetch(`${this.baseUrl}/v1/request_action`, {
      method: 'POST',
      headers: { ...this.headers(), 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify({
        idempotency_key: idempotencyKey,
        end_user_id: this.userId,
        action_type: 'payment',
        details: {
          amount: params.amount,
          currency: params.currency,
          recipient_name: params.recipient_name,
          description: params.description,
          payment_rail: params.payment_rail,
          payment_method_preference: railDefaults.payment_method_preference,
          recipient_reference: railDefaults.recipient_reference,
        },
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Aegis API error ${res.status}: ${body}`);
    }
    return res.json() as Promise<ActionResponse>;
  }

  async getStatus(actionId: string): Promise<ActionResponse> {
    const res = await fetch(`${this.baseUrl}/v1/actions/${encodeURIComponent(actionId)}`, {
      method: 'GET',
      headers: this.headers(),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Aegis API error ${res.status}: ${body}`);
    }
    return res.json() as Promise<ActionResponse>;
  }

  async cancel(actionId: string, reason?: string): Promise<ActionResponse> {
    const res = await fetch(`${this.baseUrl}/v1/actions/${encodeURIComponent(actionId)}/cancel`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(reason ? { reason } : {}),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Aegis API error ${res.status}: ${body}`);
    }
    return res.json() as Promise<ActionResponse>;
  }

  async capabilities(): Promise<CapabilitiesResponse> {
    const res = await fetch(
      `${this.baseUrl}/v1/payment_methods/capabilities?end_user_id=${encodeURIComponent(this.userId)}`,
      { method: 'GET', headers: this.headers() },
    );
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Aegis API error ${res.status}: ${body}`);
    }
    return res.json() as Promise<CapabilitiesResponse>;
  }
}
