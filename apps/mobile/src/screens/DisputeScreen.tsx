import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import * as ImagePicker from 'expo-image-picker';
import { useAppSelector } from '../store/hooks';
import { requestFormData } from '../api';
import { classifyAndAnnounce } from '../errors';
import { sanitizeText } from '../lib/sanitize';
import { Badge, Button, Card, EmptyState, ErrorBox } from '../components/Shared';
import { SkeletonList } from '../components/Skeleton';
import { useToast } from '../components/Toast';
import { useDisputes, useCreateDispute } from '../hooks/useQueries';
import { font } from '../theme';
import { useTheme } from '../hooks/useTheme';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { compressImage } from '../lib/compressImage';
import { useResponsivePadding } from '../hooks/useResponsivePadding';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// DISPUTE-001: Types per policy — INCORRECT_CHARGE, BOOKING_DISPUTE, CANCELLATION_DISPUTE, REFUND_DISPUTE, HOTEL_COMPLAINT
const DISPUTE_TYPES = [
  { value: 'INCORRECT_CHARGE', label: 'Incorrect charge' },
  { value: 'BOOKING_DISPUTE', label: 'Booking dispute' },
  { value: 'CANCELLATION_DISPUTE', label: 'Cancellation dispute' },
  { value: 'REFUND_DISPUTE', label: 'Refund dispute' },
  { value: 'HOTEL_COMPLAINT', label: 'Hotel complaint' },
];

interface EvidenceFile {
  uri: string;
  name: string;
  type: string;
}

