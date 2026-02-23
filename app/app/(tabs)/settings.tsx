import {
  View,
  Text,
  StyleSheet,
  SectionList,
  Switch,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useState } from 'react';

export default function SettingsScreen() {
  const [notifyEnabled, setNotifyEnabled] = useState(true);
  const [biometricRequired, setBiometricRequired] = useState(true);

  const comingSoon = () => Alert.alert('提示', '功能开发中');

  type SettingItem =
    | { key: string; type: 'toggle'; label: string; value: boolean; onToggle: (v: boolean) => void }
    | { key: string; type: 'info'; label: string; detail: string }
    | { key: string; type: 'action'; label: string; destructive?: boolean; onPress: () => void };

  const sections: { title: string; data: SettingItem[] }[] = [
    {
      title: '通知',
      data: [
        {
          key: 'notify',
          type: 'toggle',
          label: '审批请求提醒',
          value: notifyEnabled,
          onToggle: setNotifyEnabled,
        },
      ],
    },
    {
      title: '安全',
      data: [
        {
          key: 'biometric',
          type: 'toggle',
          label: '需要生物识别',
          value: biometricRequired,
          onToggle: setBiometricRequired,
        },
      ],
    },
    {
      title: '账户',
      data: [
        { key: 'user', type: 'info', label: '用户', detail: 'usr_demo' },
        { key: 'email', type: 'info', label: '邮箱', detail: 'demo.user@example.com' },
        { key: 'logout', type: 'action', label: '登出', destructive: true, onPress: comingSoon },
      ],
    },
    {
      title: '关于',
      data: [
        { key: 'version', type: 'info', label: 'App 版本', detail: '0.1.0' },
        { key: 'privacy', type: 'action', label: '隐私政策', onPress: comingSoon },
        { key: 'terms', type: 'action', label: '服务条款', onPress: comingSoon },
      ],
    },
  ];

  const renderItem = ({ item }: { item: SettingItem }) => {
    if (item.type === 'toggle') {
      return (
        <View style={styles.row}>
          <Text style={styles.rowLabel}>{item.label}</Text>
          <Switch
            value={item.value}
            onValueChange={item.onToggle}
            trackColor={{ false: '#404040', true: '#22c55e' }}
            thumbColor="#fff"
          />
        </View>
      );
    }
    if (item.type === 'info') {
      return (
        <View style={styles.row}>
          <Text style={styles.rowLabel}>{item.label}</Text>
          <Text style={styles.rowDetail}>{item.detail}</Text>
        </View>
      );
    }
    return (
      <TouchableOpacity style={styles.row} onPress={item.onPress} activeOpacity={0.6}>
        <Text style={[styles.rowLabel, item.destructive && styles.destructiveText]}>
          {item.label}
        </Text>
        <Text style={styles.chevron}>›</Text>
      </TouchableOpacity>
    );
  };

  return (
    <SectionList
      style={styles.container}
      contentContainerStyle={styles.content}
      sections={sections}
      keyExtractor={(item) => item.key}
      renderItem={renderItem}
      renderSectionHeader={({ section }) => (
        <Text style={styles.sectionHeader}>{section.title}</Text>
      )}
      stickySectionHeadersEnabled={false}
      ListFooterComponent={
        <Text style={styles.footer}>Aegis v0.1.0 · Powered by Aegis Protocol</Text>
      }
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  content: { paddingBottom: 48 },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '600',
    color: '#737373',
    textTransform: 'uppercase',
    paddingHorizontal: 16,
    paddingTop: 28,
    paddingBottom: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#171717',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#262626',
    minHeight: 50,
  },
  rowLabel: { fontSize: 16, color: '#fff' },
  rowDetail: { fontSize: 15, color: '#737373' },
  destructiveText: { color: '#f87171' },
  chevron: { fontSize: 20, color: '#525252' },
  footer: {
    textAlign: 'center',
    color: '#525252',
    fontSize: 12,
    marginTop: 40,
    paddingHorizontal: 16,
  },
});
