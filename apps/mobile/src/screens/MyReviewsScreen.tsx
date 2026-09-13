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
import type { RootStackParamList } from '../navigation/types';
import { useAppSelector } from '../store/hooks';
import { useMyReviews } from '../hooks/useQueries';
import { request } from '../api';
import { Button, EmptyState, ErrorBox, Stars } from '../components/Shared';
import { SkeletonList } from '../components/Skeleton';
import { colors, font, radius, shadowCard } from '../theme';
import { hapticMedium } from '../hooks/useHaptics';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function MyReviewsScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const session = useAppSelector((s) => s.auth.session);
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

  return (
    <View style={styles.container}>
      {/* ─── Header ─── */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8} accessibilityRole="button" accessibilityLabel="Go back">
          <Text style={styles.back}>← Back</Text>
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.title}>{t('myReviews.title', 'My Reviews')}</Text>
          <Text style={styles.subtitle}>
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
            tintColor={colors.teal}
            colors={[colors.teal]}
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
          <ReviewCard
            review={item}
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

function ReviewCard({
  review,
  onEdit,
  onDelete,
  isDeleting,
}: {
  review: any;
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

  return (
    <View
      style={[styles.card, shadowCard]}
      accessible={true}
      accessibilityLabel={`Review for ${hotelTitle}, rated ${review.rating} out of 5 stars`}
    >
      {/* Hotel name + date */}
      <View style={styles.cardTop}>
        <View style={styles.flex}>
          <Text style={styles.hotelName} numberOfLines={1}>
            {hotelTitle}
          </Text>
          {review.hotel?.city?.name && (
            <Text style={styles.hotelLocation}>📍 {review.hotel.city.name}</Text>
          )}
        </View>
        <Text style={styles.dateText}>{formatDate(review.createdAt)}</Text>
      </View>

      {/* Rating stars */}
      <View style={styles.ratingRow} accessibilityLabel={`Rated ${review.rating} out of 5 stars`}>
        <Stars value={review.rating} size={16} />
        <View style={[styles.ratingBadge, { backgroundColor: ratingColor(review.rating) + '18' }]}>
          <Text style={[styles.ratingBadgeText, { color: ratingColor(review.rating) }]}>
            {review.rating}/5
          </Text>
        </View>
      </View>

      {/* Review text */}
      <View style={styles.commentWrap}>
        <Text style={styles.commentText}>{`"${review.comment}"`}</Text>
      </View>

      {/* Review photos */}
      {review.photos?.length > 0 && (
        <View style={styles.photosRow}>
          <Text style={styles.photosLabel}>{review.photos.length} photo{review.photos.length !== 1 ? 's' : ''} attached</Text>
        </View>
      )}

      {/* Divider */}
      <View style={styles.divider} />

      {/* Actions */}
      <View style={styles.actions}>
        <Button
          title="Edit Review"
          variant="secondary"
          size="sm"
          onPress={onEdit}
          accessibilityLabel={`Edit review for ${hotelTitle}`}
        />
        <Button
          title={isDeleting ? 'Deleting…' : 'Delete'}
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

function ratingColor(rating: number): string {
  if (rating >= 4) return '#16A34A';
  if (rating === 3) return '#F59E0B';
  return '#EF4444';
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  flex: { flex: 1 },

  /* ─── Header ─── */
  header: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 16,
    gap: 10,
  },
  back: { color: colors.teal, fontSize: 15, fontWeight: '600' },
  headerText: { gap: 3 },
  title: {
    fontFamily: font.display,
    color: colors.ink,
    fontSize: 28,
    fontWeight: '600',
    letterSpacing: -0.4,
  },
  subtitle: { color: colors.inkMuted, fontSize: 13 },

  /* ─── List ─── */
  list: { padding: 20, gap: 16 },

  /* ─── Review card ─── */
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.line,
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
    fontFamily: font.display,
    color: colors.ink,
    fontSize: 17,
    fontWeight: '600',
  },
  hotelLocation: { color: colors.inkMuted, fontSize: 12, marginTop: 2 },
  dateText: { color: colors.inkMuted, fontSize: 12, flexShrink: 0 },

  /* ─── Rating ─── */
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  ratingBadge: {
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  ratingBadgeText: { fontSize: 12, fontWeight: '800' },

  /* ─── Comment ─── */
  commentWrap: {
    backgroundColor: '#F8FAFC',
    borderRadius: radius.card - 4,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: colors.teal,
  },
  commentText: {
    color: colors.inkSoft,
    fontSize: 14,
    lineHeight: 21,
    fontStyle: 'italic',
  },

  /* ─── Photos ─── */
  photosRow: { flexDirection: 'row', alignItems: 'center' },
  photosLabel: { color: colors.inkMuted, fontSize: 12 },

  /* ─── Actions ─── */
  divider: { height: 1, backgroundColor: colors.line },
  actions: { flexDirection: 'row', gap: 10 },
});
