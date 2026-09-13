/**
 * AdminCouponsScreen
 * Policy 23-coupon-discount-rules:
 *  - Coupons have discountType: PERCENTAGE | FIXED_AMOUNT
 *  - Admin can activate/deactivate (isActive toggle)
 *  - Create requires: code, value, discountType, validFrom, validTo, usageLimit
 * Fixes:
 *  - Added activate/deactivate toggle (PATCH /admin/coupons/:id)
 *  - Fixed unit label — shows "%" or "ETB" based on discountType
 *  - Added discountType selector (PERCENTAGE / FIXED_AMOUNT)
 *  - Correct field names: timesUsed (not usedCount), usageLimit (not maxUses)
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';
import { useAppSelector } from '../../store/hooks';
import { request } from '../../api';
import { useThemeColors, shadowCard } from '../../theme';
import { Button, Card, EmptyState, ErrorBox, FieldError } from '../../components/Shared';
import { SkeletonList } from '../../components/Skeleton';
import { useToast } from '../../components/Toast';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import ScreenHeader from '../../components/ScreenHeader';

interface Props { onBack: () => void; }

type DiscountType = 'PERCENTAGE' | 'FIXED_AMOUNT';

function fmtValue(value: number, discountType: DiscountType): string {
  return discountType === 'PERCENTAGE' ? `${value}% off` : `ETB ${value} off`;
}

function fmtDate(d?: string): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function AdminCouponsScreen({ onBack }: Props) {
  const tc = useThemeColors();
  const token = useAppSelector((s) => s.auth.session?.accessToken ?? '');
  const toast = useToast();

  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [coupons,    setCoupons]    = useState<any[]>([]);
  const [showForm,   setShowForm]   = useState(false);

  // Form fields
  const [code,          setCode]         = useState('');
  const [value,         setValue]        = useState('');
  const [discountType,  setDiscountType] = useState<DiscountType>('PERCENTAGE');
  const [maxUses,       setMaxUses]      = useState('');
  const [validFrom,     setValidFrom]    = useState('');
  const [validTo,       setValidTo]      = useState('');
  const [creating,      setCreating]     = useState(false);
  const [fieldErrors,   setFieldErrors]  = useState<Record<string, string>>({});

  // Delete confirm
  const [deleteId,      setDeleteId]     = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm]= useState(false);

  const fetchCoupons = useCallback(async () => {
    setError(null);
    try {
      const res = await request<any>('/admin/coupons', { method: 'GET', token });
      setCoupons(Array.isArray(res) ? res : res?.data ?? []);
    } catch (err: any) {
      setError(err.message || 'Failed to load coupons');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => { void fetchCoupons(); }, [fetchCoupons]);

  // ── Create coupon ────────────────────────────────────────────────────────────
  const handleCreate = async () => {
    const errs: Record<string, string> = {};
    if (!code.trim())            errs.code  = 'Code is required.';
    const num = parseFloat(value);
    if (isNaN(num) || num <= 0)  errs.value = 'Enter a valid amount.';
    if (discountType === 'PERCENTAGE' && num > 100) errs.value = 'Percentage cannot exceed 100.';
    if (Object.keys(errs).length) { setFieldErrors(errs); return; }
    setFieldErrors({});
    setCreating(true);
    try {
      const body: Record<string, any> = {
        code:         code.trim().toUpperCase(),
        value:        num,
        discountType,
        usageLimit:   maxUses ? parseInt(maxUses, 10) : undefined,
      };
      if (validFrom.trim()) body.validFrom = validFrom.trim();
      if (validTo.trim())   body.validTo   = validTo.trim();
      const res = await request<any>('/admin/coupons', { method: 'POST', body, token });
      setCoupons((prev) => [res, ...prev]);
      setCode(''); setValue(''); setMaxUses(''); setValidFrom(''); setValidTo('');
      setDiscountType('PERCENTAGE');
      setShowForm(false);
      toast('success', 'Coupon created');
    } catch (err: any) {
      toast('error', err.message || 'Failed to create coupon');
    } finally {
      setCreating(false);
    }
  };

  // ── Toggle active state ──────────────────────────────────────────────────────
  const toggleActive = async (coupon: any) => {
    const next = !coupon.isActive;
    // Optimistic update
    setCoupons((prev) => prev.map((c) => c.id === coupon.id ? { ...c, isActive: next } : c));
    try {
      await request(`/admin/coupons/${coupon.id}`, {
        method: 'PATCH',
        body: { isActive: next },
        token,
      });
      toast('success', next ? 'Coupon activated' : 'Coupon deactivated');
    } catch (err: any) {
      // Rollback
      setCoupons((prev) => prev.map((c) => c.id === coupon.id ? { ...c, isActive: coupon.isActive } : c));
      toast('error', err.message || 'Failed to update coupon');
    }
  };

  // ── Delete coupon ────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await request(`/admin/coupons/${deleteId}`, { method: 'DELETE', token });
      setCoupons((prev) => prev.filter((c) => c.id !== deleteId));
      toast('success', 'Coupon deleted');
    } catch (err: any) {
      toast('error', err.message || 'Failed to delete');
    } finally {
      setDeleteConfirm(false);
      setDeleteId(null);
    }
  };

  const s = useMemo(() => makeStyles(tc), [tc]);

  return (
    <View style={s.root}>
      <ScreenHeader
        title="Coupons"
        onBack={onBack}
        subtitle={`${coupons.filter((c) => c.isActive).length} active`}
        rightElement={
          <Pressable
            onPress={() => setShowForm(!showForm)}
            hitSlop={8}
            accessibilityLabel={showForm ? 'Close form' : 'Create coupon'}
          >
            <Ionicons
              name={showForm ? 'close-circle' : 'add-circle'}
              size={28}
              color={tc.teal}
            />
          </Pressable>
        }
      />

      {showForm && (
        <Card style={s.form}>
          <Text style={s.formTitle}>New Coupon</Text>

          <TextInput
            style={s.input}
            placeholder="Code (e.g. SUMMER20)"
            placeholderTextColor={tc.inkMuted}
            value={code}
            onChangeText={(v) => { setCode(v); setFieldErrors((e) => ({ ...e, code: '' })); }}
            autoCapitalize="characters"
          />
          <FieldError message={fieldErrors.code} />

          <Text style={s.fieldLabel}>Discount Type</Text>
          <View style={s.typeRow}>
            {(['PERCENTAGE', 'FIXED_AMOUNT'] as DiscountType[]).map((dt) => (
              <Pressable
                key={dt}
                onPress={() => setDiscountType(dt)}
                style={[s.typeBtn, discountType === dt && s.typeBtnActive]}
              >
                <Text style={[s.typeBtnText, discountType === dt && s.typeBtnTextActive]}>
                  {dt === 'PERCENTAGE' ? '% Percentage' : 'ETB Fixed Amount'}
                </Text>
              </Pressable>
            ))}
          </View>

          <TextInput
            style={s.input}
            placeholder={discountType === 'PERCENTAGE' ? 'Discount % (e.g. 20)' : 'Amount in ETB (e.g. 50)'}
            placeholderTextColor={tc.inkMuted}
            value={value}
            onChangeText={(v) => { setValue(v); setFieldErrors((e) => ({ ...e, value: '' })); }}
            keyboardType="numeric"
          />
          <FieldError message={fieldErrors.value} />

          <TextInput
            style={s.input}
            placeholder="Max uses (leave blank for unlimited)"
            placeholderTextColor={tc.inkMuted}
            value={maxUses}
            onChangeText={setMaxUses}
            keyboardType="numeric"
          />

          <View style={s.dateRow}>
            <TextInput
              style={[s.input, s.halfInput]}
              placeholder="Valid from (YYYY-MM-DD)"
              placeholderTextColor={tc.inkMuted}
              value={validFrom}
              onChangeText={setValidFrom}
            />
            <TextInput
              style={[s.input, s.halfInput]}
              placeholder="Valid to (YYYY-MM-DD)"
              placeholderTextColor={tc.inkMuted}
              value={validTo}
              onChangeText={setValidTo}
            />
          </View>

          <Button
            title={creating ? 'Creating…' : 'Create Coupon'}
            onPress={handleCreate}
            disabled={creating}
          />
        </Card>
      )}

      {loading ? (
        <SkeletonList count={5} />
      ) : error ? (
        <ErrorBox message={error} onRetry={fetchCoupons} />
      ) : coupons.length === 0 ? (
        <EmptyState title="No coupons" subtitle="Create your first coupon above." />
      ) : (
        <FlashList
          data={coupons}
          keyExtractor={(item) => item.id}
          renderItem={({ item: c }) => (
            <Card style={[s.card, !c.isActive && s.cardInactive]}>
              <View style={s.cardHeader}>
                <View style={s.flex}>
                  <Text style={[s.couponCode, !c.isActive && s.textMuted]}>
                    {c.code}
                  </Text>
                  <Text style={s.couponValue}>
                    {fmtValue(c.value, c.discountType)}
                  </Text>
                </View>
                <View style={s.toggleWrap}>
                  <Text style={[s.toggleLabel, { color: c.isActive ? tc.teal : tc.inkMuted }]}>
                    {c.isActive ? 'Active' : 'Inactive'}
                  </Text>
                  <Switch
                    value={!!c.isActive}
                    onValueChange={() => toggleActive(c)}
                    trackColor={{ false: tc.line, true: tc.teal }}
                    thumbColor={tc.surface}
                    accessibilityLabel={`${c.isActive ? 'Deactivate' : 'Activate'} coupon ${c.code}`}
                  />
                </View>
              </View>

              <View style={s.statsRow}>
                <Text style={s.statText}>
                  Used: {c.timesUsed ?? 0}{c.usageLimit ? ` / ${c.usageLimit}` : ''}
                </Text>
                <Text style={s.statText}>
                  {c.discountType === 'PERCENTAGE' ? 'Percentage' : 'Fixed Amount'}
                </Text>
              </View>

              {(c.validFrom || c.validTo) && (
                <Text style={s.validity}>
                  {fmtDate(c.validFrom)} → {fmtDate(c.validTo)}
                </Text>
              )}

              <Pressable
                onPress={() => { setDeleteId(c.id); setDeleteConfirm(true); }}
                hitSlop={8}
                style={s.deleteBtn}
                accessibilityRole="button"
                accessibilityLabel={`Delete coupon ${c.code}`}
              >
                <Ionicons name="trash-outline" size={18} color={tc.brick} />
                <Text style={s.deleteBtnText}>Delete</Text>
              </Pressable>
            </Card>
          )}
          contentContainerStyle={s.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void fetchCoupons(); }} tintColor={tc.teal} />
          }
        />
      )}

      <ConfirmDialog
        open={deleteConfirm}
        onClose={() => { setDeleteConfirm(false); setDeleteId(null); }}
        onConfirm={handleDelete}
        title="Delete Coupon"
        body="Permanently delete this coupon? Any existing bookings using this code will not be affected."
      />
    </View>
  );
}

const makeStyles = (tc: ReturnType<typeof useThemeColors>) => StyleSheet.create({
  root:         { flex: 1, backgroundColor: tc.paper },
  list:         { padding: 16, gap: 12, paddingBottom: 48 },
  flex:         { flex: 1 },

  // Form
  form:         { padding: 16, gap: 4 },
  formTitle:    { fontSize: 15, fontWeight: '700', color: tc.ink, marginBottom: 8 },
  fieldLabel:   { fontSize: 12, fontWeight: '600', color: tc.inkMuted, marginTop: 4, marginBottom: 6 },
  input:        { borderWidth: 1, borderColor: tc.line, borderRadius: 10, padding: 12, fontSize: 14, color: tc.ink, backgroundColor: tc.paper, marginBottom: 8 },
  dateRow:      { flexDirection: 'row', gap: 8 },
  halfInput:    { flex: 1 },
  typeRow:      { flexDirection: 'row', gap: 8, marginBottom: 10 },
  typeBtn:      { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: tc.line, alignItems: 'center' },
  typeBtnActive:{ borderColor: tc.teal, backgroundColor: tc.tealTint },
  typeBtnText:  { fontSize: 12, fontWeight: '600', color: tc.inkMuted },
  typeBtnTextActive:{ color: tc.teal },

  // Card
  card:         { padding: 14, ...shadowCard },
  cardInactive: { opacity: 0.65 },
  cardHeader:   { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 8 },
  couponCode:   { fontSize: 16, fontWeight: '800', color: tc.teal, letterSpacing: 1 },
  couponValue:  { fontSize: 13, color: tc.inkMuted, marginTop: 3 },
  textMuted:    { color: tc.inkMuted },
  toggleWrap:   { alignItems: 'flex-end', gap: 3 },
  toggleLabel:  { fontSize: 11, fontWeight: '700' },
  statsRow:     { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  statText:     { fontSize: 12, color: tc.inkMuted },
  validity:     { fontSize: 11, color: tc.inkMuted, marginBottom: 8 },
  deleteBtn:    { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4, alignSelf: 'flex-end' },
  deleteBtnText:{ fontSize: 13, color: tc.brick, fontWeight: '600' },
});
