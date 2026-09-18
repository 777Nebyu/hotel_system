/**
 * AdminDisputesScreen — Premium Dark Mode Design
 * Policy 54-dispute-fraud-session: Admin can view, assign, resolve, dismiss disputes.
 * Luxury hotel SaaS UI with glassmorphism cards and premium typography.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppSelector } from '../../store/hooks';
import { request } from '../../api';
import { font, useThemeColors } from '../../theme';
import { SkeletonList } from '../../components/Skeleton';
import { useToast } from '../../components/Toast';

interface Props { onBack: () => void; }

const STATUS_TABS = [
  { key: 'ALL', label: 'All' },
  { key: 'OPEN', label: 'Open' },
  { key: 'UNDER_REVIEW', label: 'Review' },
  { key: 'RESOLVED', label: 'Resolved' },
  { key: 'CLOSED', label: 'Closed' },
] as const;

export default function AdminDisputesScreen({ onBack }: Props) {
  const insets = useSafeAreaInsets();
  const c = useThemeColors();
  const s = useMemo(() => makeStyles(c), [c]);

  const STATUS_CONFIG: Record<string, { color: string; bg: string; icon: string; label: string }> = {
    OPEN:         { color: c.warning, bg: 'rgba(245,158,11,0.15)', icon: 'warning', label: 'OPEN' },
    UNDER_REVIEW: { color: c.info, bg: 'rgba(59,130,246,0.15)', icon: 'search', label: 'UNDER REVIEW' },
    RESOLVED:     { color: c.success, bg: 'rgba(16,185,129,0.15)',  icon: 'checkmark-circle', label: 'RESOLVED' },
    CLOSED:       { color: c.inkMuted, bg: 'rgba(107,114,128,0.15)', icon: 'lock-closed', label: 'CLOSED' },
  };

  const CATEGORY_CONFIG: Record<string, { color: string; label: string }> = {
    INCORRECT_CHARGE:     { color: c.warning, label: 'INCORRECT CHARGE' },
    SERVICE_QUALITY:      { color: c.info, label: 'SERVICE QUALITY' },
    BOOKING_ISSUE:        { color: '#8B5CF6', label: 'BOOKING ISSUE' },
    REFUND_REQUEST:       { color: c.success, label: 'REFUND REQUEST' },
    CANCELLATION_DISPUTE: { color: c.danger, label: 'CANCELLATION DISPUTE' },
    OTHER:                { color: c.inkMuted, label: 'OTHER' },
  };

  const token   = useAppSelector((s) => s.auth.session?.accessToken ?? '');
  const adminId = useAppSelector((s) => s.auth.session?.user.id ?? '');
  const toast   = useToast();

  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [disputes,   setDisputes]   = useState<any[]>([]);
  const [tab,        setTab]        = useState<string>('ALL');

  // Action modal
  const [modalVisible, setModalVisible]  = useState(false);
  const [selected,     setSelected]      = useState<any | null>(null);
  const [action,       setAction]        = useState<'resolve' | 'dismiss' | 'close'>('resolve');
  const [resolution,   setResolution]    = useState('');
  const [saving,       setSaving]        = useState(false);

  const fetchDisputes = useCallback(async () => {
    setError(null);
    try {
      const qs = tab !== 'ALL' ? `?status=${tab}` : '';
      const res = await request<any>(`/disputes${qs}`, { method: 'GET', token });
      const rows = Array.isArray(res) ? res : res?.data ?? [];
      // The API returns the canonical dispute shape (reason/openedBy). Keep
      // the view model compatible with the card fields used by this screen.
      setDisputes(rows.map((d: any) => ({
        ...d,
        subject: d.subject ?? d.reason?.split('\n')[0] ?? 'Customer dispute',
        description: d.description ?? d.reason,
        type: d.type ?? 'OTHER',
        opener: d.opener ?? d.openedBy,
      })));
    } catch (err: any) {
      setError(err.message || 'Failed to load disputes');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, tab]);

  useEffect(() => { void fetchDisputes(); }, [fetchDisputes]);

  const handleAssignSelf = async (disputeId: string) => {
    try {
      await request(`/disputes/${disputeId}/review`, {
        method: 'POST',
        body: { assigneeId: adminId },
        token,
      });
      setDisputes((prev) =>
        prev.map((d) => d.id === disputeId ? { ...d, assigneeId: adminId } : d),
      );
      toast('success', 'Dispute assigned to you');
    } catch (err: any) {
      toast('error', err.message || 'Failed to assign');
    }
  };

  const openAction = (dispute: any, act: 'resolve' | 'dismiss' | 'close') => {
    setSelected(dispute);
    setAction(act);
    setResolution('');
    setModalVisible(true);
  };

  const confirmAction = async () => {
    if (!selected) return;
    if (action === 'resolve' && !resolution.trim()) {
      toast('error', 'Enter a resolution note before resolving');
      return;
    }
    setSaving(true);
    const endpoint = action === 'resolve' ? `/disputes/${selected.id}/resolve` : `/disputes/${selected.id}/close`;
    const statusMap = { resolve: 'RESOLVED', dismiss: 'CLOSED', close: 'CLOSED' };
    try {
      await request(endpoint, {
        method: 'POST',
        body: { resolution: resolution.trim() || action },
        token,
      });
      setDisputes((prev) => prev.filter((d) => d.id !== selected.id));
      toast('success', `Dispute ${statusMap[action].toLowerCase()}`);
      setModalVisible(false);
    } catch (err: any) {
      toast('error', err.message || 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const openCount = useMemo(() => disputes.filter((d) => d.status === 'OPEN').length, [disputes]);
  const tabCounts = useMemo(() => {
    const counts = disputes.reduce((acc, d) => {
      acc[d.status] = (acc[d.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    counts['ALL'] = disputes.length;
    return counts;
  }, [disputes]);

  const renderDisputeCard = (d: any) => {
    const statusCfg = STATUS_CONFIG[d.status] ?? STATUS_CONFIG.CLOSED;
    const categoryCfg = CATEGORY_CONFIG[d.type] ?? CATEGORY_CONFIG.OTHER;
    const isOpen = !['RESOLVED', 'CLOSED'].includes(d.status);
    const isAssignedToMe = d.assigneeId === adminId;

    return (
      <View key={d.id} style={s.card}>
        {/* Card glow border */}
        <View style={[s.cardGlow, { borderColor: statusCfg.color + '30' }]} />

        {/* Top section: Hotel thumbnail + Title + Status */}
        <View style={s.cardTop}>
          <View style={s.hotelThumb}>
            <Ionicons name="business" size={20} color={c.teal} />
          </View>
          <View style={s.cardTopRight}>
            <Text style={s.cardTitle} numberOfLines={2}>{d.subject}</Text>
            <View style={[s.statusBadge, { backgroundColor: statusCfg.bg }]}>
              <View style={[s.statusDot, { backgroundColor: statusCfg.color }]} />
              <Text style={[s.statusText, { color: statusCfg.color }]}>
                {statusCfg.label}
              </Text>
            </View>
          </View>
        </View>

        {/* Category */}
        <View style={[s.categoryBadge, { borderColor: categoryCfg.color + '40' }]}>
          <Text style={[s.categoryText, { color: categoryCfg.color }]}>
            {categoryCfg.label}
          </Text>
        </View>

        {/* Description */}
        {d.description && (
          <Text style={s.description} numberOfLines={3}>{d.description}</Text>
        )}

        {/* Detail information row */}
        <View style={s.detailRow}>
          <View style={s.detailItem}>
            <Ionicons name="person-outline" size={13} color={c.inkMuted} />
            <Text style={s.detailLabel}>Customer</Text>
            <Text style={s.detailValue} numberOfLines={1}>
              {d.opener?.fullName ?? d.opener?.email ?? 'Unknown'}
            </Text>
          </View>
        </View>

        <View style={s.detailRow}>
          {d.bookingId && (
            <View style={s.detailItem}>
              <Ionicons name="receipt-outline" size={13} color={c.inkMuted} />
              <Text style={s.detailLabel}>Booking</Text>
              <Text style={s.detailValue}>#{d.bookingId.slice(0, 8).toUpperCase()}</Text>
            </View>
          )}
          <View style={s.detailItem}>
            <Ionicons name="calendar-outline" size={13} color={c.inkMuted} />
            <Text style={s.detailLabel}>Date</Text>
            <Text style={s.detailValue}>
              {new Date(d.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
            </Text>
          </View>
        </View>

        {/* Assignee */}
        {d.assigneeId && (
          <View style={s.assigneeRow}>
            <Ionicons name="checkmark-circle" size={14} color={c.teal} />
            <Text style={s.assigneeText}>
              {isAssignedToMe ? 'Assigned to you' : `Assigned: ${d.assignee?.fullName ?? d.assigneeId.slice(0, 8)}`}
            </Text>
          </View>
        )}

        {/* Action buttons for open disputes */}
        {isOpen && (
          <View style={s.actions}>
            {!d.assigneeId && (
              <Pressable
                style={({ pressed }) => [s.actionBtnOutline, pressed && { opacity: 0.7 }]}
                onPress={() => handleAssignSelf(d.id)}
              >
                <Ionicons name="person-add-outline" size={16} color={c.teal} />
                <Text style={s.actionBtnOutlineText}>Assign to Me</Text>
              </Pressable>
            )}
            <Pressable
              style={({ pressed }) => [s.actionBtnGold, pressed && { opacity: 0.7 }]}
              onPress={() => openAction(d, 'resolve')}
            >
              <Ionicons name="checkmark-circle-outline" size={16} color={c.gold} />
              <Text style={s.actionBtnGoldText}>Resolve</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [s.actionBtnDanger, pressed && { opacity: 0.7 }]}
              onPress={() => openAction(d, 'dismiss')}
            >
              <Ionicons name="close-circle-outline" size={16} color={c.danger} />
              <Text style={s.actionBtnDangerText}>Dismiss</Text>
            </Pressable>
          </View>
        )}

        {/* Resolution box for resolved disputes */}
        {d.resolution && (
          <View style={s.resolutionBox}>
            <View style={s.resolutionHeader}>
              <Ionicons name="checkmark-done" size={16} color={c.success} />
              <Text style={s.resolutionLabel}>Resolution</Text>
            </View>
            <Text style={s.resolutionText}>{d.resolution}</Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={c.paper} />

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <View style={[s.header, { paddingTop: insets.top + 8 }]}>
        <View style={s.headerRow}>
          <Pressable
            style={s.backBtn}
            onPress={onBack}
            hitSlop={8}
          >
            <Ionicons name="arrow-back" size={22} color={c.ink} />
          </Pressable>

          <View style={s.headerCenter}>
            <Text style={s.headerTitle}>Customer Disputes</Text>
            <Text style={s.headerSubtitle}>Track and manage customer booking disputes</Text>
          </View>

          <Pressable style={s.headerRight} hitSlop={8}>
            <Ionicons name="notifications-outline" size={22} color={c.ink} />
            {openCount > 0 && (
              <View style={s.notifBadge}>
                <Text style={s.notifBadgeText}>{openCount}</Text>
              </View>
            )}
          </Pressable>
        </View>

        {/* Summary */}
        <View style={s.summaryRow}>
          <View style={s.summaryItem}>
            <Text style={s.summaryCount}>{openCount}</Text>
            <Text style={s.summaryLabel}>Open disputes</Text>
          </View>
        </View>
      </View>

      {/* ── Filter tabs ─────────────────────────────────────────────────────── */}
      <View style={s.tabsWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.tabs}
        >
          {STATUS_TABS.map((tabItem) => {
            const isActive = tab === tabItem.key;
            const count = tabCounts[tabItem.key] ?? 0;
            return (
              <Pressable
                key={tabItem.key}
                onPress={() => setTab(tabItem.key)}
                style={({ pressed }) => [
                  s.tabPill,
                  isActive && s.tabPillActive,
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Text style={[s.tabText, isActive && s.tabTextActive]}>
                  {tabItem.label}
                </Text>
                <View style={[s.tabCount, isActive && s.tabCountActive]}>
                  <Text style={[s.tabCountText, isActive && s.tabCountTextActive]}>
                    {count}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* ── Dispute list ────────────────────────────────────────────────────── */}
      {loading ? (
        <SkeletonList count={5} />
      ) : error ? (
        <View style={s.errorBox}>
          <Ionicons name="alert-circle-outline" size={40} color={c.danger} />
          <Text style={s.errorText}>{error}</Text>
          <Pressable style={s.retryBtn} onPress={() => { setLoading(true); void fetchDisputes(); }}>
            <Text style={s.retryBtnText}>Retry</Text>
          </Pressable>
        </View>
      ) : disputes.length === 0 ? (
        <View style={s.emptyState}>
          <View style={s.emptyIconWrap}>
            <Ionicons name="shield-checkmark-outline" size={48} color={c.teal} />
          </View>
          <Text style={s.emptyTitle}>No disputes found</Text>
          <Text style={s.emptySubtitle}>All customer issues have been resolved.</Text>
        </View>
      ) : (
        <FlashList
          data={disputes}
          keyExtractor={(item) => item.id}
          renderItem={({ item: d }) => renderDisputeCard(d)}
          style={s.listScroll}
          contentContainerStyle={[s.list, { paddingBottom: insets.bottom + 100 }]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); void fetchDisputes(); }}
              tintColor={c.teal}
              colors={[c.teal]}
            />
          }
        />
      )}

      {/* ── Action modal ────────────────────────────────────────────────────── */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <Pressable style={s.modalOverlay} onPress={() => setModalVisible(false)}>
          <Pressable style={s.modalSheet} onPress={(e) => e.stopPropagation()}>
            <View style={s.modalHandle} />
            <Text style={s.modalTitle}>
              {action === 'resolve' ? 'Resolve Dispute' : action === 'dismiss' ? 'Dismiss Dispute' : 'Close Dispute'}
            </Text>
            <Text style={s.modalSub}>{selected?.subject}</Text>

            <Text style={s.inputLabel}>
              {action === 'resolve' ? 'Resolution note (required)' : 'Reason (optional)'}
            </Text>
            <TextInput
              style={s.textarea}
              placeholder={action === 'resolve' ? 'Describe how this was resolved…' : 'Reason for dismissal…'}
              placeholderTextColor={c.inkMuted}
              value={resolution}
              onChangeText={setResolution}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            <View style={s.modalActions}>
              <Pressable
                style={({ pressed }) => [s.modalCancelBtn, pressed && { opacity: 0.7 }]}
                onPress={() => setModalVisible(false)}
              >
                <Text style={s.modalCancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  s.modalConfirmBtn,
                  action === 'resolve' ? s.modalConfirmGold : s.modalConfirmDanger,
                  pressed && { opacity: 0.7 },
                ]}
                onPress={confirmAction}
                disabled={saving}
              >
                <Text style={s.modalConfirmBtnText}>
                  {saving ? 'Saving…' : action === 'resolve' ? 'Resolve' : action === 'dismiss' ? 'Dismiss' : 'Close'}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const makeStyles = (c: ReturnType<typeof useThemeColors>) => StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: c.paper,
  },

  // ── Header ──────────────────────────────────────────────────────────────
  header: {
    backgroundColor: c.paper,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.line,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  headerTitle: {
    fontFamily: font.display,
    fontSize: 18,
    fontWeight: '700',
    color: c.ink,
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 11,
    color: c.inkSoft,
    marginTop: 2,
    textAlign: 'center',
  },
  headerRight: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: c.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: c.ink,
  },
  summaryRow: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 12,
  },
  summaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  summaryCount: {
    fontSize: 20,
    fontWeight: '800',
    color: c.warning,
  },
  summaryLabel: {
    fontSize: 13,
    color: c.inkSoft,
  },

  // ── Tabs ────────────────────────────────────────────────────────────────
  tabsWrapper: {
    backgroundColor: c.paper,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.line,
  },
  tabs: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
  },
  tabPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: c.lineStrong,
    backgroundColor: c.surface,
  },
  tabPillActive: {
    backgroundColor: c.teal,
    borderColor: c.teal,
  },
  tabText: {
    fontSize: 11,
    fontWeight: '600',
    color: c.inkSoft,
  },
  tabTextActive: {
    color: c.ink,
  },
  tabCount: {
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: c.clay,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  tabCountActive: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  tabCountText: {
    fontSize: 9,
    fontWeight: '700',
    color: c.inkSoft,
  },
  tabCountTextActive: {
    color: c.ink,
  },

  // ── List ────────────────────────────────────────────────────────────────
  listScroll: {
    flex: 1,
  },
  list: {
    padding: 16,
    gap: 14,
  },

  // ── Card ────────────────────────────────────────────────────────────────
  card: {
    backgroundColor: c.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: c.line,
    padding: 16,
    gap: 12,
    ...Platform.select({
      ios: {
        shadowColor: c.teal,
        shadowOpacity: 0.06,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 4 },
      },
      android: { elevation: 4 },
    }),
  },
  cardGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 16,
    borderWidth: 1,
    opacity: 0.5,
  },

  // ── Card Top ────────────────────────────────────────────────────────────
  cardTop: {
    flexDirection: 'row',
    gap: 12,
  },
  hotelThumb: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: c.paperDeep,
    borderWidth: 1,
    borderColor: c.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTopRight: {
    flex: 1,
    gap: 6,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: c.ink,
    lineHeight: 20,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  // ── Category ────────────────────────────────────────────────────────────
  categoryBadge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  categoryText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
  },

  // ── Description ─────────────────────────────────────────────────────────
  description: {
    fontSize: 13,
    color: c.inkSoft,
    lineHeight: 19,
  },

  // ── Detail rows ─────────────────────────────────────────────────────────
  detailRow: {
    flexDirection: 'row',
    gap: 16,
    flexWrap: 'wrap',
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minWidth: 100,
  },
  detailLabel: {
    fontSize: 11,
    color: c.inkMuted,
  },
  detailValue: {
    fontSize: 12,
    fontWeight: '600',
    color: c.ink,
  },

  // ── Assignee ────────────────────────────────────────────────────────────
  assigneeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(15,138,131,0.1)',
    borderRadius: 8,
    padding: 8,
  },
  assigneeText: {
    fontSize: 12,
    fontWeight: '600',
    color: c.teal,
  },

  // ── Actions ─────────────────────────────────────────────────────────────
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  actionBtnOutline: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: c.teal,
    backgroundColor: 'rgba(15,138,131,0.08)',
  },
  actionBtnOutlineText: {
    fontSize: 12,
    fontWeight: '600',
    color: c.teal,
  },
  actionBtnGold: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    height: 40,
    borderRadius: 12,
    backgroundColor: c.gold,
  },
  actionBtnGoldText: {
    fontSize: 12,
    fontWeight: '700',
    color: c.paper,
  },
  actionBtnDanger: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    height: 40,
    borderRadius: 12,
    backgroundColor: c.danger,
  },
  actionBtnDangerText: {
    fontSize: 12,
    fontWeight: '700',
    color: c.ink,
  },

  // ── Resolution ──────────────────────────────────────────────────────────
  resolutionBox: {
    backgroundColor: 'rgba(16,185,129,0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.2)',
    padding: 12,
  },
  resolutionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  resolutionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: c.success,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  resolutionText: {
    fontSize: 13,
    color: c.ink,
    lineHeight: 19,
  },

  // ── Empty state ─────────────────────────────────────────────────────────
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(15,138,131,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(15,138,131,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: c.ink,
  },
  emptySubtitle: {
    fontSize: 13,
    color: c.inkSoft,
    textAlign: 'center',
  },

  // ── Error state ─────────────────────────────────────────────────────────
  errorBox: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  errorText: {
    fontSize: 14,
    color: c.inkSoft,
    textAlign: 'center',
  },
  retryBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: c.teal,
  },
  retryBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: c.ink,
  },

  // ── Modal ───────────────────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: c.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    gap: 12,
    borderWidth: 1,
    borderColor: c.line,
    borderBottomWidth: 0,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: c.line,
    alignSelf: 'center',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: c.ink,
    fontFamily: font.display,
  },
  modalSub: {
    fontSize: 13,
    color: c.inkSoft,
    lineHeight: 18,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: c.inkSoft,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 4,
  },
  textarea: {
    borderWidth: 1,
    borderColor: c.line,
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    color: c.ink,
    backgroundColor: c.paperDeep,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  modalCancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: c.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: c.inkSoft,
  },
  modalConfirmBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalConfirmGold: {
    backgroundColor: c.gold,
  },
  modalConfirmDanger: {
    backgroundColor: c.danger,
  },
  modalConfirmBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: c.ink,
  },
});
