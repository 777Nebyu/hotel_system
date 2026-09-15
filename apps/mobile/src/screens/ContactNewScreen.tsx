import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import type { RootStackParamList } from '../navigation/types';
import { useAppSelector } from '../store/hooks';
import { Button, Card } from '../components/Shared';
import { useCreateContactThread, useBookingHistory } from '../hooks/useQueries';
import { colors, font, radius } from '../theme';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { useResponsivePadding } from '../hooks/useResponsivePadding';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'ContactNew'>;

export default function ContactNewScreen() {
  const pad = useResponsivePadding();
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
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
    if (field === 'subject' && !subject.trim()) errs.subject = 'Subject is required.';
    if (field === 'message' && !message.trim()) errs.message = 'Message is required.';
    setFieldErrors((prev) => ({ ...prev, ...errs, [field]: errs[field] || undefined }));
  };

  const handleSubmit = async () => {
    if (isOffline) {
      return Alert.alert('Offline', 'Cannot send a message while offline. Please connect to the internet.');
    }
    if (!hotelId) {
      return Alert.alert(t('contact.selectHotel'), t('contact.selectHotelHint'));
    }
    const errs: Record<string, string | undefined> = {};
    if (!subject.trim()) errs.subject = 'Subject is required.';
    if (!message.trim()) errs.message = 'Message is required.';
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
      Alert.alert(t('contact.failedToSend'), err?.message ?? 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingHorizontal: pad }]}>
      <Pressable onPress={() => navigation.goBack()}>
        <Text style={styles.backText}>{'< Back'}</Text>
      </Pressable>

      <Text style={styles.title}>{t('contact.newMessage')}</Text>
      <Text style={styles.subtitle}>{t('contact.newMessageSubtitle')}</Text>

      <Card style={styles.form}>
        {/* Hotel Selector */}
        <Text style={styles.label}>{t('contact.hotel')}</Text>
        {hotels.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hotelRow}>
            {hotels.map((h) => (
              <Pressable
                key={h.id}
                onPress={() => setHotelId(h.id)}
                style={[styles.hotelChip, hotelId === h.id && styles.hotelChipActive]}
              >
                <Text style={[styles.hotelChipText, hotelId === h.id && styles.hotelChipTextActive]}>
                  {h.name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : (
          <Text style={styles.noHotels}>{t('contact.noBookedHotels')}</Text>
        )}

        {/* Subject */}
        <Text style={styles.label}>{t('contact.subject')}</Text>
        <TextInput
          style={[styles.input, fieldErrors.subject && styles.inputError]}
          value={subject}
          onChangeText={(v) => { setSubject(v); setFieldErrors((p) => ({ ...p, subject: undefined })); }}
          onBlur={() => validateField('subject')}
          placeholder={t('contact.subjectPlaceholder')}
          placeholderTextColor={colors.inkMuted}
          maxLength={100}
        />
        {fieldErrors.subject ? <Text style={styles.fieldError}>{fieldErrors.subject}</Text> : null}

        {/* Message */}
        <Text style={styles.label}>{t('contact.message')}</Text>
        <TextInput
          style={[styles.input, styles.textArea, fieldErrors.message && styles.inputError]}
          value={message}
          onChangeText={(v) => { setMessage(v); setFieldErrors((p) => ({ ...p, message: undefined })); }}
          onBlur={() => validateField('message')}
          placeholder={t('contact.messagePlaceholder')}
          placeholderTextColor={colors.inkMuted}
          multiline
          numberOfLines={6}
          textAlignVertical="top"
          maxLength={5000}
        />
        {fieldErrors.message ? <Text style={styles.fieldError}>{fieldErrors.message}</Text> : null}
        <Text style={styles.charCount}>{message.length}/5000</Text>
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  content: { padding: 20, paddingBottom: 40 },
  backText: { color: colors.teal, fontSize: 15, fontWeight: '600', marginBottom: 12 },
  title: { fontFamily: font.display, color: colors.ink, fontSize: 24, fontWeight: '600', marginBottom: 4 },
  subtitle: { color: colors.inkMuted, fontSize: 14, marginBottom: 20 },
  form: { gap: 10, marginBottom: 20 },
  label: { color: colors.inkSoft, fontSize: 13, fontWeight: '600', marginTop: 4 },
  input: { backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colors.lineStrong, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: colors.ink },
  inputError: { borderColor: '#EF4444' },
  fieldError: { color: '#EF4444', fontSize: 12, marginTop: 2 },
  textArea: { minHeight: 140, textAlignVertical: 'top' },
  charCount: { color: colors.inkMuted, fontSize: 11, textAlign: 'right', marginTop: 2 },
  hotelRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  hotelChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.lineStrong, backgroundColor: colors.surface },
  hotelChipActive: { borderColor: colors.teal, backgroundColor: colors.tealTint },
  hotelChipText: { fontSize: 13, color: colors.inkSoft, fontWeight: '600' },
  hotelChipTextActive: { color: colors.teal },
  noHotels: { color: colors.inkMuted, fontSize: 13, fontStyle: 'italic', marginTop: 4 },
});
