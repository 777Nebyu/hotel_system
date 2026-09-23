import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { RootStackParamList } from '../navigation/types';
import { useAppSelector } from '../store/hooks';
import { request, ApiError } from '../api';
import { useTheme } from '../hooks/useTheme';
import { useResponsivePadding } from '../hooks/useResponsivePadding';
import { hapticSelection } from '../hooks/useHaptics';

type Nav = NativeStackNavigationProp<RootStackParamList>;

type PaymentItem = {
  id: string;
  bookingId: string;
  method: string;
  amount: number;
  status: string;
  providerRef?: string;
  createdAt: string;
  refundAmount?: number;
  refundPercentage?: number;
  refundReason?: string;
  booking: {
    id: string;
    bookingRef: string;
    hotel: { name: string };
    checkIn: string;
    checkOut: string;
  };
  attempts?: { status: string; attemptedAt: string }[];
};

type FilterTab = 'ALL' | 'PAID' | 'PENDING' | 'FAILED' | 'REFUNDED';

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'PAID', label: 'Paid' },
  { key: 'PENDING', label: 'Pending' },
  { key: 'FAILED', label: 'Failed' },
  { key: 'REFUNDED', label: 'Refunded' },
];

const STATUS_CONFIG: Record<string, { bg: string; fg: string; icon: string }> = {
  SUCCEEDED: { bg: '#DCFCE7', fg: '#166534', icon: 'checkmark-circle' },
  FAILED: { bg: '#FEE2E2', fg: '#991B1B', icon: 'close-circle' },
  PENDING: { bg: '#FEF3C7', fg: '#92400E', icon: 'time' },
  REFUNDED: { bg: '#E0E7FF', fg: '#3730A3', icon: 'arrow-undo' },
  CANCELLED: { bg: '#F3F4F6', fg: '#374151', icon: 'ban' },
  PENDING_AT_HOTEL: { bg: '#F3F4F6', fg: '#374151', icon: 'business' },
};

const METHOD_LABELS: Record<string, string> = {
  CREDIT_CARD: 'Credit Card',
  TELEBIRR: 'Telebirr',
  CBE_BIRR: 'CBE Birr',
  PAYPAL: 'PayPal',
  CASH_AT_HOTEL: 'Cash at Hotel',
};

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return iso;
  }
}

