/**
 * booking/_shared.ts
 * Design tokens, shadows, and status config shared across all booking components.
 */
import { Platform, StyleSheet } from 'react-native';

// ─── Design tokens ─────────────────────────────────────────────────────────
export const BK = {
  // Core palette
  navy:       '#1A2B4A',
  navyMid:    '#2D3F5C',
  navyMuted:  '#5A6D8A',
  navySubtle: '#94A7BF',
  white:      '#FFFFFF',
  bg:         '#F8F9FB',
  bgDeep:     '#EEF1F6',
  border:     '#E4E8F0',
  borderSoft: '#F0F3F8',

  // Status semantic colors
  pending:    '#F59E0B',
  pendingBg:  '#FFFBEB',
  pendingBd:  '#FDE68A',

  confirmed:  '#10B981',
  confirmedBg:'#F0FDF4',
  confirmedBd:'#BBF7D0',

  checkedIn:  '#3B82F6',
  checkedInBg:'#EFF6FF',
  checkedInBd:'#BFDBFE',

  checkedOut: '#6B7280',
  checkedOutBg:'#F9FAFB',
  checkedOutBd:'#E5E7EB',

  cancelled:  '#EF4444',
  cancelledBg:'#FEF2F2',
  cancelledBd:'#FECACA',

  noShow:     '#374151',
  noShowBg:   '#F3F4F6',
  noShowBd:   '#D1D5DB',

  gold:       '#D4AF37',
  goldBg:     '#FBF4E5',

  // Text
  text:       '#1A2B4A',
  textSec:    '#5A6D8A',
  textMut:    '#94A7BF',
} as const;

export const SHADOW = Platform.select({
  ios:     { shadowColor: '#1A2B4A', shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: 4 } },
  android: { elevation: 3 },
  default: {},
});
export const SHADOW_SM = Platform.select({
  ios:     { shadowColor: '#1A2B4A', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  android: { elevation: 1 },
  default: {},
});

// ─── Status config ──────────────────────────────────────────────────────────
export interface StatusConfig {
  label:   string;
  color:   string;
  bg:      string;
  border:  string;
  icon:    string;
  iconLib: 'ionicons';
  emoji:   string;
  friendlyTitle: string;
  friendlyDesc:  string;
  step:    number;
}

export const STATUS_CONFIG: Record<string, StatusConfig> = {
  PENDING: {
    label: 'Pending',
    color: BK.pending, bg: BK.pendingBg, border: BK.pendingBd,
    icon: 'time-outline', iconLib: 'ionicons', emoji: '🟡',
    friendlyTitle: 'Awaiting Confirmation',
    friendlyDesc:  'Your booking is waiting for the hotel to confirm.',
    step: 0,
  },
  CONFIRMED: {
    label: 'Confirmed',
    color: BK.confirmed, bg: BK.confirmedBg, border: BK.confirmedBd,
    icon: 'checkmark-circle', iconLib: 'ionicons', emoji: '🟢',
    friendlyTitle: 'Booking Confirmed',
    friendlyDesc:  "You're all set. See you at check-in.",
    step: 1,
  },
  CHECKED_IN: {
    label: 'Checked In',
    color: BK.checkedIn, bg: BK.checkedInBg, border: BK.checkedInBd,
    icon: 'bed', iconLib: 'ionicons', emoji: '🔵',
    friendlyTitle: 'Checked In',
    friendlyDesc:  "You're currently staying with us.",
    step: 2,
  },
  CHECKED_OUT: {
    label: 'Checked Out',
    color: BK.checkedOut, bg: BK.checkedOutBg, border: BK.checkedOutBd,
    icon: 'checkmark-done-circle', iconLib: 'ionicons', emoji: '⚪',
    friendlyTitle: 'Stay Completed',
    friendlyDesc:  'We hope you had a wonderful stay.',
    step: 3,
  },
  CANCELLED: {
    label: 'Cancelled',
    color: BK.cancelled, bg: BK.cancelledBg, border: BK.cancelledBd,
    icon: 'close-circle', iconLib: 'ionicons', emoji: '🔴',
    friendlyTitle: 'Booking Cancelled',
    friendlyDesc:  'This reservation has been cancelled.',
    step: -1,
  },
  NO_SHOW: {
    label: 'No Show',
    color: BK.noShow, bg: BK.noShowBg, border: BK.noShowBd,
    icon: 'person-remove-outline', iconLib: 'ionicons', emoji: '⚫',
    friendlyTitle: 'No Show',
    friendlyDesc:  'Guest did not check in for this reservation.',
    step: -1,
  },
};

export const getConfig = (status: string): StatusConfig =>
  STATUS_CONFIG[status] ?? STATUS_CONFIG.PENDING;

// ─── Shared modal styles ────────────────────────────────────────────────────
export const modalStyles = StyleSheet.create({
  overlay:        { flex: 1, backgroundColor: 'rgba(15,23,42,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  card:           { width: '100%', maxWidth: 380, backgroundColor: BK.white, borderRadius: 20, padding: 20, alignItems: 'center', gap: 12, ...SHADOW },
  iconCircle:     { width: 64, height: 64, borderRadius: 32, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  title:          { fontSize: 18, fontWeight: '800', color: BK.navy, textAlign: 'center', letterSpacing: -0.3 },
  desc:           { fontSize: 13, color: BK.textSec, textAlign: 'center', lineHeight: 19 },
  btnRow:         { flexDirection: 'row', gap: 10, width: '100%', marginTop: 8 },
  btn:            { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 12, minHeight: 48, paddingHorizontal: 14 },
  btnPrimary:     { backgroundColor: BK.navy },
  btnPrimaryText: { color: BK.white, fontSize: 14, fontWeight: '700' },
  btnSecondary:   { backgroundColor: BK.bg, borderWidth: 1, borderColor: BK.border },
  btnSecondaryText:{ color: BK.navy, fontSize: 14, fontWeight: '600' },
});
