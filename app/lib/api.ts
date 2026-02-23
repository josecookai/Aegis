/**
 * Aegis backend API client for the mobile app.
 */
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { pickApiErrorMessage } from './apiError';

/** MVP 默认用户 ID，后续替换为 session 中的动态值 */
export const DEFAULT_USER_ID = 'usr_demo';

const BACKEND_PORT = '3000';

/**
 * Auto-detect the backend URL so both simulators and real devices work
 * without manual configuration:
 *   - EXPO_PUBLIC_API_URL env var overrides everything
 *   - In dev, extracts the host machine IP from Expo's dev server hostUri
 *   - Android emulator uses the special 10.0.2.2 alias for host
 *   - Falls back to localhost (works on iOS simulator)
 */
function resolveApiBase(): string {
  if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL;

  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    const hostUri =
      (Constants.expoConfig as any)?.hostUri ??
      (Constants as any).manifest?.debuggerHost ??
      (Constants as any).manifest2?.extra?.expoGo?.debuggerHost;
    if (hostUri) {
      const ip = hostUri.split(':')[0];
      return `http://${ip}:${BACKEND_PORT}`;
    }
    if (Platform.OS === 'android') return `http://10.0.2.2:${BACKEND_PORT}`;
    return `http://localhost:${BACKEND_PORT}`;
  }

  return 'https://api.aegis.com';
}

export const API_BASE = resolveApiBase();

async function parseResponseJson<T = unknown>(res: Response, fallbackMessage: string): Promise<T> {
  let data: any;
  try {
    data = await res.json();
  } catch {
    if (!res.ok) {
      throw new Error(`${fallbackMessage} (HTTP ${res.status})`);
    }
    throw new Error(`${fallbackMessage}: invalid JSON response`);
  }
  if (!res.ok) {
    const err = new Error(pickApiErrorMessage(data, `${fallbackMessage} (HTTP ${res.status})`)) as Error & { body?: unknown };
    err.body = data;
    throw err;
  }
  return data as T;
}

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
  created_at?: string;
  magic_link_token?: string;
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

export interface PendingResponse {
  items: ApprovalAction[];
  count: number;
}

export interface HistoryResponse {
  items: ApprovalAction[];
  total: number;
  limit: number;
  offset: number;
}

export async function getApproval(token: string): Promise<ApprovalResponse> {
  const res = await fetch(
    `${API_BASE}/api/app/approval?token=${encodeURIComponent(token)}`
  );
  return parseResponseJson<ApprovalResponse>(res, 'Failed to load approval');
}

export async function getApprovalByActionId(actionId: string, userId = DEFAULT_USER_ID): Promise<ApprovalResponse> {
  const res = await fetch(
    `${API_BASE}/api/app/approval?action_id=${encodeURIComponent(actionId)}&user_id=${encodeURIComponent(userId)}`
  );
  return parseResponseJson<ApprovalResponse>(res, 'Failed to load approval');
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
  return parseResponseJson(res, 'Failed to submit decision');
}

export async function submitDecisionByActionId(
  actionId: string,
  decision: 'approve' | 'deny',
  userId = DEFAULT_USER_ID,
  decisionSource: 'app_biometric' | 'web_magic_link' = 'app_biometric'
): Promise<{ ok: boolean; action_id: string; request_id: string; status: string }> {
  const res = await fetch(`${API_BASE}/api/app/approval/decision`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action_id: actionId,
      user_id: userId,
      decision,
      decision_source: decisionSource,
    }),
  });
  return parseResponseJson(res, 'Failed to submit decision');
}

export async function getPending(userId = DEFAULT_USER_ID): Promise<PendingResponse> {
  const res = await fetch(
    `${API_BASE}/api/app/pending?user_id=${encodeURIComponent(userId)}`
  );
  return parseResponseJson<PendingResponse>(res, '获取待审批列表失败');
}

export async function getHistory(
  userId = DEFAULT_USER_ID,
  limit = 50,
  offset = 0
): Promise<HistoryResponse> {
  const res = await fetch(
    `${API_BASE}/api/app/history?user_id=${encodeURIComponent(userId)}&limit=${limit}&offset=${offset}`
  );
  return parseResponseJson<HistoryResponse>(res, '获取历史记录失败');
}
