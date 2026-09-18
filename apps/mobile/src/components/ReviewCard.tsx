import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Stars } from './Shared';
import { useTheme } from '../hooks/useTheme';

const fmtDate = (d: string) => new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

type Props = {
  guest: string;
  rating: number;
  date: string;
  comment: string;
  stay?: string;
};

export default React.memo(function ReviewCard({ guest, rating, date, comment, stay }: Props) {
  const { colors: c } = useTheme();
  const s = makeStyles(c);

  return (
    <View style={s.card}>
      <View style={s.header}>
        <View style={s.avatar}>
          <Text style={s.avatarText}>{guest.charAt(0)}</Text>
        </View>
        <View style={s.headerText}>
          <Text style={s.guestName}>{guest}</Text>
          <Text style={s.dateText}>{fmtDate(date)}{stay ? ` \u00B7 ${stay}` : ''}</Text>
        </View>
        <Stars value={rating} size={13} />
      </View>
      <Text style={s.comment}>{`\u201C${comment}\u201D`}</Text>
    </View>
  );
});

const makeStyles = (c: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  card: { backgroundColor: c.surface, borderRadius: 14, borderWidth: 1, borderColor: c.line, padding: 14 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: c.line, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: 'Georgia', fontSize: 14, fontWeight: '700', color: c.inkSoft },
  headerText: { flex: 1 },
  guestName: { fontSize: 14, fontWeight: '600', color: c.ink },
  dateText: { fontSize: 12, color: c.inkMuted },
  comment: { marginTop: 10, fontSize: 14, lineHeight: 20, color: c.inkSoft },
});
