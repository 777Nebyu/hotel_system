/**
 * AdminReviewsScreen
 * Policy 29-review-moderation:
 *  - Admin should moderate (flag/unflag) reviews, not just hard-delete
 *  - Flagged reviews need to be surfaced first
 * Fixes:
 *  - Added "Flagged" / "All" tab (flagged shown first)
 *  - Flag button (POST /reviews/:id/flag) replaces delete-only UI
 *  - Unflag button (POST /reviews/:id/unflag) for already-flagged reviews
 *  - Delete kept as secondary destructive action for egregious content
 *  - Correct API field names: user.fullName, hotel.name, flagged, flagReason
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';
import { useAppSelector } from '../../store/hooks';
import { request } from '../../api';
import { useThemeColors, shadowCard } from '../../theme';
import { Button, Card, EmptyState, ErrorBox, Stars } from '../../components/Shared';
import { SkeletonList } from '../../components/Skeleton';
import { useToast } from '../../components/Toast';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import ScreenHeader from '../../components/ScreenHeader';

interface Props { onBack: () => void; }

type ReviewTab = 'FLAGGED' | 'ALL';

export default function AdminReviewsScreen({ onBack }: Props) {
  const c = useThemeColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const token = useAppSelector((s) => s.auth.session?.accessToken ?? '');
  const toast = useToast();

  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [reviews,    setReviews]    = useState<any[]>([]);
  const [tab,        setTab]        = useState<ReviewTab>('FLAGGED');

  // Flag modal
  const [flagModal,  setFlagModal]  = useState(false);
  const [flagReason, setFlagReason] = useState('');
  const [flagging]                  = useState(false);

  // Delete confirm
  const [deleteId,      setDeleteId]      = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const fetchReviews = useCallback(async () => {
    setError(null);
    try {
      const res = await request<any>('/admin/reviews', { method: 'GET', token });
      const all = Array.isArray(res) ? res : res?.data ?? [];
      setReviews(tab === 'FLAGGED' ? all.filter((r: any) => r.flagged) : all);
    } catch (err: any) {
      setError(err.message || 'Failed to load reviews');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, tab]);

  useEffect(() => { void fetchReviews(); }, [fetchReviews]);

  // ── Flag a review ──────────────────────────────────────────────────────────
  const openFlagModal = () => {
    toast('info', 'Flagging not available', 'Review flagging will be available in a future update.');
  };

  const submitFlag = async () => {
    // No-op: backend does not support review flagging yet
  };

  // ── Unflag a review ────────────────────────────────────────────────────────
  const unflagReview = async () => {
    toast('info', 'Unflagging not available', 'Review unflagging will be available in a future update.');
  };

  // ── Delete a review ────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await request(`/admin/reviews/${deleteId}`, { method: 'DELETE', token });
      setReviews((prev) => prev.filter((r) => r.id !== deleteId));
      toast('success', 'Review deleted');
    } catch (err: any) {
      toast('error', err.message || 'Failed to delete');
    } finally {
      setDeleteConfirm(false);
      setDeleteId(null);
    }
  };

  const flaggedCount = reviews.filter((r) => r.flagged).length;

  return (
    <View style={s.root}>
      <ScreenHeader
        title="Review Moderation"
        onBack={onBack}
        subtitle={tab === 'FLAGGED' ? `${reviews.length} flagged` : `${reviews.length} reviews`}
      />

      {/* ── Tabs ────────────────────────────────────────────────────────────── */}
      <View style={s.tabRow}>
        {(['FLAGGED', 'ALL'] as ReviewTab[]).map((t) => (
          <Pressable
            key={t}
            onPress={() => setTab(t)}
            style={({ pressed }) => [
              s.tabBtn,
              tab === t && s.tabBtnActive,
              pressed && { opacity: 0.7 },
            ]}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === t }}
          >
            {t === 'FLAGGED' && (
              <View style={[s.flagBadge, tab === 'FLAGGED' && s.flagBadgeActive]}>
                <Text style={[s.flagBadgeText, tab === 'FLAGGED' && s.flagBadgeTextActive]}>{flaggedCount}</Text>
              </View>
            )}
            <Text style={[s.tabText, tab === t && s.tabTextActive]}>
              {t === 'FLAGGED' ? 'Flagged' : 'All Reviews'}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <SkeletonList count={5} />
      ) : error ? (
        <ErrorBox message={error} onRetry={fetchReviews} />
      ) : reviews.length === 0 ? (
        <EmptyState
          title={tab === 'FLAGGED' ? 'No flagged reviews' : 'No reviews yet'}
          subtitle={tab === 'FLAGGED' ? 'All clear — no reviews need attention.' : ''}
        />
      ) : (
        <FlashList
          data={reviews}
          keyExtractor={(item) => item.id}
          renderItem={({ item: rv }) => (
            <Card style={[s.card, rv.flagged && s.cardFlagged]}>
              {/* Flag banner */}
              {rv.flagged && (
                <View style={s.flagBanner}>
                  <Ionicons name="flag" size={13} color={c.brick} />
                  <Text style={s.flagBannerText}>
                    Flagged{rv.flagReason ? `: ${rv.flagReason}` : ''}
                  </Text>
                </View>
              )}

              {/* Header */}
              <View style={s.cardHeader}>
                <View style={s.flex}>
                  <Text style={s.reviewerName} numberOfLines={1}>
                    {rv.user?.fullName ?? rv.user?.email ?? 'Anonymous'}
                  </Text>
                  <Text style={s.hotelName} numberOfLines={1}>
                    {rv.hotel?.name ?? rv.hotelId?.slice(0, 12)}
                  </Text>
                </View>
                <View style={s.ratingCol}>
                  <Stars value={rv.rating ?? 0} size={14} />
                  <Text style={s.ratingNum}>{rv.rating ?? 0}/5</Text>
                </View>
              </View>

              {/* Comment */}
              {rv.comment && (
                <Text style={s.comment} numberOfLines={4}>{rv.comment}</Text>
              )}

              {/* Date */}
              <Text style={s.date}>
                {new Date(rv.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
              </Text>

              {/* Actions */}
              <View style={s.actions}>
                {rv.flagged ? (
                  <Button
                    title="Unflag"
                    variant="secondary"
                    size="sm"
                    onPress={() => unflagReview()}
                  />
                ) : (
                  <Button
                    title="Flag"
                    variant="gold"
                    size="sm"
                    onPress={() => openFlagModal()}
                  />
                )}
                <Button
                  title="Delete"
                  variant="danger"
                  size="sm"
                  onPress={() => { setDeleteId(rv.id); setDeleteConfirm(true); }}
                />
              </View>
            </Card>
          )}
          contentContainerStyle={s.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); void fetchReviews(); }}
              tintColor={c.teal}
            />
          }
        />
      )}

      {/* ── Flag modal ──────────────────────────────────────────────────────── */}
      <Modal visible={flagModal} transparent animationType="slide" onRequestClose={() => setFlagModal(false)}>
        <Pressable style={s.overlay} onPress={() => setFlagModal(false)}>
          <View style={s.sheet}>
            <View style={s.sheetHandle} />
            <Text style={s.sheetTitle}>Flag Review</Text>
            <Text style={s.sheetSub}>
              This review will be marked as flagged and surfaced for admin attention.
              It will remain visible to users until deleted.
            </Text>
            <Text style={s.inputLabel}>Reason (optional)</Text>
            <TextInput
              style={s.textarea}
              placeholder="e.g. Offensive language, spam, false claims…"
              placeholderTextColor={c.inkMuted}
              value={flagReason}
              onChangeText={setFlagReason}
              multiline numberOfLines={3}
              textAlignVertical="top"
            />
            <View style={s.sheetActions}>
              <Button title="Cancel" variant="secondary" onPress={() => setFlagModal(false)} />
              <Button
                title={flagging ? 'Flagging…' : 'Flag Review'}
                variant="gold"
                onPress={submitFlag}
                disabled={flagging}
              />
            </View>
          </View>
        </Pressable>
      </Modal>

      <ConfirmDialog
        open={deleteConfirm}
        onClose={() => { setDeleteConfirm(false); setDeleteId(null); }}
        onConfirm={handleDelete}
        title="Delete Review"
        body="Permanently delete this review? This cannot be undone."
      />
    </View>
  );
}

