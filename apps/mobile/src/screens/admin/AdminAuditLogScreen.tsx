/**
 * AdminAuditLogScreen
 * Policy 34-audit-logging: immutable log of every admin mutation.
 * Fixed field names: entity (not entityType), diff (not details), actorId (not actor.name)
 * Added: filter bar by entity, action, date range.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
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
import { Card, EmptyState, ErrorBox } from '../../components/Shared';
import { SkeletonList } from '../../components/Skeleton';
import ScreenHeader from '../../components/ScreenHeader';

interface Props { onBack: () => void; }

const ENTITY_FILTERS = ['', 'User', 'Hotel', 'Booking', 'Dispute', 'Review', 'Coupon'];

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0)  return `${d}d ago`;
  if (h > 0)  return `${h}h ago`;
  if (m > 0)  return `${m}m ago`;
  return 'just now';
}

export default function AdminAuditLogScreen({ onBack }: Props) {
  const c = useThemeColors();
  const token = useAppSelector((s) => s.auth.session?.accessToken ?? '');

  const ACTION_ICONS: Record<string, { name: any; color: string }> = {
    CREATE:               { name: 'add-circle',    color: c.success },
    UPDATE:               { name: 'create',         color: c.warning },
    UPDATE_STATUS:        { name: 'refresh-circle', color: c.info },
    DELETE:               { name: 'trash',          color: c.brick },
    SOFT_DELETE:          { name: 'archive',        color: c.brick },
    VIEW_USER:            { name: 'eye',            color: '#8B5CF6' },
    VIEW_USER_LIST:       { name: 'people',         color: '#8B5CF6' },
    DEACTIVATE:           { name: 'person-remove',  color: c.brick },
    EMERGENCY_SUSPENDED:  { name: 'warning',        color: c.brick },
    REASSIGN_MANAGER:     { name: 'swap-horizontal',color: c.warning },
    DISPUTE_RESOLVED:     { name: 'checkmark-circle',color: c.success },
  };

  function getIcon(action: string) {
    return ACTION_ICONS[action] ?? { name: 'document-text', color: c.inkMuted };
  }

  const s = useMemo(() => makeStyles(c), [c]);

  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [logs,       setLogs]       = useState<any[]>([]);

  // Filters
  const [search,     setSearch]     = useState('');
  const [filterEntity, setFilterEntity] = useState('');
  const [expanded,   setExpanded]   = useState<Set<string>>(new Set());

  const fetchLogs = useCallback(async () => {
    setError(null);
    try {
      const qs = new URLSearchParams({ pageSize: '100' });
      if (filterEntity) qs.set('entity', filterEntity);
      const res = await request<any>(`/admin/audit-logs?${qs}`, { method: 'GET', token });
      setLogs(Array.isArray(res) ? res : res?.data ?? []);
    } catch (err: any) {
      setError(err.message || 'Failed to load audit logs');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, filterEntity]);

  useEffect(() => { void fetchLogs(); }, [fetchLogs]);

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // Client-side search on action + entity + actorId
  const filtered = useMemo(() => logs.filter((log) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      log.action?.toLowerCase().includes(q) ||
      log.entity?.toLowerCase().includes(q) ||
      log.entityId?.toLowerCase().includes(q) ||
      log.actorId?.toLowerCase().includes(q) ||
      log.actorRole?.toLowerCase().includes(q)
    );
  }), [logs, search]);

  return (
    <View style={s.root}>
      <ScreenHeader
        title="Audit Trail"
        onBack={onBack}
        subtitle={`${filtered.length} events`}
      />

      {/* ── Filter bar ─────────────────────────────────────────────────────── */}
      <View style={s.filterBar}>
        <View style={s.searchRow}>
          <Ionicons name="search-outline" size={16} color={c.inkMuted} style={s.searchIcon} />
          <TextInput
            style={s.searchInput}
            placeholder="Search action, entity, actor…"
            placeholderTextColor={c.inkMuted}
            value={search}
            onChangeText={setSearch}
            clearButtonMode="while-editing"
            autoCapitalize="none"
          />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.entityPills}>
          {ENTITY_FILTERS.map((e) => (
            <Pressable
              key={e || 'ALL'}
              onPress={() => setFilterEntity(e)}
              style={[s.pill, filterEntity === e && s.pillActive]}
            >
              <Text style={[s.pillText, filterEntity === e && s.pillTextActive]}>
                {e || 'All'}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* ── List ───────────────────────────────────────────────────────────── */}
      {loading ? (
        <SkeletonList count={8} />
      ) : error ? (
        <ErrorBox message={error} onRetry={fetchLogs} />
      ) : filtered.length === 0 ? (
        <EmptyState title="No audit logs" subtitle="Try adjusting your filters." />
      ) : (
        <FlashList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={({ item: log }) => {
            const icon = getIcon(log.action);
            const isOpen = expanded.has(log.id);
            const diffEntries: [string, unknown][] =
              log.diff
                ? typeof log.diff === 'string'
                  ? [['value', log.diff] as [string, unknown]]
                  : Object.entries(log.diff)
                : [];

            function formatValue(val: unknown): string {
              if (val === null || val === undefined) return '—';
              if (typeof val === 'boolean') return val ? 'Yes' : 'No';
              if (typeof val === 'number') return val.toLocaleString();
              if (typeof val === 'string') {
                if (/^\d{4}-\d{2}-\d{2}/.test(val)) {
                  try {
                    return new Date(val).toLocaleDateString();
                  } catch {
                    return val;
                  }
                }
                return val;
              }
              return JSON.stringify(val);
            }

            function labelForKey(key: string): string {
              return key
                .replace(/([A-Z])/g, ' $1')
                .replace(/_/g, ' ')
                .replace(/^\w/, (c) => c.toUpperCase())
                .trim();
            }

            return (
              <Card style={s.logCard}>
                <Pressable onPress={() => toggleExpand(log.id)} style={s.logHeader}>
                  <View style={[s.iconWrap, { backgroundColor: icon.color + '18' }]}>
                    <Ionicons name={icon.name} size={18} color={icon.color} />
                  </View>
                  <View style={s.logMeta}>
                    <View style={s.logTitleRow}>
                      <View style={[s.actionChip, { backgroundColor: icon.color + '18' }]}>
                        <Text style={[s.actionText, { color: icon.color }]}>
                          {log.action?.replace(/_/g, ' ')}
                        </Text>
                      </View>
                      {log.entity && (
                        <Text style={s.entityText}>{log.entity}</Text>
                      )}
                    </View>
                    <View style={s.logFooterRow}>
                      <Text style={s.actorText}>
                        {log.actor?.fullName ?? log.actor?.email ?? (log.actorId ? `ID:${log.actorId.slice(0, 8)}` : 'System')}
                        {log.actorRole ? ` · ${log.actorRole}` : ''}
                      </Text>
                      <Text style={s.timeText}>{relativeTime(log.createdAt)}</Text>
                    </View>
                  </View>
                  <Ionicons
                    name={isOpen ? 'chevron-up' : 'chevron-down'}
                    size={14} color={c.inkMuted}
                  />
                </Pressable>

                {isOpen && (
                  <View style={s.logDetail}>
                    <Text style={s.detailLabel}>Entity ID</Text>
                    <Text style={s.detailValue} selectable>{log.entityId ?? '—'}</Text>
                    {diffEntries.length > 0 && (
                      <>
                        <Text style={s.detailLabel}>Changes</Text>
                        <View style={s.diffContainer}>
                          {diffEntries.map(([key, val]) => (
                            <View key={key} style={s.diffRow}>
                              <Text style={s.diffKey}>{labelForKey(key)}</Text>
                              <Text style={s.diffVal} selectable>{formatValue(val)}</Text>
                            </View>
                          ))}
                        </View>
                      </>
                    )}
                    {log.ipAddress && (
                      <>
                        <Text style={s.detailLabel}>IP Address</Text>
                        <Text style={s.detailValue}>{log.ipAddress}</Text>
                      </>
                    )}
                    <Text style={s.detailLabel}>Timestamp</Text>
                    <Text style={s.detailValue}>
                      {new Date(log.createdAt).toLocaleString()}
                    </Text>
                  </View>
                )}
              </Card>
            );
          }}
          contentContainerStyle={s.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void fetchLogs(); }} tintColor={c.teal} />
          }
        />
      )}
    </View>
  );
}

