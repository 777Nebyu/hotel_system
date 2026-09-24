import React, { useEffect } from 'react';
import { Alert, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { FlashList } from '@shopify/flash-list';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { useAppSelector } from '../store/hooks';
import { useFavorites, useToggleFavorite } from '../hooks/useQueries';
import { useQueryClient } from '@tanstack/react-query';
import { EmptyState, ErrorBox, Stars } from '../components/Shared';
import { classifyError } from '../errors';
import { SkeletonList } from '../components/Skeleton';
import { colors, darkColors, font, radius, shadowCard } from '../theme';
import { hapticLight } from '../hooks/useHaptics';
import { useResponsivePadding } from '../hooks/useResponsivePadding';
import { useTheme } from '../hooks/useTheme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const PLACEHOLDER =
  'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=900&h=600&fit=crop&auto=format';

export default function FavoritesScreen() {
  const pad = useResponsivePadding();
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const session = useAppSelector((s) => s.auth.session);
  const canViewFavorites = session?.user?.role !== 'STAFF';
  const queryClient = useQueryClient();
  const { colorScheme } = useTheme();
  const insets = useSafeAreaInsets();
  const dark = colorScheme === 'dark';
  const c = dark ? darkColors : colors;

  useEffect(() => {
    if (!session) {
      Alert.alert(
        t('favorites.loginRequired', 'Sign In Required'),
        t('favorites.loginRequiredMsg', 'Sign in to view your saved hotels.'),
        [
          { text: t('favorites.cancel', 'Cancel'), style: 'cancel' },
          {
            text: t('favorites.signIn', 'Sign In'),
            onPress: () => navigation.navigate('Auth', { initialMode: 'login' }),
          },
        ],
      );
    }
  }, [session, navigation, t]);

  const { data, isLoading, error, refetch, isRefetching } = useFavorites(canViewFavorites ? (session?.accessToken ?? '') : '');
  const toggleFavorite = useToggleFavorite(canViewFavorites ? (session?.accessToken ?? '') : '');
  const favorites: any[] = Array.isArray(data) ? data : (data as any)?.data ?? [];

  if (session?.user?.role === 'STAFF') {
    return (
      <View style={{ flex: 1, backgroundColor: c.paper, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Text style={{ color: c.ink, fontSize: 18, fontWeight: '700', textAlign: 'center' }}>{t('profile.staff_saved_unavailable')}</Text>
      </View>
    );
  }

  const removeFavorite = async (id: string) => {
    hapticLight();
    // Optimistic: remove from list immediately
    const previous = favorites;
    queryClient.setQueryData(['favorites'], (old: any) => {
      const arr = Array.isArray(old) ? old : (old as any)?.data ?? [];
      return arr.filter((f: any) => f.id !== id);
    });
    try {
      await toggleFavorite.mutateAsync({ hotelId: id, isFavorite: false });
    } catch {
      // Rollback on error. Feedback (toast) is handled by useToggleFavorite.
      queryClient.setQueryData(['favorites'], previous);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.paper }}>
      {/* ─── Header ─── */}
      <View style={[s.header, { backgroundColor: c.surface, borderBottomColor: c.line, paddingTop: insets.top + 12 }]}>
        <Text style={[s.title, { color: c.ink }]}>{t('favorites.title', 'Saved Hotels')}</Text>
        <Text style={[s.subtitle, { color: c.inkMuted }]}>
          {favorites.length > 0
            ? `${favorites.length} saved hotel${favorites.length !== 1 ? 's' : ''}`
            : t('favorites.subtitle', 'Hotels you love, all in one place.')}
        </Text>
      </View>

      {error && <ErrorBox message={classifyError(error).title} onRetry={refetch} />}

      <FlashList
        data={favorites}
        keyExtractor={(f) => f.id}
        contentContainerStyle={[{ padding: 20, gap: 16, paddingHorizontal: pad }]}
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
            <SkeletonList count={3} />
          ) : (
            <EmptyState
              title={t('favorites.noFavorites', 'No saved hotels')}
              subtitle={t('favorites.noFavoritesSubtitle', 'Tap the heart icon on any hotel to save it here.')}
            />
          )
        }
        renderItem={({ item }) => {
          const isInactive = item.isActive === false || item.status === 'SUSPENDED' || item.status === 'REJECTED';
          return (
            <Pressable
              onPress={() => navigation.navigate('HotelDetail', { hotelId: item.id })}
              style={({ pressed }) => [s.cardWrap, pressed && s.cardPressed, isInactive && { opacity: 0.6 }]}
            >
              <View style={[s.card, { backgroundColor: c.surface, borderColor: c.line }, shadowCard]}>
                {/* Image */}
                <View style={s.imageWrap}>
                  {item.primaryImageUrl ? (
                    <Image
                      source={{ uri: item.primaryImageUrl }}
                      style={s.image}
                      contentFit="cover"
                      placeholder={{ blurhash: 'LKO2?U42NwRn4jEYJMROM[~q?xRP' }}
                      transition={300}
                    />
                  ) : (
                    <Image
                      source={{ uri: PLACEHOLDER }}
                      style={s.image}
                      contentFit="cover"
                      transition={300}
                    />
                  )}

                  {/* Star pill */}
                  <View style={s.starPill}>
                    <Text style={s.starPillText}>
                      {'★'.repeat(Math.max(0, Math.min(5, item.starRating)))}
                    </Text>
                  </View>

                  {/* Remove heart */}
                  <Pressable
                    onPress={() => removeFavorite(item.id)}
                    style={s.heartBtn}
                    hitSlop={8}
                  >
                    <Text style={s.heart}>♥</Text>
                  </Pressable>
                </View>

                {/* Body */}
                <View style={s.body}>
                  <Text style={[s.name, { color: c.ink }]} numberOfLines={1}>{item.name}</Text>
                  {isInactive && (
                    <Text style={{ color: '#EF4444', fontSize: 11, fontWeight: '600', marginBottom: 2 }}>
                      Hotel currently unavailable
                    </Text>
                  )}
                  <Text style={[s.location, { color: c.inkMuted }]} numberOfLines={1}>
                  📍 {item.city?.name}
                  {item.city?.country?.name ? `, ${item.city.country.name}` : ''}
                </Text>

                <View style={[s.footer, { borderTopColor: c.line }]}>
                  <View>
                    <Stars value={item.averageRating ?? item.starRating} size={12} />
                    {item.reviewCount != null && (
                      <Text style={[s.reviewCount, { color: c.inkMuted }]}>
                        {item.reviewCount} {item.reviewCount !== 1 ? t('search.reviews') : t('search.review')}
                      </Text>
                    )}
                  </View>
                  <View style={s.priceBlock}>
                    {item.minPricePerNight != null && (
                      <>
                        <Text style={[s.fromLabel, { color: c.inkMuted }]}>{t('hotel.from')}</Text>
                        <Text style={[s.price, { color: c.ink }]}>ETB {item.minPricePerNight}</Text>
                        <Text style={[s.perNight, { color: c.inkMuted }]}>{t('hotel.perNight')}</Text>
                      </>
                    )}
                  </View>
                </View>

                {/* View button */}
                <View style={s.viewRow}>
                  <Text style={[s.viewBtn, { color: c.teal }]}>{t('buttons.view_hotel')}</Text>
                </View>
              </View>
            </View>
          </Pressable>
          );
        }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  /* ─── Header ─── */
  header: {
    borderBottomWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 16,
  },
  title: {
    fontFamily: font.display,
    fontSize: 28,
    fontWeight: '600',
    letterSpacing: -0.4,
  },
  subtitle: { fontSize: 13, marginTop: 4 },

  /* ─── List ─── */
  list: { padding: 20, gap: 16 },
  cardWrap: {},
  cardPressed: { transform: [{ scale: 0.985 }], opacity: 0.9 },

  /* ─── Card ─── */
  card: {
    borderRadius: radius.card,
    borderWidth: 1,
    overflow: 'hidden',
  },
  imageWrap: { position: 'relative' },
  image: { width: '100%', aspectRatio: 16 / 9 },
  starPill: {
    position: 'absolute',
    left: 12,
    top: 12,
    backgroundColor: 'rgba(15,23,42,0.72)',
    borderRadius: radius.pill,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  starPillText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  heartBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heart: { fontSize: 18, color: '#EF4444' },

  /* ─── Body ─── */
  body: { padding: 14, gap: 5 },
  name: {
    fontFamily: font.display,
    fontSize: 17,
    fontWeight: '600',
  },
  location: { fontSize: 13 },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 6,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  reviewCount: { fontSize: 11, marginTop: 2 },
  priceBlock: { alignItems: 'flex-end' },
  fromLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  price: { fontSize: 18, fontWeight: '800' },
  perNight: { fontSize: 11 },
  viewRow: {
    alignItems: 'flex-end',
    marginTop: 4,
  },
  viewBtn: { fontSize: 13, fontWeight: '700' },
});
