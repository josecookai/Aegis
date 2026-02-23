import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';

interface MockAsset {
  id: string;
  emoji: string;
  title: string;
  subtitle: string;
  type: string;
}

const MOCK_ASSETS: MockAsset[] = [
  {
    id: '1',
    emoji: '💎',
    title: 'ETH 钱包',
    subtitle: '0x1234…abcd · Ethereum',
    type: 'wallet',
  },
  {
    id: '2',
    emoji: '💳',
    title: '信用卡',
    subtitle: '•••• 4242 · Visa',
    type: 'card',
  },
];

export default function AssetsScreen() {
  const handleAdd = () => Alert.alert('提示', '功能开发中');

  const handleLongPress = (asset: MockAsset) => {
    Alert.alert('删除资产', `确定要删除「${asset.title}」吗？`, [
      { text: '取消', style: 'cancel' },
      { text: '删除', style: 'destructive', onPress: () => Alert.alert('提示', '功能开发中') },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity style={styles.addBtn} onPress={handleAdd} activeOpacity={0.7}>
        <Text style={styles.addBtnText}>+ 添加资产</Text>
      </TouchableOpacity>

      {MOCK_ASSETS.map((asset) => (
        <TouchableOpacity
          key={asset.id}
          style={styles.card}
          activeOpacity={0.8}
          onLongPress={() => handleLongPress(asset)}
          delayLongPress={400}
        >
          <Text style={styles.emoji}>{asset.emoji}</Text>
          <View style={styles.cardInfo}>
            <Text style={styles.cardTitle}>{asset.title}</Text>
            <Text style={styles.cardSubtitle}>{asset.subtitle}</Text>
          </View>
        </TouchableOpacity>
      ))}

      <Text style={styles.hint}>长按卡片可删除资产</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  content: { padding: 16, paddingBottom: 48 },
  addBtn: {
    backgroundColor: '#22c55e',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 20,
  },
  addBtnText: { fontSize: 16, fontWeight: '600', color: '#fff' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#171717',
    borderRadius: 14,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#262626',
  },
  emoji: { fontSize: 32, marginRight: 16 },
  cardInfo: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#fff', marginBottom: 4 },
  cardSubtitle: { fontSize: 14, color: '#a3a3a3' },
  hint: {
    textAlign: 'center',
    color: '#525252',
    fontSize: 12,
    marginTop: 16,
  },
});
