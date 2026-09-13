import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { useAppSelector } from '../store/hooks';
import { request, requestFormData } from '../api';
import { Button, Card, Stars } from '../components/Shared';
import { textProps } from '../components/ScaledText';
import { font } from '../theme';
import { useTheme } from '../hooks/useTheme';
import { reviewSchema } from '../lib/schemas';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { useResponsivePadding } from '../hooks/useResponsivePadding';
import { sanitizeText } from '../lib/sanitize';
import { compressImage } from '../lib/compressImage';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'Review'>;

const RATING_WORDS = ['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent'] as const;

export default function ReviewScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { hotelId, hotelName, mode = 'create', existingReview } = route.params;
  const session = useAppSelector((s) => s.auth.session);
  const token = session?.accessToken ?? '';
  const { isOffline } = useNetworkStatus();
  const pad = useResponsivePadding();
  const { colors: c } = useTheme();

  useEffect(() => {
    if (!session) {
      Alert.alert('Sign In Required', 'Please sign in to write a review.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign In', onPress: () => navigation.navigate('Auth', { initialMode: 'login' }) },
      ]);
    }
  }, [session, navigation]);

  const [rating, setRating] = useState(existingReview?.rating ?? 0);
  const [comment, setComment] = useState(existingReview?.comment ?? '');
  const [photos, setPhotos] = useState<{ uri: string; asset: ImagePicker.ImagePickerAsset }[]>([]);
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | undefined>>({});

  const launchPhotoPicker = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission Required',
        'Photo access is needed to attach images to your review. You can still submit a text-only review.',
        [{ text: 'OK' }],
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: 5 - photos.length, quality: 0.8,
    });
    if (!result.canceled) {
      setPhotos((prev) => [...prev, ...result.assets.map((a) => ({ uri: a.uri, asset: a }))].slice(0, 5));
    }
  };

  const pickPhotos = async () => {
    const currentPerm = await ImagePicker.getMediaLibraryPermissionsAsync();
    if (!currentPerm.granted && currentPerm.canAskAgain) {
      Alert.alert(
        'Photo Access',
        'Yayetech Hotel needs access to your photo library to attach photos to your review.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Continue', onPress: launchPhotoPicker },
        ],
      );
    } else {
      await launchPhotoPicker();
    }
  };

  const removePhoto = (index: number) => setPhotos((prev) => prev.filter((_, i) => i !== index));

  const submit = async () => {
    if (isOffline) {
      Alert.alert('Offline', 'Cannot submit a review while offline. Please connect to the internet and try again.');
      return;
    }
    const sanitizedComment = sanitizeText(comment);
    const errs: Record<string, string | undefined> = {};
    if (!rating) errs.rating = 'Please select a rating.';
    if (!sanitizedComment) errs.comment = 'Please write a review.';
    if (Object.keys(errs).length > 0) { setFieldErrors(errs); return; }
    setFieldErrors({});
    try {
      reviewSchema.parse({ hotelId, rating, comment: sanitizedComment });
    } catch (err: any) {
      const msg = err.errors?.[0]?.message ?? 'Please fill in all required fields.';
      return Alert.alert('Validation error', msg);
    }
    setLoading(true);
    try {
      let reviewId: string;
      if (mode === 'edit' && existingReview) {
        await request(`/reviews/${existingReview.id}`, { method: 'PATCH', body: { rating, comment: sanitizedComment }, token });
        reviewId = existingReview.id;
      } else {
        const created = await request<{ id: string }>('/reviews', { method: 'POST', body: { hotelId, rating, comment: sanitizedComment }, token });
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
      Alert.alert(mode === 'edit' ? 'Review updated' : 'Review submitted', 'Thank you for your feedback!', [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : `Could not ${mode === 'edit' ? 'update' : 'submit'} review`);
    } finally { setLoading(false); }
  };

  const s = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: c.paper },
    content: { padding: 20, paddingBottom: 40 },
    backText: { color: c.teal, fontSize: 15, fontWeight: '600', marginBottom: 12 },
    title: { fontFamily: font.display, color: c.ink, fontSize: 26, fontWeight: '600', letterSpacing: -0.3 },
    subtitle: { color: c.inkSoft, fontSize: 14, marginTop: 4, marginBottom: 20 },
    card: { gap: 10 },
    label: { color: c.inkSoft, fontSize: 13, fontWeight: '600', marginTop: 4 },
    starsRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8 },
    star: { fontSize: 38, color: c.lineStrong },
    starActive: { color: c.gold },
    ratingWord: { color: c.goldDeep, fontSize: 14, fontWeight: '600', marginLeft: 4 },
    input: { backgroundColor: c.surface, borderRadius: 12, borderWidth: 1, borderColor: c.lineStrong, paddingHorizontal: 12, paddingVertical: 12, fontSize: 15, color: c.ink },
    inputError: { borderColor: '#EF4444' },
    fieldError: { color: '#EF4444', fontSize: 12, marginTop: 2 },
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
  }), [c]);

  return (
    <ScrollView style={s.container} contentContainerStyle={[s.content, { paddingHorizontal: pad }]}>
      <Pressable onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Go back">
        <Text style={s.backText}>← Back</Text>
      </Pressable>
      <Text {...textProps} style={s.title}>{mode === 'edit' ? 'Edit review' : `Review ${hotelName}`}</Text>
      <Text style={s.subtitle}>{mode === 'edit' ? 'Update your review' : 'Share your experience'}</Text>

      <Card style={s.card}>
        <Text style={s.label}>Your rating</Text>
        <View style={s.starsRow} accessibilityRole="radiogroup" accessibilityLabel="Rating stars">
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
              <Text style={[s.star, st <= rating && s.starActive]}>{st <= rating ? '★' : '☆'}</Text>
            </Pressable>
          ))}
          {rating > 0 && <Text style={s.ratingWord}>{RATING_WORDS[rating]}</Text>}
        </View>

        <Text style={s.label}>Your review</Text>
        <TextInput
          value={comment}
          onChangeText={(v) => { setComment(v); setFieldErrors((p) => ({ ...p, comment: undefined })); }}
          onBlur={() => { if (!comment.trim()) setFieldErrors((p) => ({ ...p, comment: 'Please write a review.' })); }}
          placeholder="Clean rooms, honest breakfast, staff who actually smile..."
          placeholderTextColor={c.inkMuted}
          style={[s.input, { height: 120 }, fieldErrors.comment && s.inputError]}
          multiline
          textAlignVertical="top"
          accessibilityLabel="Your review comments"
        />
        {fieldErrors.comment ? <Text style={s.fieldError}>{fieldErrors.comment}</Text> : null}

        <View style={s.photoSection}>
          <Text style={s.label}>Add photos</Text>
          <Text style={s.photoHint}>{photos.length}/5 · optional</Text>
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
                  <Text style={s.photoRemoveText}>×</Text>
                </Pressable>
              </View>
            ))}
            {photos.length < 5 && (
              <Pressable
                style={s.photoPlaceholder}
                onPress={pickPhotos}
                accessibilityRole="button"
                accessibilityLabel="Add review photos"
                accessibilityHint="Select up to 5 photos from your photo library"
              >
                <Text style={s.photoPlus}>+</Text>
              </Pressable>
            )}
          </View>
        </View>

        <Button
          title={mode === 'edit' ? 'Update review' : 'Publish review'}
          variant="gold"
          onPress={submit}
          loading={loading}
          disabled={loading || isOffline}
          accessibilityLabel={mode === 'edit' ? 'Update review' : 'Publish review'}
        />
      </Card>

      <View style={s.hintRow}><Stars value={5} size={12} /><Text style={s.hint}>Reviews are only allowed for completed stays.</Text></View>
    </ScrollView>
  );
}
