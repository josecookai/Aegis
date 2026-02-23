import {
  View,
  Text,
  StyleSheet,
  RefreshControl,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useState, useCallback, useRef } from 'react';
import { useRouter, useFocusEffect } from 'expo-router';
import { getPending, type ApprovalAction } from '../../lib/api';

function formatTime(dateStr?: string) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const mm = (d.getMonth() + 1).toString();
  const dd = d.getDate().toString();
  const hh = d.getHours().toString().padStart(2, '0');
  const mi = d.getMinutes().toString().padStart(2, '0');
  return `${mm}/${dd} ${hh}:${mi}`;
}

export default function HomeScreen() {
  const router = useRouter();
  const [items, setItems] = useState<ApprovalAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isFirstMount = useRef(true);

  const fetchData = useCallback(async (spinner = false) => {
    if (spinner) setLoading(true);
    setError(null);
    try {
      const result = await getPending();
      setItems(result.items);
    } catch (e) {
      setError((e as Error).message || '加载失败');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (isFirstMount.current) {
        isFirstMount.current = false;
        fetchData(true);
      } else {
        fetchData();
      }
    }, [fetchData])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  const handlePress = (item: ApprovalAction) => {
    router.push(`/approve?action_id=${item.action_id}`);
  };

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
      <TouchableOpacity style={styles.errorBannerRetry} onPress={() => fetchData(true)}>
        <Text style={styles.retryText}>重试</Text>
      </TouchableOpacity>
    </View>
  ) : null;

  if (error && items.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => fetchData(true)}>
          <Text style={styles.retryText}>重试</Text>
        </TouchableOpacity>
      </View>
    );
  }

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
      renderItem={({ item }) => (
        <TouchableOpacity style={styles.card} onPress={() => handlePress(item)} activeOpacity={0.7}>
          <View style={styles.cardRow}>
            <Text style={styles.amount}>
              {item.details.amount} {item.details.currency}
            </Text>
            <Text style={styles.time}>{formatTime(item.created_at)}</Text>
          </View>
          <Text style={styles.recipient}>{item.details.recipient_name}</Text>
          {item.details.description ? (
            <Text style={styles.description} numberOfLines={1}>
              {item.details.description}
            </Text>
          ) : null}
        </TouchableOpacity>
      )}
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>暂无待审批请求</Text>
          <Text style={styles.emptyHint}>
            当有新的审批请求时，会在此处显示。{'\n'}
            下拉刷新获取最新数据。
          </Text>
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
  card: {
    backgroundColor: '#171717',
    borderRadius: 14,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#262626',
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  amount: { fontSize: 24, fontWeight: '700', color: '#fff' },
  time: { fontSize: 13, color: '#737373' },
  recipient: { fontSize: 15, color: '#a3a3a3', marginBottom: 4 },
  description: { fontSize: 13, color: '#737373' },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 280,
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