export default function PaymentHistoryScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const pad = useResponsivePadding();
  const { colors: c } = useTheme();
  const session = useAppSelector((s) => s.auth.session);
  const token = session?.accessToken ?? '';

  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<FilterTab>('ALL');

  const fetchPayments = useCallback(async (isPullRefresh = false) => {
    if (isPullRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      const res = await request<{ data: PaymentItem[] }>('/payments/my', { token });
      setPayments(res.data ?? []);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to load payment history';
      setError(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  const filteredPayments = payments.filter((item) => {
    if (activeTab === 'ALL') return true;
    if (activeTab === 'PAID') return item.status === 'SUCCEEDED';
    if (activeTab === 'PENDING') return item.status === 'PENDING' || item.status === 'PENDING_AT_HOTEL';
    if (activeTab === 'FAILED') return item.status === 'FAILED';
    if (activeTab === 'REFUNDED') return item.status === 'REFUNDED';
    return true;
  });

  const handleTabPress = (tab: FilterTab) => {
    hapticSelection();
    setActiveTab(tab);
  };

  const renderPayment = ({ item }: { item: PaymentItem }) => {
    const statusCfg = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.PENDING;
    const isRefunded = item.status === 'REFUNDED';

    return (
      <Pressable
        onPress={() => navigation.navigate('BookingDetail', { bookingId: item.bookingId })}
        style={[styles.card, { backgroundColor: c.surface, borderColor: c.line }]}
      >
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <Text style={[styles.hotelName, { color: c.ink }]} numberOfLines={1}>
              {item.booking?.hotel?.name ?? 'Hotel'}
            </Text>
            <Text style={[styles.refText, { color: c.inkMuted }]}>#{item.booking?.bookingRef}</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: statusCfg.bg }]}>
            <Ionicons name={statusCfg.icon as any} size={12} color={statusCfg.fg} />
            <Text style={[styles.badgeText, { color: statusCfg.fg }]}>{item.status.replace(/_/g, ' ')}</Text>
          </View>
        </View>

        <View style={styles.cardBody}>
          <View style={[styles.infoRow, { borderBottomColor: c.line }]}>
            <Ionicons name="calendar-outline" size={14} color={c.inkMuted} />
            <Text style={[styles.infoText, { color: c.inkMuted }]}>
              {formatDate(item.booking?.checkIn)} – {formatDate(item.booking?.checkOut)}
            </Text>
          </View>
          <View style={[styles.infoRow, { borderBottomColor: c.line }]}>
            <Ionicons name="wallet-outline" size={14} color={c.inkMuted} />
            <Text style={[styles.infoText, { color: c.inkMuted }]}>
              {METHOD_LABELS[item.method] ?? item.method}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="cash-outline" size={14} color={c.inkMuted} />
            <Text style={[styles.infoText, { color: c.ink, fontWeight: '700' }]}>
              ETB {Number(item.amount).toLocaleString()}
            </Text>
          </View>

          {isRefunded && (
            <View style={[styles.refundBox, { backgroundColor: '#EEF2FF', borderColor: '#C7D2FE' }]}>
              <Ionicons name="arrow-undo-outline" size={14} color="#3730A3" />
              <Text style={styles.refundText}>
                Refund: ETB {Number(item.refundAmount ?? item.amount).toLocaleString()}
                {item.refundPercentage !== undefined ? ` (${item.refundPercentage}%)` : ''}
              </Text>
            </View>
          )}
        </View>

        {item.providerRef && (
          <Text style={[styles.providerRef, { color: c.inkMuted }]}>Ref: {item.providerRef}</Text>
        )}
      </Pressable>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: c.paper, paddingTop: insets.top + 12 }]}>
      {/* Header */}
      <View style={[styles.header, { paddingHorizontal: pad, borderBottomColor: c.line }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8} style={[styles.backBtn, { backgroundColor: c.paperDeep }]}>
          <Ionicons name="arrow-back" size={20} color={c.teal} />
        </Pressable>
        <Text style={[styles.title, { color: c.ink }]}>Payment History</Text>
        <Pressable onPress={() => fetchPayments(false)} hitSlop={8} style={[styles.refreshBtn, { backgroundColor: c.paperDeep }]}>
          <Ionicons name="refresh" size={18} color={c.teal} />
        </Pressable>
      </View>

      {/* Filter Tabs */}
      <View style={[styles.tabsContainer, { borderBottomColor: c.line }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.tabsScroll, { paddingHorizontal: pad }]}
        >
          {FILTER_TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <Pressable
                key={tab.key}
                onPress={() => handleTabPress(tab.key)}
                style={[
                  styles.tabChip,
                  { borderColor: c.lineStrong },
                  isActive && { backgroundColor: c.teal, borderColor: c.teal },
                ]}
              >
                <Text
                  style={[
                    styles.tabChipText,
                    { color: c.inkSoft },
                    isActive && { color: '#FFFFFF', fontWeight: '700' },
                  ]}
                >
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Content */}
      <View style={[styles.content, { paddingHorizontal: pad }]}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={c.teal} />
            <Text style={[styles.loadingText, { color: c.inkMuted }]}>Loading payments...</Text>
          </View>
        ) : error ? (
          <View style={styles.center}>
            <Ionicons name="alert-circle" size={40} color={c.brick} />
            <Text style={[styles.errorText, { color: c.brick }]}>{error}</Text>
            <Pressable onPress={() => fetchPayments(false)} style={[styles.retryBtn, { backgroundColor: c.tealTint }]}>
              <Text style={[styles.retryText, { color: c.teal }]}>Retry</Text>
            </Pressable>
          </View>
        ) : filteredPayments.length === 0 ? (
          <View style={styles.center}>
            <Ionicons name="wallet-outline" size={48} color={c.inkMuted} />
            <Text style={[styles.emptyTitle, { color: c.ink }]}>
              {activeTab === 'ALL' ? 'No payments yet' : `No ${activeTab.toLowerCase()} payments`}
            </Text>
            <Text style={[styles.emptySub, { color: c.inkMuted }]}>
              {activeTab === 'ALL'
                ? 'Your payment history will appear here.'
                : 'No transactions found matching this status.'}
            </Text>
          </View>
        ) : (
          <FlatList
            data={filteredPayments}
            keyExtractor={(item) => item.id}
            renderItem={renderPayment}
            contentContainerStyle={{ paddingBottom: insets.bottom + 20, gap: 12 }}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => fetchPayments(true)}
                tintColor={c.teal}
                colors={[c.teal]}
              />
            }
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth, gap: 12 },
  backBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, fontSize: 20, fontWeight: '700' },
  refreshBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  tabsContainer: { borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 10 },
  tabsScroll: { gap: 8 },
  tabChip: { borderRadius: 18, paddingHorizontal: 16, paddingVertical: 7, borderWidth: 1 },
  tabChipText: { fontSize: 13, fontWeight: '600' },
  content: { flex: 1, paddingTop: 14 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: 14 },
  errorText: { fontSize: 14, textAlign: 'center', maxWidth: 240 },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12, marginTop: 8 },
  retryText: { fontSize: 14, fontWeight: '600' },
  emptyTitle: { fontSize: 16, fontWeight: '600' },
  emptySub: { fontSize: 13, textAlign: 'center' },
  card: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 10 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardHeaderLeft: { flex: 1, gap: 2 },
  hotelName: { fontSize: 15, fontWeight: '600' },
  refText: { fontSize: 12, fontFamily: 'Menlo' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  cardBody: { gap: 0 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth },
  infoText: { fontSize: 13, flex: 1 },
  refundBox: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, marginTop: 8 },
  refundText: { fontSize: 12, fontWeight: '600', color: '#3730A3' },
  providerRef: { fontSize: 11, fontFamily: 'Menlo' },
});