export default function DisputeScreen() {
  const pad = useResponsivePadding();
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const session = useAppSelector((s) => s.auth.session);
  const token = session?.accessToken ?? '';
  const toast = useToast();
  const { isOffline } = useNetworkStatus();

  const { data, isLoading, error, refetch } = useDisputes(token);
  const createDispute = useCreateDispute(token);
  const disputes = data?.data ?? [];

  const [showForm, setShowForm] = useState(false);
  const [type, setType] = useState('INCORRECT_CHARGE');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [bookingRef, setBookingRef] = useState('');
  const [evidence, setEvidence] = useState<EvidenceFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | undefined>>({});

  const { colors: c } = useTheme();

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: c.paper },
    content: { padding: 20, paddingBottom: 40 },
    backText: { color: c.teal, fontSize: 15, fontWeight: '600', marginBottom: 12 },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    title: { fontFamily: font.display, color: c.ink, fontSize: 24, fontWeight: '600' },
    formCard: { gap: 10, marginBottom: 20 },
    label: { color: c.inkSoft, fontSize: 13, fontWeight: '600', marginTop: 4 },
    input: { backgroundColor: c.surface, borderRadius: 12, borderWidth: 1, borderColor: c.lineStrong, paddingHorizontal: 12, paddingVertical: 12, fontSize: 15, color: c.ink },
    inputError: { borderColor: '#EF4444' },
    fieldError: { color: '#EF4444', fontSize: 12, marginTop: 2 },
    textArea: { minHeight: 120 },
    charCount: { color: c.inkMuted, fontSize: 11, textAlign: 'right', marginTop: 2 },
    hint: { color: c.inkMuted, fontSize: 12, marginTop: 2 },
    typeRow: { flexDirection: 'row', marginTop: 4 },
    typeChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: c.lineStrong, marginRight: 8 },
    typeChipActive: { backgroundColor: c.teal, borderColor: c.teal },
    typeChipText: { fontSize: 13, color: c.inkSoft },
    typeChipTextActive: { color: c.surface, fontWeight: '600' },
    evidenceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
    evidenceThumb: { position: 'relative' },
    evidenceImage: { width: 72, height: 72, borderRadius: 8 },
    evidenceRemove: { position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: 11, backgroundColor: c.brick, alignItems: 'center', justifyContent: 'center' },
    evidenceRemoveText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700', marginTop: -1 },
    evidenceAdd: { width: 72, height: 72, borderRadius: 8, borderWidth: 1.5, borderColor: c.lineStrong, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
    evidenceAddText: { fontSize: 24, color: c.inkMuted },
    evidenceAddLabel: { fontSize: 10, color: c.inkMuted, marginTop: 2 },
    disputeCard: { padding: 16, marginBottom: 12 },
    disputeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
    disputeSubject: { fontFamily: font.display, fontSize: 16, fontWeight: '600', color: c.ink, flex: 1 },
    disputeType: { fontSize: 12, color: c.tealDeep, fontWeight: '600', marginBottom: 4 },
    disputeDesc: { fontSize: 13, color: c.inkSoft, lineHeight: 18 },
    disputeResolution: { fontSize: 13, color: c.gold, fontWeight: '600', marginTop: 8 },
    disputeDate: { fontSize: 11, color: c.inkMuted, marginTop: 6 },
  });

  const launchEvidencePicker = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        t('disputes.permissionRequired', 'Permission Required'),
        t('disputes.permissionMsg', 'Photo access is needed to attach evidence files.'),
        [{ text: 'OK' }],
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsMultipleSelection: true,
    });
    if (!result.canceled) {
      const newFiles = result.assets.map((a) => ({
        uri: a.uri,
        name: a.fileName ?? `evidence-${Date.now()}.jpg`,
        type: a.mimeType ?? 'image/jpeg',
      }));
      setEvidence((prev) => [...prev, ...newFiles].slice(0, 5));
    }
  };

  const pickImage = async () => {
    if (evidence.length >= 5) {
      return Alert.alert(t('disputes.maxEvidence'), t('disputes.maxEvidenceHint'));
    }
    const currentPerm = await ImagePicker.getMediaLibraryPermissionsAsync();
    if (!currentPerm.granted && currentPerm.canAskAgain) {
      Alert.alert(
        t('disputes.photoPermissionTitle', 'Photo Access'),
        t('disputes.photoPermissionExpl', 'Yayetech Hotel needs access to your photos to attach evidence to this dispute.'),
        [
          { text: t('disputes.cancel', 'Cancel'), style: 'cancel' },
          { text: t('disputes.continue', 'Continue'), onPress: launchEvidencePicker },
        ],
      );
    } else {
      await launchEvidencePicker();
    }
  };

  const removeEvidence = (index: number) => {
    setEvidence((prev) => prev.filter((_, i) => i !== index));
  };

  const uploadEvidence = async (): Promise<string[]> => {
    if (evidence.length === 0) return [];
    const uploadedIds: string[] = [];
    for (const file of evidence) {
      const compressedUri = await compressImage(file.uri);
      const formData = new FormData();
      formData.append('file', { uri: compressedUri, name: file.name, type: file.type } as any);
      const res = await requestFormData<{ id: string }>('/upload/dispute-evidence', formData, token);
      uploadedIds.push(res.id);
    }
    return uploadedIds;
  };

  const validateField = (field: string) => {
    const errs: Record<string, string | undefined> = {};
    if (field === 'subject' && !sanitizeText(subject)) errs.subject = 'Subject is required.';
    if (field === 'description' && !sanitizeText(description)) errs.description = 'Description is required.';
    setFieldErrors((prev) => ({ ...prev, ...errs, [field]: errs[field] || undefined }));
  };

  const handleSubmit = async () => {
    if (isOffline) {
      return Alert.alert('Offline', 'Cannot file a dispute while offline. Please connect to the internet.');
    }
    const sanitizedSubject = sanitizeText(subject);
    const sanitizedDescription = sanitizeText(description);
    const errs: Record<string, string | undefined> = {};
    if (!sanitizedSubject) errs.subject = 'Subject is required.';
    if (!sanitizedDescription) errs.description = 'Description is required.';
    if (Object.keys(errs).length > 0) { setFieldErrors(errs); return; }
    setFieldErrors({});
    try {
      setUploading(true);
      const evidenceIds = await uploadEvidence();
      await createDispute.mutateAsync({
        type,
        subject: sanitizedSubject,
        description: sanitizedDescription,
        bookingId: bookingRef.trim() || undefined,
        evidenceIds: evidenceIds.length > 0 ? evidenceIds : undefined,
      });
      toast('success', t('disputes.submitted'));
      setShowForm(false);
      setSubject('');
      setDescription('');
      setBookingRef('');
      setEvidence([]);
    } catch (err) {
      const classified = classifyAndAnnounce(err);
      Alert.alert(t('disputes.error'), classified.title);
    } finally {
      setUploading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingHorizontal: pad }]}>
      <Pressable onPress={() => navigation.goBack()}><Text style={styles.backText}>{'< Back'}</Text></Pressable>
      <View style={styles.headerRow}>
        <Text style={styles.title}>{t('disputes.title')}</Text>
        <Button title={t('disputes.openDispute')} variant="primary" size="sm" onPress={() => setShowForm(!showForm)} />
      </View>

      {showForm && (
        <Card style={styles.formCard}>
          <Text style={styles.label}>{t('disputes.type')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.typeRow}>
            {DISPUTE_TYPES.map((dt) => (
              <Pressable key={dt.value} onPress={() => setType(dt.value)} style={[styles.typeChip, type === dt.value && styles.typeChipActive]}>
                <Text style={[styles.typeChipText, type === dt.value && styles.typeChipTextActive]}>{dt.label}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <Text style={styles.label}>{t('disputes.subject')} *</Text>
          <TextInput value={subject} onChangeText={(v) => { setSubject(v); setFieldErrors((p) => ({ ...p, subject: undefined })); }} onBlur={() => validateField('subject')} placeholder="Brief summary" placeholderTextColor={c.inkMuted} style={[styles.input, fieldErrors.subject && styles.inputError]} maxLength={200} />
          {fieldErrors.subject ? <Text style={styles.fieldError}>{fieldErrors.subject}</Text> : null}

          <Text style={styles.label}>{t('disputes.description')} *</Text>
          <TextInput
            value={description}
            onChangeText={(v) => { setDescription(v); setFieldErrors((p) => ({ ...p, description: undefined })); }}
            onBlur={() => validateField('description')}
            placeholder="Describe the issue..."
            placeholderTextColor={c.inkMuted}
            style={[styles.input, styles.textArea, fieldErrors.description && styles.inputError]}
            multiline
            textAlignVertical="top"
            maxLength={5000}
          />
          {fieldErrors.description ? <Text style={styles.fieldError}>{fieldErrors.description}</Text> : null}
          <Text style={styles.charCount}>{description.length}/5000</Text>

          <Text style={styles.label}>{t('disputes.bookingRef')} {t('disputes.optional')}</Text>
          <TextInput value={bookingRef} onChangeText={setBookingRef} placeholder="Booking ID (first 8 chars)" placeholderTextColor={c.inkMuted} style={styles.input} autoCapitalize="characters" />

          <Text style={styles.label}>{t('disputes.evidence')} {t('disputes.optional')}</Text>
          <Text style={styles.hint}>{t('disputes.evidenceHint')}</Text>
          <View style={styles.evidenceRow}>
            {evidence.map((file, i) => (
              <View key={i} style={styles.evidenceThumb}>
                <Image source={{ uri: file.uri }} style={styles.evidenceImage} contentFit="cover" transition={300} />
                <Pressable onPress={() => removeEvidence(i)} style={styles.evidenceRemove}>
                  <Text style={styles.evidenceRemoveText}>×</Text>
                </Pressable>
              </View>
            ))}
            {evidence.length < 5 && (
              <Pressable onPress={pickImage} style={styles.evidenceAdd}>
                <Text style={styles.evidenceAddText}>+</Text>
                <Text style={styles.evidenceAddLabel}>{t('disputes.addPhoto')}</Text>
              </Pressable>
            )}
          </View>

          <Button
            title={uploading ? t('disputes.uploading') : createDispute.isPending ? t('disputes.submitting') : t('disputes.submit')}
            onPress={handleSubmit}
            loading={uploading || createDispute.isPending}
            disabled={uploading || createDispute.isPending}
          />
        </Card>
      )}

      {isLoading ? (
        <SkeletonList count={4} />
      ) : error ? (
        <ErrorBox message="Failed to load disputes" onRetry={() => refetch()} />
      ) : disputes.length === 0 ? (
        <EmptyState title={t('disputes.noDisputes')} subtitle={t('disputes.noDisputesSubtitle')} />
      ) : (
        disputes.map((d: any) => (
          <Card key={d.id} style={styles.disputeCard}>
            <View style={styles.disputeHeader}>
              <Text style={styles.disputeSubject}>{d.subject}</Text>
              <Badge status={d.status} />
            </View>
            <Text style={styles.disputeType}>{DISPUTE_TYPES.find((dt) => dt.value === d.type)?.label ?? d.type}</Text>
            <Text style={styles.disputeDesc} numberOfLines={2}>{d.description}</Text>
            {d.resolution && <Text style={styles.disputeResolution}>{t('disputes.resolution')}: {d.resolution}</Text>}
            <Text style={styles.disputeDate}>{t('disputes.created')}: {new Date(d.createdAt).toLocaleDateString()}</Text>
          </Card>
        ))
      )}
    </ScrollView>
  );
}
