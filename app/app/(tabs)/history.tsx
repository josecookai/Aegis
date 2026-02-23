import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useState, useCallback, useRef } from 'react';
import { useFocusEffect } from 'expo-router';
import { getHistory, DEFAULT_USER_ID, type ApprovalAction } from '../../lib/api';

const STATUS_BADGE: Record<string, { label: string; bg: string; fg: string }> = {
  approved:           { label: '已批准', bg: '#166534', fg: '#4ade80' },
  denied:             { label: '已拒绝', bg: '#7f1d1d', fg: '#f87171' },
  succeeded:          { label: '已完成', bg: '#1e3a5f', fg: '#60a5fa' },
  failed:             { label: '失败',   bg: '#7c2d12', fg: '#fb923c' },
  awaiting_approval:  { label: '待审批', bg: '#713f12', fg: '#facc15' },
  executing:          { label: '执行中', bg: '#1e3a5f', fg: '#38bdf8' },
  expired:            { label: '已过期', bg: '#374151', fg: '#9ca3af' },
  canceled:           { label: '已取消', bg: '#374151', fg: '#9ca3af' },
};
const DEFAULT_BADGE = { label: '未知', bg: '#374151', fg: '#9ca3af' };

function formatTime(dateStr?: string) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const mm = (d.getMonth() + 1).toString();
  const dd = d.getDate().toString();
  const hh = d.getHours().toString().padStart(2, '0');
  const mi = d.getMinutes().toString().padStart(2, '0');
  return `${mm}/${dd} ${hh}:${mi}`;
}

const LIMIT = 50;

export default function HistoryScreen() {
  const [items, setItems] = useState<ApprovalAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const isFirstMount = useRef(true);

  const fetchHistory = useCallback(async (offset: number, append: boolean) => {
    const result = await getHistory(DEFAULT_USER_ID, LIMIT, offset);
    setItems(prev => (append ? [...prev, ...result.items] : result.items));
    setTotal(result.total);
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (isFirstMount.current) {
        isFirstMount.current = false;
        setLoading(true);
        setError(null);
        fetchHistory(0, false)
          .catch(e => setError((e as Error).message || '加载失败'))
          .finally(() => setLoading(false));
      } else {
        setError(null);
        fetchHistory(0, false).catch(e => setError((e as Error).message || '加载失败'));
      }
    }, [fetchHistory])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      await fetchHistory(0, false);
    } catch (e) {
      setError((e as Error).message || '加载失败');
    } finally {
      setRefreshing(false);
    }
  }, [fetchHistory]);

  const loadMore = useCallback(async () => {
    if (loadingMore || items.length >= total) return;
    setLoadingMore(true);
    try {
      await fetchHistory(items.length, true);
    } catch {
      // user can retry via pull-to-refresh
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, items.length, total, fetchHistory]);

  if (loading && items.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#22c55e" />
      </View>
    );
  }

  const ErrorBanner = error ? (
    <View style={styles.errorBanner}>
      <Text style={styles.errorBannerText}>{error}</Text>
      <TouchableOpacity
        style={styles.errorBannerRetry}
        onPress={() => {
          setError(null);
          fetchHistory(0, false)
            .catch(e => setError((e as Error).message || '加载失败'));
        }}
      >
        <Text style={styles.retryText}>重试</Text>
      </TouchableOpacity>
    </View>
  ) : null;

  if (error && items.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity
          style={styles.retryBtn}
          onPress={() => {
            setLoading(true);
            setError(null);
            fetchHistory(0, false)
              .catch(e => setError((e as Error).message || '加载失败'))
              .finally(() => setLoading(false));
          }}
        >
          <Text style={styles.retryText}>重试</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const badge = (status: string) => STATUS_BADGE[status] ?? DEFAULT_BADGE;

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={items.length === 0 ? styles.emptyContent : styles.listContent}
      ListHeaderComponent={ErrorBanner}
      data={items}
      keyExtractor={(item) => item.action_id}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#22c55e" />
      }
      onEndReached={loadMore}
      onEndReachedThreshold={0.3}
      renderItem={({ item }) => {
        const b = badge(item.status);
        return (
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Text style={styles.rowTime}>{formatTime(item.created_at)}</Text>
              <View style={[styles.badge, { backgroundColor: b.bg }]}>
                <Text style={[styles.badgeText, { color: b.fg }]}>{b.label}</Text>
              </View>
            </View>
            <View style={styles.rowRight}>
              <Text style={styles.rowAmount}>
                {item.details.amount} {item.details.currency}
              </Text>
              <Text style={styles.rowRecipient} numberOfLines={1}>
                {item.details.recipient_name}
              </Text>
            </View>
          </View>
        );
      }}
      ListFooterComponent={
        loadingMore ? (
          <ActivityIndicator style={{ marginVertical: 16 }} color="#737373" />
        ) : items.length > 0 && items.length >= total ? (
          <Text style={styles.footerText}>已加载全部</Text>
        ) : null
      }
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>暂无历史记录</Text>
          <Text style={styles.emptyHint}>审批与执行记录将在此展示。</Text>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  listContent: { padding: 16, paddingBottom: 32 },
  emptyContent: { flexGrow: 1, padding: 24 },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0a0a0a',
    padding: 24,
  },
  errorText: { color: '#f87171', fontSize: 15, textAlign: 'center', marginBottom: 16 },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#7f1d1d',
    padding: 12,
    marginBottom: 12,
    borderRadius: 8,
  },
  errorBannerText: { color: '#fca5a5', fontSize: 14, flex: 1 },
  errorBannerRetry: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 6,
    backgroundColor: '#991b1b',
  },
  retryBtn: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 8,
    backgroundColor: '#262626',
  },
  retryText: { color: '#fff', fontSize: 15, fontWeight: '500' },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#171717',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#262626',
  },
  rowLeft: { flexDirection: 'column', gap: 6 },
  rowRight: { alignItems: 'flex-end', flexShrink: 1, marginLeft: 12 },
  rowTime: { fontSize: 13, color: '#737373' },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-start' },
  badgeText: { fontSize: 12, fontWeight: '600' },
  rowAmount: { fontSize: 17, fontWeight: '600', color: '#fff', marginBottom: 2 },
  rowRecipient: { fontSize: 13, color: '#a3a3a3' },
  footerText: { textAlign: 'center', color: '#525252', fontSize: 13, paddingVertical: 16 },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 200,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#a3a3a3',
    marginBottom: 12,
  },
  emptyHint: {
    fontSize: 14,
    color: '#737373',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 24,
  },
});
