import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Stars } from './Shared';
import { colors, font, radius } from '../theme';

const fmtDate = (d: string) => new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

type Props = {
  guest: string;
  rating: number;
  date: string;
  comment: string;
  stay?: string;
};

export default React.memo(function ReviewCard({ guest, rating, date, comment, stay }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{guest.charAt(0)}</Text>
        </View>
        <View style={styles.headerText}>
          <Text style={styles.guestName}>{guest}</Text>
          <Text style={styles.dateText}>{fmtDate(date)}{stay ? ` · ${stay}` : ''}</Text>
        </View>
        <Stars value={rating} size={13} />
      </View>
      <Text style={styles.comment}>{`\u201c${comment}\u201d`}</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colors.line, padding: 14 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: font.display, fontSize: 14, fontWeight: '700', color: colors.inkSoft },
  headerText: { flex: 1 },
  guestName: { fontSize: 14, fontWeight: '600', color: colors.ink },
  dateText: { fontSize: 12, color: colors.inkMuted },
  comment: { marginTop: 10, fontSize: 14, lineHeight: 20, color: colors.inkSoft },
});
