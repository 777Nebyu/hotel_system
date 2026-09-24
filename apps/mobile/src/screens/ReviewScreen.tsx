import React, { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { RootStackParamList } from '../navigation/types';
import { useAppSelector } from '../store/hooks';
import { request, requestFormData } from '../api';
import { Button, Card, Stars } from '../components/Shared';
import { textProps } from '../components/ScaledText';
import { useTheme } from '../hooks/useTheme';
import { reviewSchema } from '../lib/schemas';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { useResponsivePadding } from '../hooks/useResponsivePadding';
import { sanitizeText } from '../lib/sanitize';
import { compressImage } from '../lib/compressImage';
import { Ionicons } from '@expo/vector-icons';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'Review'>;

const RATING_WORDS = ['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent'] as const;

export default function ReviewScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { hotelId, hotelName, bookingId, mode = 'create', existingReview } = route.params;
  const session = useAppSelector((s) => s.auth.session);
  const token = session?.accessToken ?? '';
  const { isOffline } = useNetworkStatus();
  const pad = useResponsivePadding();
  const insets = useSafeAreaInsets();
  const { colors: c } = useTheme();

  useEffect(() => {
    if (!session) {
      Alert.alert(t('common.sign_in_required'), t('review.signin_write'), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.sign_in'), onPress: () => navigation.navigate('Auth', { initialMode: 'login' }) },
      ]);
    }
  }, [session, navigation, t]);

  const [rating, setRating] = useState(existingReview?.rating ?? 0);
  const [comment, setComment] = useState(existingReview?.comment ?? '');
  const [photos, setPhotos] = useState<{ uri: string; asset: ImagePicker.ImagePickerAsset }[]>([]);
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | undefined>>({});

  const launchPhotoPicker = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        t('errors.permission_required'),
        'Photo access is needed to attach images to your review. You can still submit a text-only review.',
        [{ text: 'OK' }],
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: 5 - photos.length, quality: 0.8,
    });
    if (!result.canceled) {
      const validPhotos: { uri: string; asset: ImagePicker.ImagePickerAsset }[] = [];
      for (const asset of result.assets) {
        const filename = asset.uri.split('/').pop()?.toLowerCase() ?? '';
        const ext = filename.split('.').pop() ?? '';
        if (!['jpg', 'jpeg', 'png', 'webp'].includes(ext)) {
          Alert.alert(t('review.invalid_file'), t('review.only_images'));
          continue;
        }
        if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) {
          Alert.alert(t('review.file_large'), t('review.photos_under'));
          continue;
        }
        validPhotos.push({ uri: asset.uri, asset });
      }
      setPhotos((prev) => [...prev, ...validPhotos].slice(0, 5));
    }
  };

  const pickPhotos = async () => {
    const currentPerm = await ImagePicker.getMediaLibraryPermissionsAsync();
    if (!currentPerm.granted && currentPerm.canAskAgain) {
      Alert.alert(
        'Photo Access',
        'Yayetech Hotel needs access to your photo library to attach photos to your review.',
        [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('common.continue'), onPress: launchPhotoPicker },
        ],
      );
    } else {
      await launchPhotoPicker();
    }
  };

  const removePhoto = (index: number) => setPhotos((prev) => prev.filter((_, i) => i !== index));

  const submit = async () => {
    if (isOffline) {
      Alert.alert(t('review.offline'), t('review.offline_msg'));
      return;
    }
    const sanitizedComment = sanitizeText(comment);
    const errs: Record<string, string | undefined> = {};
    if (!rating) errs.rating = 'Please select a rating.';
    if (Object.keys(errs).length > 0) { setFieldErrors(errs); return; }
    setFieldErrors({});
    try {
      reviewSchema.parse({ hotelId, rating, comment: sanitizedComment });
    } catch (err: any) {
      const msg = err.errors?.[0]?.message ?? t('errors.missing_details');
      return Alert.alert(t('errors.validation_error'), msg);
    }
    setLoading(true);
    try {
      let reviewId: string;
      if (mode === 'edit' && existingReview) {
        await request(`/reviews/${existingReview.id}`, { method: 'PATCH', body: { rating, comment: sanitizedComment }, token });
        reviewId = existingReview.id;
      } else {
        const created = await request<{ id: string }>('/reviews', { method: 'POST', body: { hotelId, bookingId, rating, comment: sanitizedComment }, token });
        reviewId = created.id;
      }
      for (const photo of photos) {
        const compressedUri = await compressImage(photo.uri);
        const formData = new FormData();
        const filename = photo.uri.split('/').pop() ?? 'photo.jpg';
        const ext = filename.split('.').pop()?.toLowerCase() ?? 'jpg';
        const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';
        formData.append('photo', { uri: compressedUri, name: filename, type: mimeType } as any);
        await requestFormData(`/reviews/${reviewId}/photos`, formData, token);
      }
      Alert.alert(mode === 'edit' ? t('review.updated') : t('review.submitted'), t('review.thanks'), [{ text: t('review.ok'), onPress: () => navigation.goBack() }]);
    } catch (err) {
      Alert.alert(t('common.error'), err instanceof Error ? err.message : (mode === 'edit' ? t('review.could_not_update') : t('review.could_not_submit')));
    } finally { setLoading(false); }
  };

  const s = makeStyles(c);

  return (
    <ScrollView style={s.container} contentContainerStyle={[s.content, { paddingHorizontal: pad, paddingTop: insets.top + 12 }]}>
      <Pressable onPress={() => navigation.goBack()} hitSlop={8} style={s.backBtn}>
        <Ionicons name="arrow-back" size={20} color={c.teal} />
      </Pressable>
      <Text {...textProps} style={s.title}>{mode === 'edit' ? t('review.edit') : `${t('buttons.review')} ${hotelName}`}</Text>
      <Text style={s.subtitle}>{mode === 'edit' ? 'Update your review' : 'Share your experience'}</Text>

      <Card style={s.card}>
        <Text style={s.label}>{t('review.your_rating')}</Text>
        <View style={s.starsRow} accessibilityRole="radiogroup" accessibilityLabel={t('review.stars')}>
          {[1, 2, 3, 4, 5].map((st) => (
            <Pressable
              key={st}
              onPress={() => setRating(st)}
              hitSlop={6}
              accessibilityRole="radio"
              accessibilityState={{ selected: st === rating }}
              accessibilityLabel={`${st} star${st > 1 ? 's' : ''}`}
              accessibilityHint={`Rate ${st} out of 5 stars`}
            >
              <Text style={[s.star, st <= rating && s.starActive]}>{st <= rating ? '\u2605' : '\u2606'}</Text>
            </Pressable>
          ))}
          {rating > 0 && <Text style={s.ratingWord}>{RATING_WORDS[rating]}</Text>}
        </View>

        <Text style={s.label}>{t('review.your_review')}</Text>
        <TextInput
          value={comment}
          onChangeText={(v) => { setComment(v); setFieldErrors((p) => ({ ...p, comment: undefined })); }}
          placeholder={t('review.placeholder')}
          placeholderTextColor={c.inkMuted}
          style={[s.input, { height: 120 }, fieldErrors.comment && s.inputError]}
          multiline
          textAlignVertical="top"
          maxLength={2000}
          accessibilityLabel={t('review.comments')}
        />
        {fieldErrors.comment ? <Text style={s.fieldError}>{fieldErrors.comment}</Text> : null}

        <View style={s.photoSection}>
          <Text style={s.label}>{t('review.add_photos')}</Text>
          <Text style={s.photoHint}>{photos.length}/5 \u00B7 optional</Text>
          <View style={s.photoRow}>
            {photos.map((p, i) => (
              <View key={i} style={s.photoThumb}>
                <Image source={{ uri: p.uri }} style={s.photoImage} contentFit="cover" transition={300} accessibilityLabel={`Review photo ${i + 1}`} />
                <Pressable
                  onPress={() => removePhoto(i)}
                  style={s.photoRemove}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove photo ${i + 1}`}
                >
                  <Text style={s.photoRemoveText}>{'\u2715'}</Text>
                </Pressable>
              </View>
            ))}
            {photos.length < 5 && (
              <Pressable
                style={s.photoPlaceholder}
                onPress={pickPhotos}
                accessibilityRole="button"
                accessibilityLabel={t('review.add_photo_a11y')}
                accessibilityHint="Select up to 5 photos from your photo library"
              >
                <Text style={s.photoPlus}>+</Text>
              </Pressable>
            )}
          </View>
        </View>

        <Button
          title={mode === 'edit' ? t('buttons.edit_review') : t('buttons.write_review')}
          variant="gold"
          onPress={submit}
          loading={loading}
          disabled={loading || isOffline}
          accessibilityLabel={mode === 'edit' ? t('buttons.edit_review') : t('buttons.write_review')}
        />
      </Card>

      <View style={s.hintRow}><Stars value={5} size={12} /><Text style={s.hint}>{t('review.completed_only')}</Text></View>
    </ScrollView>
  );
}

const makeStyles = (c: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.paper },
  content: { paddingBottom: 40 },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.paperDeep, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  title: { fontFamily: 'Georgia', color: c.ink, fontSize: 26, fontWeight: '600', letterSpacing: -0.3 },
  subtitle: { color: c.inkSoft, fontSize: 14, marginTop: 4, marginBottom: 20 },
  card: { gap: 10 },
  label: { color: c.inkSoft, fontSize: 13, fontWeight: '600', marginTop: 4 },
  starsRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8 },
  star: { fontSize: 38, color: c.lineStrong },
  starActive: { color: c.gold },
  ratingWord: { color: c.goldDeep, fontSize: 14, fontWeight: '600', marginLeft: 4 },
  input: { backgroundColor: c.surface, borderRadius: 12, borderWidth: 1, borderColor: c.lineStrong, paddingHorizontal: 12, paddingVertical: 12, fontSize: 15, color: c.ink },
  inputError: { borderColor: c.brick },
  fieldError: { color: c.brick, fontSize: 12, marginTop: 2 },
  hintRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6, marginTop: 14, paddingHorizontal: 4 },
  hint: { color: c.inkMuted, fontSize: 12, flex: 1 },
  photoSection: { marginTop: 4 },
  photoHint: { color: c.inkMuted, fontSize: 11, marginTop: 2 },
  photoRow: { flexDirection: 'row' as const, gap: 8, marginTop: 8 },
  photoThumb: { width: 64, height: 64, borderRadius: 8, overflow: 'hidden' as const },
  photoImage: { width: 64, height: 64 },
  photoRemove: { position: 'absolute' as const, top: -4, right: -4, width: 20, height: 20, borderRadius: 10, backgroundColor: c.brick, alignItems: 'center' as const, justifyContent: 'center' as const },
  photoRemoveText: { color: c.surface, fontSize: 14, fontWeight: '700', marginTop: -1 },
  photoPlaceholder: { width: 64, height: 64, borderRadius: 8, borderWidth: 1.5, borderColor: c.lineStrong, borderStyle: 'dashed' as const, alignItems: 'center' as const, justifyContent: 'center' as const },
  photoPlus: { fontSize: 24, color: c.inkMuted },
});
