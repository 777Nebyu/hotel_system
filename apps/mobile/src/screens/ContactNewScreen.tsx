import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { RootStackParamList } from '../navigation/types';
import { useAppSelector } from '../store/hooks';
import { Button, Card } from '../components/Shared';
import { useCreateContactThread, useBookingHistory } from '../hooks/useQueries';
import { useTheme } from '../hooks/useTheme';
import { useResponsivePadding } from '../hooks/useResponsivePadding';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { Ionicons } from '@expo/vector-icons';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'ContactNew'>;

export default function ContactNewScreen() {
  const pad = useResponsivePadding();
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const insets = useSafeAreaInsets();
  const { colors: c } = useTheme();
  const session = useAppSelector((s) => s.auth.session);
  const token = session?.accessToken ?? '';
  const { isOffline } = useNetworkStatus();

  const preselectedHotelId = route.params?.hotelId;

  const [hotelId, setHotelId] = useState(preselectedHotelId ?? '');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | undefined>>({});

  const { data: bookingsData } = useBookingHistory(token, 'past');
  const { data: upcomingData } = useBookingHistory(token, 'upcoming');

  const allBookings = [...(upcomingData?.data ?? []), ...(bookingsData?.data ?? [])];
  const hotels = allBookings.reduce<{ id: string; name: string }[]>((acc, b: any) => {
    if (b.hotelName && !acc.find((h) => h.id === b.hotelId)) {
      acc.push({ id: b.hotelId, name: b.hotelName });
    }
    return acc;
  }, []);

  const createThread = useCreateContactThread(token);

  const validateField = (field: string) => {
    const errs: Record<string, string | undefined> = {};
    if (field === 'subject' && !subject.trim()) errs.subject = t('errors.missing_details');
    if (field === 'message' && !message.trim()) errs.message = t('errors.missing_details');
    setFieldErrors((prev) => ({ ...prev, ...errs, [field]: errs[field] || undefined }));
  };

  const handleSubmit = async () => {
    if (isOffline) {
      return Alert.alert(t('common.offline'), t('errors.check_connection'));
    }
    if (!hotelId) {
      return Alert.alert(t('contact.selectHotel'), t('contact.selectHotelHint'));
    }
    const errs: Record<string, string | undefined> = {};
    if (!subject.trim()) errs.subject = t('errors.missing_details');
    if (!message.trim()) errs.message = t('errors.missing_details');
    if (Object.keys(errs).length > 0) { setFieldErrors(errs); return; }
    setFieldErrors({});

    try {
      setSubmitting(true);
      await createThread.mutateAsync({
        hotelId,
        subject: subject.trim(),
        message: message.trim(),
      });
      navigation.goBack();
    } catch (err: any) {
      Alert.alert(t('contact.error'), err?.message ?? t('common.try_again_lower'));
    } finally {
      setSubmitting(false);
    }
  };

  const s = makeStyles(c);

  return (
    <ScrollView style={s.container} contentContainerStyle={[s.content, { paddingHorizontal: pad, paddingTop: insets.top + 12 }]}>
      <Pressable onPress={() => navigation.goBack()} hitSlop={8} style={s.backBtn}>
        <Ionicons name="arrow-back" size={20} color={c.teal} />
      </Pressable>

      <Text style={s.title}>{t('contact.newMessage')}</Text>
      <Text style={s.subtitle}>{t('contact.newMessageSubtitle')}</Text>

      <Card style={s.form}>
        <Text style={s.label}>{t('contact.hotel')}</Text>
        {hotels.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.hotelRow}>
            {hotels.map((h) => (
              <Pressable
                key={h.id}
                onPress={() => setHotelId(h.id)}
                style={[s.hotelChip, hotelId === h.id && s.hotelChipActive]}
              >
                <Text style={[s.hotelChipText, hotelId === h.id && s.hotelChipTextActive]}>
                  {h.name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : (
          <Text style={s.noHotels}>{t('contact.noBookedHotels')}</Text>
        )}

        <Text style={s.label}>{t('contact.subject')}</Text>
        <TextInput
          style={[s.input, fieldErrors.subject && s.inputError]}
          value={subject}
          onChangeText={(v) => { setSubject(v); setFieldErrors((p) => ({ ...p, subject: undefined })); }}
          onBlur={() => validateField('subject')}
          placeholder={t('contact.subjectPlaceholder')}
          placeholderTextColor={c.inkMuted}
          maxLength={100}
        />
        {fieldErrors.subject ? <Text style={s.fieldError}>{fieldErrors.subject}</Text> : null}

        <Text style={s.label}>{t('contact.message')}</Text>
        <TextInput
          style={[s.input, s.textArea, fieldErrors.message && s.inputError]}
          value={message}
          onChangeText={(v) => { setMessage(v); setFieldErrors((p) => ({ ...p, message: undefined })); }}
          onBlur={() => validateField('message')}
          placeholder={t('contact.messagePlaceholder')}
          placeholderTextColor={c.inkMuted}
          multiline
          numberOfLines={6}
          textAlignVertical="top"
          maxLength={5000}
        />
        {fieldErrors.message ? <Text style={s.fieldError}>{fieldErrors.message}</Text> : null}
        <Text style={s.charCount}>{message.length}/5000</Text>
      </Card>

      <Button
        title={submitting ? t('contact.sending') : t('contact.sendMessage')}
        onPress={handleSubmit}
        disabled={submitting || !hotelId || !subject.trim() || !message.trim()}
        loading={submitting}
      />
    </ScrollView>
  );
}

const makeStyles = (c: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.paper },
  content: { paddingBottom: 40 },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.paperDeep, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  title: { fontFamily: 'Georgia', color: c.ink, fontSize: 24, fontWeight: '600', marginBottom: 4 },
  subtitle: { color: c.inkMuted, fontSize: 14, marginBottom: 20 },
  form: { gap: 10, marginBottom: 20 },
  label: { color: c.inkSoft, fontSize: 13, fontWeight: '600', marginTop: 4 },
  input: { backgroundColor: c.surface, borderRadius: 14, borderWidth: 1, borderColor: c.lineStrong, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: c.ink },
  inputError: { borderColor: c.brick },
  fieldError: { color: c.brick, fontSize: 12, marginTop: 2 },
  textArea: { minHeight: 140, textAlignVertical: 'top' as const },
  charCount: { color: c.inkMuted, fontSize: 11, textAlign: 'right', marginTop: 2 },
  hotelRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  hotelChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: c.lineStrong, backgroundColor: c.surface },
  hotelChipActive: { borderColor: c.teal, backgroundColor: c.tealTint },
  hotelChipText: { fontSize: 13, color: c.inkSoft, fontWeight: '600' },
  hotelChipTextActive: { color: c.teal },
  noHotels: { color: c.inkMuted, fontSize: 13, fontStyle: 'italic', marginTop: 4 },
});
