import React, { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import type { RootStackParamList } from '../navigation/types';
import { useAppSelector } from '../store/hooks';
import { request } from '../api';
import { useTheme } from '../hooks/useTheme';
import { useResponsivePadding } from '../hooks/useResponsivePadding';
import { useFocusEffect } from '@react-navigation/native';
import { hapticSuccess } from '../hooks/useHaptics';

type Nav = NativeStackNavigationProp<RootStackParamList>;

type SmsMessage = {
  id: string;
  to: string;
  body: string;
  createdAt: string;
};

type SmsInboxResponse = SmsMessage[] | { data?: SmsMessage[] };

export default function MockSmsInboxScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const pad = useResponsivePadding();
  const { colors: c } = useTheme();
  const session = useAppSelector((s) => s.auth.session);
  const token = session?.accessToken ?? '';

  const [messages, setMessages] = useState<SmsMessage[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMessages = useCallback(async () => {
    try {
      const result = await request<SmsInboxResponse>('/dev/sms', { token });
      // The API returns { data, count }; accept a bare array as well for
      // compatibility with older mock servers.
      setMessages(Array.isArray(result) ? result : result.data ?? []);
    } catch {
      // Silent fail
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      fetchMessages();
    }, [fetchMessages]),
  );

  const handleCopyOtp = async (body: string) => {
    const match = body.match(/code[:\s]*(\d{6})/i);
    if (match) {
      hapticSuccess();
      Alert.alert('OTP Code', match[1]);
    } else {
      hapticSuccess();
      Alert.alert('Message', body.slice(0, 100));
    }
  };

  const handleClearAll = async () => {
    Alert.alert('Clear All', 'Delete all SMS messages?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          try {
            await request('/dev/sms/clear', { method: 'POST', token });
            setMessages([]);
          } catch {
            Alert.alert('Error', 'Failed to clear messages');
          }
        },
      },
    ]);
  };

  const handleDelete = async (id: string) => {
    try {
      await request(`/dev/sms/${id}`, { method: 'DELETE', token });
      setMessages((prev) => prev.filter((m) => m.id !== id));
    } catch {
      // Silent fail
    }
  };

  const renderMessage = ({ item }: { item: SmsMessage }) => (
    <View style={[styles.messageCard, { backgroundColor: c.surface, borderColor: c.line }]}>
      <View style={styles.messageHeader}>
        <Text style={[styles.messageTo, { color: c.ink }]}>{item.to}</Text>
        <Pressable onPress={() => handleDelete(item.id)} hitSlop={8}>
          <Ionicons name="trash-outline" size={16} color={c.brick} />
        </Pressable>
      </View>

      <Text style={[styles.messageBody, { color: c.ink }]}>{item.body}</Text>

      <Text style={[styles.messageDate, { color: c.inkMuted }]}>
        {new Date(item.createdAt).toLocaleString()}
      </Text>

      <View style={styles.messageActions}>
        <Pressable
          onPress={() => handleCopyOtp(item.body)}
          style={[styles.copyBtn, { backgroundColor: c.tealTint }]}
        >
          <Ionicons name="eye-outline" size={14} color={c.teal} />
          <Text style={[styles.copyBtnText, { color: c.teal }]}>View OTP</Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: c.paper, paddingTop: insets.top + 12 }]}>
      <View style={[styles.header, { paddingHorizontal: pad }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8} style={[styles.backBtn, { backgroundColor: c.paperDeep }]}>
          <Ionicons name="arrow-back" size={20} color={c.teal} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: c.ink }]}>SMS Inbox (Dev)</Text>
        {messages.length > 0 && (
          <Pressable onPress={handleClearAll} hitSlop={8}>
            <Text style={[styles.clearAllText, { color: c.brick }]}>Clear All</Text>
          </Pressable>
        )}
        {messages.length === 0 && <View style={{ width: 44 }} />}
      </View>

      {loading ? (
        <View style={styles.emptyState}>
          <Ionicons name="hourglass-outline" size={40} color={c.inkMuted} />
          <Text style={[styles.emptyText, { color: c.inkMuted }]}>Loading messages...</Text>
        </View>
      ) : messages.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="chatbox-outline" size={48} color={c.inkMuted} />
          <Text style={[styles.emptyTitle, { color: c.ink }]}>No messages yet</Text>
          <Text style={[styles.emptyText, { color: c.inkMuted }]}>
            SMS messages will appear here when you initiate a Telebirr payment.
          </Text>
        </View>
      ) : (
        <FlatList
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={{ paddingHorizontal: pad, paddingBottom: insets.bottom + 20 }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  backBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  clearAllText: { fontSize: 14, fontWeight: '500' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24 },
  emptyTitle: { fontSize: 18, fontWeight: '700' },
  emptyText: { fontSize: 14, textAlign: 'center' },
  messageCard: { borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 10 },
  messageHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  messageTo: { fontSize: 14, fontWeight: '600' },
  messageBody: { fontSize: 14, lineHeight: 20, marginBottom: 8 },
  messageDate: { fontSize: 12, marginBottom: 8 },
  messageActions: { flexDirection: 'row', gap: 8 },
  copyBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  copyBtnText: { fontSize: 13, fontWeight: '500' },
});
