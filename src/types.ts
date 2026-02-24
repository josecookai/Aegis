export const ACTION_STATUSES = [
  'received',
  'validation_failed',
  'awaiting_approval',
  'approved',
  'denied',
  'expired',
  'executing',
  'succeeded',
  'failed',
  'canceled',
] as const;

export type ActionStatus = (typeof ACTION_STATUSES)[number];

export const TERMINAL_STATUSES = new Set<ActionStatus>([
  'validation_failed',
  'denied',
  'expired',
  'succeeded',
  'failed',
  'canceled',
]);

export type PaymentRail = 'card' | 'crypto';
export type DecisionSource = 'web_passkey' | 'web_otp' | 'web_magic_link' | 'app_biometric';

export type WebhookEventType =
  | 'action.approved'
  | 'action.denied'
  | 'action.succeeded'
  | 'action.failed'
  | 'action.expired'
  | 'action.canceled';

export type ExecutionFailureCode =
  | 'PSP_DECLINED'
  | 'PSP_REQUIRES_ACTION'
  | 'PSP_INCOMPLETE'
  | 'PSP_ERROR'
  | 'CHAIN_REVERTED'
  | 'INSUFFICIENT_FUNDS'
  | 'TIMEOUT'
  | 'UNSUPPORTED_RECIPIENT'
  | 'INVALID_PAYMENT_METHOD'
  | 'PROVIDER_UNAVAILABLE';

export interface ActionDetailsInput {
  amount: string;
  currency: string;
  recipient_name: string;
  description: string;
  payment_rail: PaymentRail;
  payment_method_preference: string;
  recipient_reference: string;
}

export interface RequestActionInput {
  idempotency_key: string;
  end_user_id: string;
  action_type: 'payment';
  details: ActionDetailsInput;
  callback_url?: string;
  expires_at?: string;
  metadata?: Record<string, unknown>;
}

export interface AgentRecord {
  id: string;
  name: string;
  api_key_hash: string;
  webhook_secret: string;
  status: 'active' | 'disabled';
  owner_user_id: string | null;
  created_at: string;
}

export interface EndUserRecord {
  id: string;
  email: string;
  display_name: string;
  status: 'active' | 'disabled';
  created_at: string;
}

export interface PaymentMethodRecord {
  id: string;
  end_user_id: string;
  rail: PaymentRail;
  alias: string;
  external_token: string;
  metadata_json: string;
  is_default: number;
  created_at: string;
}

export interface ActionRecord {
  id: string;
  agent_id: string;
  end_user_id: string;
  idempotency_key: string;
  action_type: 'payment';
  status: ActionStatus;
  status_reason: string | null;
  amount: string;
  currency: string;
  recipient_name: string;
  description: string;
  payment_rail: PaymentRail;
  payment_method_preference: string;
  recipient_reference: string;
  callback_url: string;
  expires_at: string;
  metadata_json: string;
  approved_at: string | null;
  denied_at: string | null;
  terminal_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ActionApiResponse {
  action_id: string;
  status: ActionStatus;
  action_type: 'payment';
  end_user_id: string;
  details: ActionDetailsInput;
  callback_url: string;
  expires_at: string;
  created_at: string;
  metadata: Record<string, unknown>;
  audit_count?: number;
    execution?: {
      rail: PaymentRail;
      status: string;
      provider_reference?: string | null;
      tx_hash?: string | null;
      payment_id?: string | null;
      error_code?: string | null;
      error_message?: string | null;
      sandbox_injected_fault?: string | null;
    } | null;
}

export interface ActionContext {
  action: ActionRecord;
  agent: AgentRecord;
  endUser: EndUserRecord;
}

export interface ExecutionResult {
  success: boolean;
  rail: PaymentRail;
  provider: string;
  providerReference?: string;
  paymentId?: string;
  txHash?: string;
  errorCode?: ExecutionFailureCode;
  errorMessage?: string;
  raw?: Record<string, unknown>;
}

export interface WebhookPayload {
  event_id: string;
  event_type: WebhookEventType;
  occurred_at: string;
  action: {
    id: string;
    status: ActionStatus;
    end_user_id: string;
    amount: string;
    currency: string;
    recipient_name: string;
    description: string;
    payment_rail: PaymentRail;
    recipient_reference: string;
    metadata: Record<string, unknown>;
  };
  execution?: {
    rail: PaymentRail;
    status: 'succeeded' | 'failed';
    provider: string;
    provider_reference?: string;
    payment_id?: string;
    tx_hash?: string;
    error_code?: string;
    error_message?: string;
  };
}
