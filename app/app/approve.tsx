import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as LocalAuthentication from 'expo-local-authentication';
import {
  getApproval,
  getApprovalByActionId,
  submitDecision,
  submitDecisionByActionId,
  DEFAULT_USER_ID,
  type ApprovalResponse,
} from '../lib/api';
import { determineApproveDecisionSource } from '../lib/approvalDecision';

type ResultState = 'approved' | 'denied' | null;

export default function ApproveScreen() {
  const { token, action_id } = useLocalSearchParams<{ token?: string; action_id?: string }>();
  const router = useRouter();
  const [data, setData] = useState<ApprovalResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [resultState, setResultState] = useState<ResultState>(null);

  const hasIdentifier = Boolean(token || action_id);

  const loadApproval = useCallback(() => {
    if (!token && !action_id) {
      setError('缺少审批参数（token 或 action_id）');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const promise = token ? getApproval(token) : getApprovalByActionId(action_id!);
    promise
      .then(setData)
      .catch((e) => setError(e.message ?? '加载失败'))
      .finally(() => setLoading(false));
  }, [token, action_id]);

  useEffect(() => {
    loadApproval();
  }, [loadApproval]);

  const doSubmit = async (decision: 'approve' | 'deny', source: 'app_biometric' | 'web_magic_link' = 'app_biometric') => {
    if (token) {
      return submitDecision(token, decision, source);
    }
    return submitDecisionByActionId(action_id!, decision, DEFAULT_USER_ID, source);
  };

  const handleApprove = async () => {
    if (!hasIdentifier || !data?.valid || data.already_decided) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const supported = await LocalAuthentication.supportedAuthenticationTypesAsync();
      if (!hasHardware || supported.length === 0) {
        const noBiometric = determineApproveDecisionSource({
          hasHardware,
          supportedCount: supported.length,
          authSuccess: false,
        });
        setSubmitError(noBiometric.reason || '该设备不支持生物识别');
        return;
      }
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: '验证身份以批准该支付',
        cancelLabel: '取消',
      });
      const decisionSource = determineApproveDecisionSource({
        hasHardware,
        supportedCount: supported.length,
        authSuccess: result.success,
      });
      if (!decisionSource.proceed || !decisionSource.source) {
        setSubmitError(decisionSource.reason || '未完成生物识别验证');
        return;
      }
      await doSubmit('approve', decisionSource.source);
      setResultState('approved');
    } catch (e) {
      setSubmitError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeny = async () => {
    if (!hasIdentifier || !data?.valid || data.already_decided) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await doSubmit('deny');
      setResultState('denied');
    } catch (e) {
      setSubmitError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  // ---------- Result View ----------
  if (resultState) {
    const isApproved = resultState === 'approved';
    return (
      <View style={styles.centered}>
        <Text style={styles.resultIcon}>{isApproved ? '✓' : '✗'}</Text>
        <Text style={[styles.resultTitle, { color: isApproved ? '#4ade80' : '#f87171' }]}>
          {isApproved ? '已批准，正在处理' : '已拒绝'}
        </Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={() => router.replace('/')} accessibilityRole="button" accessibilityLabel="返回首页">
          <Text style={styles.primaryBtnText}>返回首页</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ---------- Loading ----------
  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#fff" />
        <Text style={styles.loadingText}>加载审批详情…</Text>
      </View>
    );
  }

  // ---------- Error / Invalid ----------
  if (error || !data?.valid || !data?.action) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorTitle}>无法加载</Text>
        <Text style={styles.errorText}>{error || data?.reason || '链接无效或已过期'}</Text>
        {error && (
          <TouchableOpacity style={styles.retryBtn} onPress={loadApproval} accessibilityRole="button" accessibilityLabel="重试加载">
            <Text style={styles.retryText}>重试</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.backBtn} onPress={() => router.replace('/')} accessibilityRole="button" accessibilityLabel="返回首页">
          <Text style={styles.backBtnText}>返回首页</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ---------- Approval Detail ----------
  const action = data.action;
  const { amount, currency, recipient_name, description } = action.details;
  const alreadyDecided = data.already_decided || data.decision != null;

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.amount}>
          {amount} {currency}
        </Text>
        <Text style={styles.label}>收款方</Text>
        <Text style={styles.value}>{recipient_name}</Text>
        {description ? (
          <>
            <Text style={styles.label}>描述</Text>
            <Text style={styles.value}>{description}</Text>
          </>
        ) : null}
        {data.decision && (
          <Text style={styles.decision}>
            已{data.decision.decision === 'approved' ? '批准' : '拒绝'}
          </Text>
        )}
      </View>

      {submitError ? (
        <View style={styles.submitErrorBox}>
          <Text style={styles.submitErrorText}>{submitError}</Text>
        </View>
      ) : null}

      {!alreadyDecided && (
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.button, styles.approveBtn, submitting && styles.buttonDisabled]}
            onPress={handleApprove}
            disabled={submitting}
            accessibilityRole="button"
            accessibilityLabel="批准该支付请求"
            accessibilityState={{ disabled: submitting }}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>批准</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, styles.denyBtn, submitting && styles.buttonDisabled]}
            onPress={handleDeny}
            disabled={submitting}
            accessibilityRole="button"
            accessibilityLabel="拒绝该支付请求"
            accessibilityState={{ disabled: submitting }}
          >
            <Text style={styles.buttonText}>拒绝</Text>
          </TouchableOpacity>
        </View>
      )}

      {alreadyDecided && (
        <TouchableOpacity style={styles.backBtn} onPress={() => router.replace('/')} accessibilityRole="button" accessibilityLabel="返回首页">
          <Text style={styles.backBtnText}>返回首页</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a', padding: 24 },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#0a0a0a',
  },
  loadingText: { color: '#737373', marginTop: 12 },
  errorTitle: { fontSize: 20, fontWeight: '600', color: '#f87171', marginBottom: 8 },
  errorText: { color: '#a3a3a3', textAlign: 'center', marginBottom: 16 },
  retryBtn: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 8,
    backgroundColor: '#262626',
    marginBottom: 8,
  },
  retryText: { color: '#fff', fontSize: 15, fontWeight: '500' },
  card: {
    backgroundColor: '#171717',
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#262626',
  },
  amount: { fontSize: 36, fontWeight: '700', color: '#fff', marginBottom: 24 },
  label: { fontSize: 12, color: '#737373', marginBottom: 4, textTransform: 'uppercase' },
  value: { fontSize: 16, color: '#e5e5e5', marginBottom: 16 },
  decision: { fontSize: 14, color: '#a3a3a3', marginTop: 8 },
  submitErrorBox: {
    backgroundColor: '#7f1d1d',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  submitErrorText: { color: '#fca5a5', fontSize: 14, textAlign: 'center' },
  actions: { gap: 12 },
  button: { paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  approveBtn: { backgroundColor: '#22c55e' },
  denyBtn: { backgroundColor: '#262626', borderWidth: 1, borderColor: '#404040' },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { fontSize: 17, fontWeight: '600', color: '#fff' },
  backBtn: { marginTop: 24, paddingVertical: 14, alignItems: 'center' },
  backBtnText: { color: '#737373', fontSize: 16 },
  resultIcon: { fontSize: 72, marginBottom: 16 },
  resultTitle: { fontSize: 22, fontWeight: '700', marginBottom: 32 },
  primaryBtn: {
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 12,
    backgroundColor: '#22c55e',
  },
  primaryBtnText: { fontSize: 17, fontWeight: '600', color: '#fff' },
});
