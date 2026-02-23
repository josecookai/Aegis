/**
 * Aegis backend base URL. For dev use your machine IP or localhost with Expo tunnel.
 */
import { pickApiErrorMessage } from '../../src/mobile/apiError';

/** Dev: use your machine IP (e.g. 192.168.x.x:3000) if testing on device; localhost works in simulator. */
export const API_BASE =
  (typeof __DEV__ !== 'undefined' && __DEV__) || process.env.NODE_ENV !== 'production'
    ? (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000')
    : 'https://api.aegis.com';

export interface ApprovalAction {
  action_id: string;
  status: string;
  action_type: string;
  end_user_id: string;
  details: {
    amount: string;
    currency: string;
    recipient_name: string;
    description?: string;
  };
  callback_url: string;
  expires_at: string;
}

export interface ApprovalResponse {
  valid: boolean;
  reason?: string;
  token?: string;
  already_decided?: boolean;
  decision?: { decision: string; source: string; submitted_at: string } | null;
  action?: ApprovalAction;
  end_user?: { id: string; email: string; display_name: string };
}

export async function getApproval(token: string): Promise<ApprovalResponse> {
  const res = await fetch(
    `${API_BASE}/api/app/approval?token=${encodeURIComponent(token)}`
  );
  const data = await res.json();
  if (!res.ok) {
    // Preserve structured invalid-token reasons from backend (`{ valid: false, reason }`)
    const err = new Error(pickApiErrorMessage(data, 'Failed to load approval')) as Error & { body?: unknown };
    err.body = data;
    throw err;
  }
  return data;
}

export async function submitDecision(
  token: string,
  decision: 'approve' | 'deny',
  decisionSource: 'app_biometric' | 'web_magic_link' = 'app_biometric'
): Promise<{ ok: boolean; action_id: string; request_id: string; status: string }> {
  const res = await fetch(`${API_BASE}/api/app/approval/decision`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token,
      decision,
      decision_source: decisionSource,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(pickApiErrorMessage(data, 'Failed to submit decision'));
  return data;
}