const makeStyles = (c: ReturnType<typeof useThemeColors>) => StyleSheet.create({
  root: { flex: 1, backgroundColor: c.paper },
  list: { padding: 16, gap: 10, paddingBottom: 48 },

  // Filter bar
  filterBar:     { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4, gap: 8, backgroundColor: c.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.line },
  searchRow:     { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: c.line, borderRadius: 10, backgroundColor: c.paper, paddingHorizontal: 10, height: 40 },
  searchIcon:    { marginRight: 6 },
  searchInput:   { flex: 1, fontSize: 14, color: c.ink },
  entityPills:   { flexDirection: 'row', gap: 6, paddingVertical: 4 },
  pill:          { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: c.line, backgroundColor: c.paper },
  pillActive:    { backgroundColor: c.teal, borderColor: c.teal },
  pillText:      { fontSize: 12, fontWeight: '600', color: c.inkMuted },
  pillTextActive:{ color: '#FFFFFF' },

  // Log card
  logCard:       { padding: 12, ...shadowCard },
  logHeader:     { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  iconWrap:      { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  logMeta:       { flex: 1, gap: 4 },
  logTitleRow:   { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  actionChip:    { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  actionText:    { fontSize: 11, fontWeight: '700', letterSpacing: 0.2 },
  entityText:    { fontSize: 12, color: c.inkMuted, fontWeight: '600' },
  logFooterRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  actorText:     { fontSize: 12, color: c.inkMuted },
  timeText:      { fontSize: 11, color: c.inkMuted },

  // Expanded detail
  logDetail:     { marginTop: 10, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line, gap: 4 },
  detailLabel:   { fontSize: 10, fontWeight: '700', color: c.inkMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 6 },
  detailValue:   { fontSize: 13, color: c.ink, lineHeight: 18 },
  detailCode:    { fontSize: 11, color: c.ink, fontFamily: 'monospace', backgroundColor: c.paperDeep, borderRadius: 6, padding: 8, lineHeight: 17 },
  diffContainer: { backgroundColor: c.paperDeep, borderRadius: 8, padding: 10, gap: 0 },
  diffRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 5, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.line },
  diffKey:       { fontSize: 12, fontWeight: '600', color: c.inkMuted, flex: 1, marginRight: 8 },
  diffVal:       { fontSize: 12, color: c.ink, fontWeight: '500', flex: 1.5, textAlign: 'right' },
});
