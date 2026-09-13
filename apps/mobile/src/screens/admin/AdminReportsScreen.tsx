/**
 * AdminReportsScreen
 * Policy: Admin must be able to VIEW live report data AND export.
 * Fix: Added live data display for all 5 report types above the export section.
 * Correct routes: /admin/reports/overview, /admin/reports/revenue, etc.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppSelector } from '../../store/hooks';
import { request, requestBlob } from '../../api';
import { useThemeColors, shadowCard } from '../../theme';
import { Card, ErrorBox } from '../../components/Shared';
import { SkeletonCard } from '../../components/Skeleton';
import { useToast } from '../../components/Toast';
import ScreenHeader from '../../components/ScreenHeader';

interface Props { onBack: () => void; }

// ── Mini bar chart ────────────────────────────────────────────────────────────
function BarChart({ data, labelKey, valueKey, color, c }: {
  data: any[]; labelKey: string; valueKey: string; color?: string; c: ReturnType<typeof useThemeColors>;
}) {
  const barColor = color ?? c.teal;
  const bc = useMemo(() => makeBcStyles(c), [c]);
  if (!data?.length) return null;
  const max = Math.max(...data.map((d) => Number(d[valueKey] ?? 0)), 1);
  return (
    <View style={bc.wrap}>
      {data.slice(0, 8).map((item, i) => {
        const pct = Number(item[valueKey] ?? 0) / max;
        return (
          <View key={i} style={bc.col}>
            <Text style={bc.val} numberOfLines={1}>
              {Number(item[valueKey] ?? 0) >= 1000
                ? `${(Number(item[valueKey]) / 1000).toFixed(1)}k`
                : String(item[valueKey] ?? 0)}
            </Text>
            <View style={bc.track}>
              <View style={[bc.bar, { height: Math.max(4, pct * 80), backgroundColor: barColor }]} />
            </View>
            <Text style={bc.label} numberOfLines={1}>{String(item[labelKey] ?? '').slice(0, 4)}</Text>
          </View>
        );
      })}
    </View>
  );
}
const makeBcStyles = (c: ReturnType<typeof useThemeColors>) => StyleSheet.create({
  wrap:  { flexDirection: 'row', alignItems: 'flex-end', gap: 6, paddingTop: 8 },
  col:   { flex: 1, alignItems: 'center', gap: 3 },
  track: { width: '100%', height: 80, justifyContent: 'flex-end' },
  bar:   { width: '100%', borderRadius: 4 },
  val:   { fontSize: 11, color: c.inkMuted, fontWeight: '600' },
  label: { fontSize: 11, color: c.inkMuted },
});

// ── KPI card ─────────────────────────────────────────────────────────────────
function KpiCard({ label, value, icon, color, c }: { label: string; value: string | number; icon: any; color: string; c: ReturnType<typeof useThemeColors> }) {
  const kpi = useMemo(() => makeKpiStyles(c), [c]);
  return (
    <View style={[kpi.card, shadowCard]}>
      <View style={[kpi.iconWrap, { backgroundColor: color + '18' }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text style={kpi.value} numberOfLines={1} adjustsFontSizeToFit>{String(value)}</Text>
      <Text style={kpi.label}>{label}</Text>
    </View>
  );
}
const makeKpiStyles = (c: ReturnType<typeof useThemeColors>) => StyleSheet.create({
  card:    { flex: 1, backgroundColor: c.surface, borderRadius: 14, padding: 14, alignItems: 'flex-start', gap: 6, borderWidth: 1, borderColor: c.line },
  iconWrap:{ width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  value:   { fontSize: 20, fontWeight: '800', color: c.ink },
  label:   { fontSize: 11, color: c.inkMuted, fontWeight: '600' },
});

export default function AdminReportsScreen({ onBack }: Props) {
  const c = useThemeColors();
  const s = useMemo(() => makeStyles(c), [c]);

  const token = useAppSelector((s) => s.auth.session?.accessToken ?? '');
  const toast = useToast();

  const [loading,   setLoading]   = useState(true);
  const [refreshing,setRefreshing]= useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [overview,  setOverview]  = useState<any>(null);
  const [revenue,   setRevenue]   = useState<any[]>([]);
  const [trends,    setTrends]    = useState<any[]>([]);
  const [topHotels, setTopHotels] = useState<any[]>([]);
  const [exporting, setExporting] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setError(null);
    try {
      const [ov, rv, tr, th] = await Promise.all([
        request<any>('/admin/reports/overview',            { token }),
        request<any>('/admin/reports/monthly-revenue?months=6', { token }),
        request<any>('/admin/reports/booking-trends?days=30',    { token }),
        request<any>('/admin/reports/most-booked-hotels?limit=5',{ token }),
      ]);
      setOverview(ov);
      setRevenue(Array.isArray(rv) ? rv : rv?.data ?? []);
      setTrends(Array.isArray(tr) ? tr : tr?.data ?? []);
      setTopHotels(Array.isArray(th) ? th : th?.data ?? []);
    } catch (err: any) {
      setError(err.message || 'Failed to load reports');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => { void fetchAll(); }, [fetchAll]);

  const handleExport = async (type: string) => {
    setExporting(type);
    try {
      await requestBlob(`/admin/reports/${type}?format=csv`, { method: 'GET', token });
      toast('success', `${type} report exported`);
    } catch (err: any) {
      toast('error', err.message || 'Export failed');
    } finally {
      setExporting(null);
    }
  };

  const fmt = (n: number) =>
    n >= 1_000_000 ? `ETB ${(n / 1_000_000).toFixed(1)}M`
    : n >= 1000 ? `ETB ${(n / 1000).toFixed(1)}k`
    : `ETB ${n}`;

  if (loading) {
    return (
      <View style={s.root}>
        <ScreenHeader title="Platform Reports" onBack={onBack} />
        <ScrollView contentContainerStyle={s.list}>
          <SkeletonCard /><SkeletonCard /><SkeletonCard />
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={s.root}>
      <ScreenHeader title="Platform Reports" onBack={onBack} />

      <ScrollView
        contentContainerStyle={s.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void fetchAll(); }} tintColor={c.teal} />
        }
      >
        {error && <ErrorBox message={error} onRetry={fetchAll} />}

        {/* ── Overview KPIs ────────────────────────────────────────────────── */}
        {overview && (
          <>
            <Text style={s.sectionTitle}>Platform Overview</Text>
            <View style={s.kpiRow}>
              <KpiCard label="Hotels"   value={overview.hotelCount   ?? 0} icon="business"  color={c.info} c={c} />
              <KpiCard label="Users"    value={overview.userCount    ?? 0} icon="people"    color="#7C3AED" c={c} />
            </View>
            <View style={s.kpiRow}>
              <KpiCard label="Bookings" value={overview.bookingCount ?? 0} icon="calendar"  color={c.warning} c={c} />
              <KpiCard label="Revenue"  value={fmt(overview.totalRevenue ?? 0)} icon="cash" color={c.success} c={c} />
            </View>

            {/* Bookings by status */}
            {overview.bookingsByStatus && (
              <Card style={s.card}>
                <Text style={s.cardTitle}>Bookings by Status</Text>
                <View style={s.statusGrid}>
                  {Object.entries(overview.bookingsByStatus).map(([status, count]) => (
                    <View key={status} style={s.statusItem}>
                      <Text style={s.statusCount}>{String(count)}</Text>
                      <Text style={s.statusLabel}>{status.replace('_', ' ')}</Text>
                    </View>
                  ))}
                </View>
              </Card>
            )}
          </>
        )}

        {/* ── Monthly Revenue chart ─────────────────────────────────────────── */}
        {revenue.length > 0 && (
          <Card style={s.card}>
            <Text style={s.cardTitle}>Monthly Revenue (6 months)</Text>
            <BarChart
              data={revenue}
              labelKey="month"
              valueKey="revenue"
              color={c.success}
              c={c}
            />
          </Card>
        )}

        {/* ── Booking trends chart ──────────────────────────────────────────── */}
        {trends.length > 0 && (
          <Card style={s.card}>
            <Text style={s.cardTitle}>Booking Trends (30 days)</Text>
            <BarChart
              data={trends}
              labelKey="date"
              valueKey="count"
              color={c.teal}
              c={c}
            />
          </Card>
        )}

        {/* ── Top hotels ───────────────────────────────────────────────────── */}
        {topHotels.length > 0 && (
          <Card style={s.card}>
            <Text style={s.cardTitle}>Top Hotels by Bookings</Text>
            {topHotels.map((h, i) => (
              <View key={h.id ?? i} style={[s.rankRow, i < topHotels.length - 1 && s.rankRowBorder]}>
                <View style={s.rankBadge}>
                  <Text style={s.rankNum}>#{i + 1}</Text>
                </View>
                <Text style={s.rankName} numberOfLines={1}>{h.name}</Text>
                <Text style={s.rankCount}>{h.bookingCount ?? h._count?.bookings ?? 0} bookings</Text>
              </View>
            ))}
          </Card>
        )}

        {/* ── Export section ────────────────────────────────────────────────── */}
        <Text style={s.sectionTitle}>Export Reports</Text>
        <Card style={s.card}>
          <Text style={s.exportHint}>Download reports as CSV for external analysis.</Text>
          <View style={s.exportGrid}>
            {[
              { key: 'booking-trends', label: 'Bookings', icon: 'calendar-outline' },
              { key: 'revenue',        label: 'Revenue',  icon: 'cash-outline'     },
              { key: 'occupancy',      label: 'Occupancy',icon: 'bed-outline'      },
              { key: 'overview',       label: 'Overview', icon: 'stats-chart'      },
            ].map((rpt) => (
              <Pressable
                key={rpt.key}
                onPress={() => handleExport(rpt.key)}
                disabled={!!exporting}
                style={({ pressed }) => [s.exportBtn, pressed && { opacity: 0.75 }]}
                accessibilityRole="button"
                accessibilityLabel={`Export ${rpt.label} report`}
              >
                <Ionicons name={rpt.icon as any} size={20} color={exporting === rpt.key ? c.inkMuted : c.teal} />
                <Text style={s.exportBtnText}>
                  {exporting === rpt.key ? 'Exporting…' : rpt.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </Card>
      </ScrollView>
    </View>
  );
}

const makeStyles = (c: ReturnType<typeof useThemeColors>) => StyleSheet.create({
  root:        { flex: 1, backgroundColor: c.paper },
  list:        { padding: 16, gap: 12, paddingBottom: 48 },
  sectionTitle:{ fontSize: 15, fontWeight: '800', color: c.ink, marginTop: 8, marginBottom: 4 },
  kpiRow:      { flexDirection: 'row', gap: 10 },
  card:        { padding: 16, ...shadowCard },
  cardTitle:   { fontSize: 14, fontWeight: '700', color: c.ink, marginBottom: 10 },
  statusGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 },
  statusItem:  { alignItems: 'center', minWidth: 70 },
  statusCount: { fontSize: 20, fontWeight: '800', color: c.ink },
  statusLabel: { fontSize: 10, color: c.inkMuted, textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.3 },
  rankRow:     { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  rankRowBorder:{ borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.line },
  rankBadge:   { width: 28, height: 28, borderRadius: 8, backgroundColor: c.paperDeep, alignItems: 'center', justifyContent: 'center' },
  rankNum:     { fontSize: 12, fontWeight: '800', color: c.inkMuted },
  rankName:    { flex: 1, fontSize: 14, fontWeight: '600', color: c.ink },
  rankCount:   { fontSize: 12, color: c.inkMuted },
  exportHint:  { fontSize: 12, color: c.inkMuted, marginBottom: 12 },
  exportGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  exportBtn:   { width: '47%', borderWidth: 1, borderColor: c.line, borderRadius: 10, padding: 14, alignItems: 'center', gap: 6, backgroundColor: c.paper },
  exportBtnText:{ fontSize: 13, fontWeight: '600', color: c.ink },
});
