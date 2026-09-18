import React, { useState } from 'react';
import {
  Alert,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { RootStackParamList } from '../navigation/types';
import { useAppSelector } from '../store/hooks';
import { useMyReviews } from '../hooks/useQueries';
import { request } from '../api';
import { Button, EmptyState, ErrorBox, Stars } from '../components/Shared';
import { SkeletonList } from '../components/Skeleton';
import { useTheme } from '../hooks/useTheme';
import { hapticMedium } from '../hooks/useHaptics';
import { Ionicons } from '@expo/vector-icons';

type Nav = NativeStackNavigationProp<RootStackParamList>;

function ratingColor(c: ReturnType<typeof useTheme>['colors'], rating: number): string {
  if (rating >= 4) return c.success;
  if (rating === 3) return c.warning;
  return c.danger;
}

export default function MyReviewsScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const session = useAppSelector((s) => s.auth.session);
  const { colors: c } = useTheme();
  const insets = useSafeAreaInsets();
  const token = session?.accessToken ?? '';

  const { data, isLoading, error, refetch, isRefetching } = useMyReviews(token);
  const reviews: any[] = Array.isArray(data) ? data : (data as any)?.data ?? [];

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = (reviewId: string, hotelName: string) => {
    hapticMedium();
    Alert.alert(
      'Delete Review',
      `Remove your review for ${hotelName}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeletingId(reviewId);
            try {
              await request(`/reviews/${reviewId}`, { method: 'DELETE', token });
              await refetch();
            } catch (err) {
              Alert.alert('Error', err instanceof Error ? err.message : 'Could not delete review.');
            } finally {
              setDeletingId(null);
            }
          },
        },
      ],
    );
  };

  const s = makeStyles(c);

  return (
    <View style={s.container}>
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8} style={s.backBtn}>
          <Ionicons name="arrow-back" size={20} color={c.teal} />
        </Pressable>
        <View style={s.headerText}>
          <Text style={s.title}>{t('myReviews.title', 'My Reviews')}</Text>
          <Text style={s.subtitle}>
            {reviews.length > 0
              ? `${reviews.length} review${reviews.length !== 1 ? 's' : ''}`
              : 'Your hotel reviews'}
          </Text>
        </View>
      </View>

      {error && <ErrorBox message={error.message} onRetry={() => refetch()} />}

      <FlashList
        data={reviews}
        keyExtractor={(r) => r.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={c.teal}
            colors={[c.teal]}
          />
        }
        ListEmptyComponent={
          isLoading ? (
            <View style={{ marginTop: 16 }}>
              <SkeletonList count={3} />
            </View>
          ) : (
            <EmptyState
              title={t('myReviews.noReviews', 'No reviews yet')}
              subtitle={t('myReviews.noReviewsSubtitle', "After a completed stay you'll be able to leave a review.")}
            />
          )
        }
        renderItem={({ item }) => (
          <MyReviewCard
            review={item}
            colors={c}
            onEdit={() =>
              navigation.navigate('Review', {
                hotelId: item.hotelId,
                hotelName: item.hotel?.name ?? 'Hotel',
                mode: 'edit',
                existingReview: { id: item.id, rating: item.rating, comment: item.comment },
              })
            }
            onDelete={() => handleDelete(item.id, item.hotel?.name ?? 'this hotel')}
            isDeleting={deletingId === item.id}
          />
        )}
      />
    </View>
  );
}

function MyReviewCard({
  review,
  colors: c,
  onEdit,
  onDelete,
  isDeleting,
}: {
  review: any;
  colors: ReturnType<typeof useTheme>['colors'];
  onEdit: () => void;
  onDelete: () => void;
  isDeleting: boolean;
}) {
  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

  const hotelTitle = review.hotel?.name ?? 'Hotel';
  const rc = ratingColor(c, review.rating);

  return (
    <View style={[cardStyles.card, { backgroundColor: c.surface, borderColor: c.line }]}>
      <View style={cardStyles.cardTop}>
        <View style={cardStyles.flex}>
          <Text style={[cardStyles.hotelName, { color: c.ink }]} numberOfLines={1}>
            {hotelTitle}
          </Text>
          {review.hotel?.city?.name && (
            <Text style={[cardStyles.hotelLocation, { color: c.inkMuted }]}>{"\uD83D\uDCCD"} {review.hotel.city.name}</Text>
          )}
        </View>
        <Text style={[cardStyles.dateText, { color: c.inkMuted }]}>{formatDate(review.createdAt)}</Text>
      </View>

      <View style={cardStyles.ratingRow} accessibilityLabel={`Rated ${review.rating} out of 5 stars`}>
        <Stars value={review.rating} size={16} />
        <View style={[cardStyles.ratingBadge, { backgroundColor: rc + '18' }]}>
          <Text style={[cardStyles.ratingBadgeText, { color: rc }]}>
            {review.rating}/5
          </Text>
        </View>
      </View>

      <View style={[cardStyles.commentWrap, { backgroundColor: c.paperDeep, borderLeftColor: c.teal }]}>
        <Text style={[cardStyles.commentText, { color: c.inkSoft }]}>{`\u201C${review.comment}\u201D`}</Text>
      </View>

      {review.photos?.length > 0 && (
        <View style={cardStyles.photosRow}>
          <Text style={[cardStyles.photosLabel, { color: c.inkMuted }]}>{review.photos.length} photo{review.photos.length !== 1 ? 's' : ''} attached</Text>
        </View>
      )}

      <View style={[cardStyles.divider, { backgroundColor: c.line }]} />

      <View style={cardStyles.actions}>
        <Button
          title="Edit Review"
          variant="secondary"
          size="sm"
          onPress={onEdit}
          accessibilityLabel={`Edit review for ${hotelTitle}`}
        />
        <Button
          title={isDeleting ? 'Deleting\u2026' : 'Delete'}
          variant="danger"
          size="sm"
          onPress={onDelete}
          disabled={isDeleting}
          accessibilityLabel={`Delete review for ${hotelTitle}`}
        />
      </View>
    </View>
  );
}

const makeStyles = (c: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.paper },
  header: {
    backgroundColor: c.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.line,
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 10,
  },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.paperDeep, alignItems: 'center', justifyContent: 'center' },
  headerText: { gap: 3 },
  title: {
    fontFamily: 'Georgia',
    color: c.ink,
    fontSize: 28,
    fontWeight: '600',
    letterSpacing: -0.4,
  },
  subtitle: { color: c.inkMuted, fontSize: 13 },
});

const cardStyles = StyleSheet.create({
  flex: { flex: 1 },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  hotelName: {
    fontFamily: 'Georgia',
    fontSize: 17,
    fontWeight: '600',
  },
  hotelLocation: { fontSize: 12, marginTop: 2 },
  dateText: { fontSize: 12, flexShrink: 0 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  ratingBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  ratingBadgeText: { fontSize: 12, fontWeight: '800' },
  commentWrap: {
    borderRadius: 10,
    padding: 12,
    borderLeftWidth: 3,
  },
  commentText: {
    fontSize: 14,
    lineHeight: 21,
    fontStyle: 'italic',
  },
  photosRow: { flexDirection: 'row', alignItems: 'center' },
  photosLabel: { fontSize: 12 },
  divider: { height: 1 },
  actions: { flexDirection: 'row', gap: 10 },
});

const styles = StyleSheet.create({
  list: { padding: 20, gap: 16 },
});