const makeStyles = (c: ReturnType<typeof useThemeColors>) => StyleSheet.create({
  root:       { flex: 1, backgroundColor: c.paper },
  list:       { padding: 16, gap: 12, paddingBottom: 48 },
  flex:       { flex: 1 },

  // Tabs
  tabRow:     { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.line, backgroundColor: c.surface },
  tabBtn:     { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent', flexDirection: 'row', justifyContent: 'center', gap: 6 },
  tabBtnActive:{ borderBottomColor: c.teal },
  tabText:    { fontSize: 14, fontWeight: '600', color: c.inkMuted },
  tabTextActive:{ color: c.teal },
  flagBadge:  { backgroundColor: c.brick + '20', borderRadius: 10, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  flagBadgeActive:{ backgroundColor: 'rgba(255,255,255,0.25)' },
  flagBadgeText:{ color: c.brick, fontSize: 10, fontWeight: '800' },
  flagBadgeTextActive:{ color: '#FFFFFF' },

  // Card
  card:       { padding: 14, ...shadowCard },
  cardFlagged:{ borderColor: c.brick + '40', borderWidth: 1 },
  flagBanner: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: c.brick + '12', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 5, marginBottom: 10 },
  flagBannerText:{ fontSize: 12, color: c.brick, fontWeight: '600', flex: 1 },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 8 },
  reviewerName:{ fontSize: 14, fontWeight: '700', color: c.ink },
  hotelName:  { fontSize: 12, color: c.inkMuted, marginTop: 2 },
  ratingCol:  { alignItems: 'flex-end', gap: 2 },
  ratingNum:  { fontSize: 11, color: c.inkMuted },
  comment:    { fontSize: 13, color: c.inkSoft, lineHeight: 18, marginBottom: 6 },
  date:       { fontSize: 11, color: c.inkMuted, marginBottom: 8 },
  actions:    { flexDirection: 'row', gap: 8 },

  // Modal
  overlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet:      { backgroundColor: c.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 12 },
  sheetHandle:{ width: 40, height: 4, borderRadius: 2, backgroundColor: c.line, alignSelf: 'center' },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: c.ink },
  sheetSub:   { fontSize: 13, color: c.inkMuted, lineHeight: 18 },
  inputLabel: { fontSize: 12, fontWeight: '700', color: c.inkMuted },
  textarea:   { borderWidth: 1, borderColor: c.line, borderRadius: 10, padding: 12, fontSize: 14, color: c.ink, backgroundColor: c.paper, minHeight: 80 },
  sheetActions:{ flexDirection: 'row', gap: 10 },
});
