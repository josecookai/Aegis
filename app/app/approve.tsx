import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as LocalAuthentication from 'expo-local-authentication';
import { getApproval, submitDecision, type ApprovalResponse } from '../lib/api';
import { determineApproveDecisionSource } from '../../src/mobile/approvalDecision';

export default function ApproveScreen() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  const router = useRouter();
  const [data, setData] = useState<ApprovalResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError('缺少审批链接参数 token');
      setLoading(false);
      return;
    }
    getApproval(token)
      .then(setData)
      .catch((e) => setError(e.message ?? '加载失败'))
      .finally(() => setLoading(false));
  }, [token]);

  const handleApprove = async () => {
    if (!token || !data?.valid || data.already_decided) return;
    setSubmitting(true);
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const supported = await LocalAuthentication.supportedAuthenticationTypesAsync();
      if (!hasHardware || supported.length === 0) {
        const noBiometric = determineApproveDecisionSource({
          hasHardware,
          supportedCount: supported.length,
          authSuccess: false,
        });
        Alert.alert('无法批准', noBiometric.reason || '该设备不支持生物识别');
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
        Alert.alert('无法批准', decisionSource.reason || '未完成生物识别验证');
        return;
      }
      await submitDecision(token, 'approve', decisionSource.source);
      Alert.alert('已批准', '请求已批准，正在处理。', [
        { text: '确定', onPress: () => router.replace('/') },
      ]);
    } catch (e) {
      Alert.alert('提交失败', (e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeny = async () => {
    if (!token || !data?.valid || data.already_decided) return;
    setSubmitting(true);
    try {
      await submitDecision(token, 'deny');
      Alert.alert('已拒绝', '已拒绝该支付请求。', [
        { text: '确定', onPress: () => router.replace('/') },
      ]);
    } catch (e) {
      Alert.alert('提交失败', (e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#fff" />
        <Text style={styles.loadingText}>加载审批详情…</Text>
      </View>
    );
  }

  if (error || !data?.valid) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorTitle}>无法加载</Text>
        <Text style={styles.errorText}>{error || data?.reason || '链接无效或已过期'}</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.replace('/')}>
          <Text style={styles.backBtnText}>返回首页</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const action = data.action!;
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

      {!alreadyDecided && (
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.button, styles.approveBtn]}
            onPress={handleApprove}
            disabled={submitting}
          >
            <Text style={styles.buttonText}>批准</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, styles.denyBtn]}
            onPress={handleDeny}
            disabled={submitting}
          >
            <Text style={styles.buttonText}>拒绝</Text>
          </TouchableOpacity>
        </View>
      )}

      {alreadyDecided && (
        <TouchableOpacity style={styles.backBtn} onPress={() => router.replace('/')}>
          <Text style={styles.backBtnText}>返回首页</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    padding: 24,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#0a0a0a',
  },
  loadingText: {
    color: '#888',
    marginTop: 12,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#f87171',
    marginBottom: 8,
  },
  errorText: {
    color: '#888',
    textAlign: 'center',
    marginBottom: 24,
  },
  card: {
    backgroundColor: '#171717',
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#262626',
  },
  amount: {
    fontSize: 36,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 24,
  },
  label: {
    fontSize: 12,
    color: '#737373',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  value: {
    fontSize: 16,
    color: '#e5e5e5',
    marginBottom: 16,
  },
  decision: {
    fontSize: 14,
    color: '#a3a3a3',
    marginTop: 8,
  },
  actions: {
    gap: 12,
  },
  button: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  approveBtn: {
    backgroundColor: '#22c55e',
  },
  denyBtn: {
    backgroundColor: '#262626',
    borderWidth: 1,
    borderColor: '#404040',
  },
  buttonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
  },
  backBtn: {
    marginTop: 24,
    paddingVertical: 14,
    alignItems: 'center',
  },
  backBtnText: {
    color: '#737373',
    fontSize: 16,
  },
});
