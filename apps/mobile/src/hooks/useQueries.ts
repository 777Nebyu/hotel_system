import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { request } from '../api';
import type { HotelSummary, Hotel, Booking, BookingQuote, Review, FavoriteHotel, Notification, Payment } from '../types';
import { cacheQuery, getCachedQuery } from '../store/offlineCache';
const authorizedFetch = async <T>(path: string, token?: string | null, options?: { method?: string; body?: unknown }): Promise<T> => {
  return request<T>(path, { method: options?.method ?? 'GET', body: options?.body, token });
};

async function cachedFetch<T>(key: string, fetcher: () => Promise<T>, maxAge = 30 * 60 * 1000): Promise<T> {
  try {
    const data = await fetcher();
    void cacheQuery(key, data).catch(() => {});
    return data;
  } catch (err) {
    const cached = await getCachedQuery<T>(key, maxAge);
    if (cached) return cached;
    throw err;
  }
}

export const useHotelSearch = (
  token: string | null | undefined,
  params: { city?: string; country?: string; keyword?: string; minPrice?: number; maxPrice?: number; minRating?: number; roomType?: string; amenities?: string[]; sort?: string; guests?: string; page?: number; pageSize?: number; checkIn?: string; checkOut?: string }
) => {
  const query = new URLSearchParams();
  if (params.city) query.set('city', params.city);
  if (params.country) query.set('country', params.country);
  if (params.keyword) query.set('keyword', params.keyword);
  if (params.minPrice != null) query.set('minPrice', String(params.minPrice));
  if (params.maxPrice != null) query.set('maxPrice', String(params.maxPrice));
  if (params.minRating != null) query.set('minRating', String(params.minRating));
  if (params.roomType) query.set('roomType', params.roomType);
  if (params.amenities?.length) query.set('amenities', params.amenities.join(','));
  if (params.sort) query.set('sort', params.sort);
  if (params.guests) query.set('guests', params.guests === '5+' ? '5' : params.guests);
  if (params.checkIn) query.set('checkIn', params.checkIn);
  if (params.checkOut) query.set('checkOut', params.checkOut);
  query.set('page', String(params.page ?? 1));
  query.set('pageSize', String(params.pageSize ?? 20));

  return useQuery({
    queryKey: ['hotels', 'search', params],
    queryFn: () => cachedFetch(
      `hotels:search:${JSON.stringify(params)}`,
      () => authorizedFetch<{ data: HotelSummary[]; meta: { total: number; page: number; pageSize: number } }>(`/catalog/hotels?${query.toString()}`, token)
    ),
    staleTime: 5 * 60 * 1000,
  });
};

export const useHotelDetail = (token: string | null | undefined, hotelId: string) => {
  return useQuery({
    queryKey: ['hotels', hotelId],
    queryFn: () => cachedFetch(
      `hotels:${hotelId}`,
      () => authorizedFetch<Hotel>(`/catalog/hotels/${hotelId}`, token),
      2 * 60 * 1000
    ),
    staleTime: 2 * 60 * 1000,
    enabled: !!hotelId,
  });
};

export const useHotelRooms = (token: string | null | undefined, hotelId: string, checkIn?: string, checkOut?: string) => {
  return useQuery({
    queryKey: ['hotels', hotelId, 'rooms', { checkIn, checkOut }],
    queryFn: () => {
      const params = new URLSearchParams();
      if (checkIn) params.set('checkIn', checkIn);
      if (checkOut) params.set('checkOut', checkOut);
      const qs = params.toString();
      return authorizedFetch<any>(`/catalog/hotels/${hotelId}/rooms${qs ? `?${qs}` : ''}`, token);
    },
    enabled: !!hotelId,
    staleTime: 60 * 1000,
  });
};

export const useFeaturedHotels = (token?: string | null) => {
  return useQuery({
    queryKey: ['hotels', 'featured'],
    queryFn: () => cachedFetch(
      'hotels:featured',
      () => authorizedFetch<{ data: HotelSummary[] }>(`/catalog/hotels?page=1&pageSize=6&sort=rating_desc`, token),
      10 * 60 * 1000
    ),
    staleTime: 10 * 60 * 1000,
  });
};

export const useHotelReviews = (token: string | null | undefined, hotelId: string) => {
  return useQuery({
    queryKey: ['reviews', hotelId],
    queryFn: () => authorizedFetch<{ data: Review[] }>(`/hotels/${hotelId}/reviews`, token),
    staleTime: 5 * 60 * 1000,
    enabled: !!hotelId,
  });
};

export const useBookingHistory = (token: string, scope: 'upcoming' | 'past') => {
  return useQuery({
    queryKey: ['bookings', scope],
    queryFn: () => cachedFetch(
      `bookings:${scope}`,
      () => authorizedFetch<{ data: Booking[] }>(`/bookings/my?scope=${scope}`, token),
      2 * 60 * 1000
    ),
    staleTime: 2 * 60 * 1000,
    enabled: !!token,
  });
};

export const useBookingDetail = (token: string, bookingId: string) => {
  return useQuery({
    queryKey: ['bookings', bookingId],
    queryFn: () => authorizedFetch<Booking>(`/bookings/${bookingId}`, token),
    staleTime: 1 * 60 * 1000,
    enabled: !!bookingId,
  });
};

export const useBookingQuote = (token: string, params: { hotelId: string; roomId: string; checkIn: string; checkOut: string; guestCount: number; promoCode?: string }) => {
  return useQuery({
    queryKey: ['bookingQuote', params],
    queryFn: () => {
      const body: Record<string, unknown> = {
        hotelId: params.hotelId,
        roomIds: [params.roomId],
        checkIn: params.checkIn,
        checkOut: params.checkOut,
        guests: { adults: Math.max(1, params.guestCount), children: 0 },
      };
      if (params.promoCode) body.promoCode = params.promoCode;
      return authorizedFetch<BookingQuote>('/bookings/checkout', token, {
        method: 'POST',
        body,
      });
    },
    staleTime: 30 * 1000,
    enabled: !!params.hotelId && !!params.roomId && !!params.checkIn && !!params.checkOut,
  });
};

export const useFavorites = (token: string) => {
  return useQuery({
    queryKey: ['favorites'],
    queryFn: () => cachedFetch(
      'favorites',
      () => authorizedFetch<{ data: FavoriteHotel[] }>(`/favorites/my`, token),
      2 * 60 * 1000
    ),
    staleTime: 2 * 60 * 1000,
    enabled: !!token,
  });
};

export const useNotifications = (token: string) => {
  return useQuery({
    queryKey: ['notifications'],
    queryFn: () => authorizedFetch<{ data: Notification[] }>(`/notifications`, token),
    staleTime: 1 * 60 * 1000,
    enabled: !!token,
  });
};

export const useNotificationUnreadCount = (token: string) => {
  return useQuery({
    queryKey: ['notifications', 'unreadCount'],
    queryFn: () => authorizedFetch<{ unreadCount: number }>('/notifications/unread-count', token),
    staleTime: 30 * 1000,
    enabled: !!token,
  });
};

export const useDashboardStats = (token: string) => {
  return useQuery({
    queryKey: ['dashboardStats'],
    queryFn: () => authorizedFetch<{ upcomingBookings: number; totalNights: number; totalSpent: number; reviewCount: number }>(`/bookings/dashboard/stats`, token),
    staleTime: 5 * 60 * 1000,
    enabled: !!token,
  });
};

export const useCancelBooking = (token: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (bookingId: string) => authorizedFetch(`/bookings/${bookingId}/cancel`, token, { method: 'POST' }),
    onMutate: async (bookingId: string) => {
      await queryClient.cancelQueries({ queryKey: ['bookings'] });
      const previousUpcoming = queryClient.getQueryData<{ data: Booking[] }>(['bookings', 'upcoming']);
      const previousPast = queryClient.getQueryData<{ data: Booking[] }>(['bookings', 'past']);
      const previousBookingDetail = queryClient.getQueryData<Booking>(['bookings', bookingId]);

      queryClient.setQueryData<{ data: Booking[] }>(['bookings', 'upcoming'], (old) =>
        old ? { ...old, data: old.data.filter((b) => b.id !== bookingId) } : old,
      );
      queryClient.setQueryData<Booking>(['bookings', bookingId], (old) =>
        old ? { ...old, status: 'CANCELLED' as const } : old,
      );
      return { previousUpcoming, previousPast, previousBookingDetail };
    },
    onError: (_err, bookingId, context) => {
      if (context?.previousUpcoming) {
        queryClient.setQueryData(['bookings', 'upcoming'], context.previousUpcoming);
      }
      if (context?.previousPast) {
        queryClient.setQueryData(['bookings', 'past'], context.previousPast);
      }
      if (context?.previousBookingDetail) {
        queryClient.setQueryData(['bookings', bookingId], context.previousBookingDetail);
      }
    },
    onSettled: (_data, _err, bookingId) => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      if (bookingId) {
        queryClient.invalidateQueries({ queryKey: ['bookings', bookingId] });
      }
    },
  });
};

export const useToggleFavorite = (token: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ hotelId, isFavorite }: { hotelId: string; isFavorite: boolean }) =>
      isFavorite
        ? authorizedFetch(`/favorites/${hotelId}`, token, { method: 'DELETE' })
        : authorizedFetch(`/favorites/${hotelId}`, token, { method: 'POST' }),
    onMutate: async ({ hotelId, isFavorite }) => {
      // Cancel any in-flight favorites refetches so they don't overwrite our
      // optimistic update before the mutation response arrives.
      await queryClient.cancelQueries({ queryKey: ['favorites'] });
      const previous = queryClient.getQueryData<{ data: FavoriteHotel[] }>(['favorites']);

      queryClient.setQueryData<{ data: FavoriteHotel[] } | FavoriteHotel[]>(
        ['favorites'],
        (old) => {
          // Normalise — the cache can be either { data: [] } or [] directly
          const arr: FavoriteHotel[] = Array.isArray(old)
            ? old
            : (old as any)?.data ?? [];

          if (isFavorite) {
            // Removing — strip the hotel from the list
            const next = arr.filter((f) => f.id !== hotelId);
            return Array.isArray(old) ? next : { ...(old as any), data: next };
          } else {
            // Adding — insert a minimal placeholder so the heart fills instantly.
            // The full object arrives on invalidation after onSettled.
            const alreadyThere = arr.some((f) => f.id === hotelId);
            if (alreadyThere) return old;
            const placeholder = { id: hotelId } as FavoriteHotel;
            const next = [...arr, placeholder];
            return Array.isArray(old) ? next : { ...(old as any), data: next };
          }
        },
      );

      return { previous };
    },
    onError: (_err, _vars, context) => {
      // Rollback the optimistic update on failure
      if (context?.previous !== undefined) {
        queryClient.setQueryData(['favorites'], context.previous);
      }
    },
    onSettled: () => {
      // Always re-fetch to get the authoritative server state
      queryClient.invalidateQueries({ queryKey: ['favorites'] });
    },
  });
};

export const useMarkNotificationRead = (token: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (notificationId: string) => authorizedFetch(`/notifications/${notificationId}/read`, token, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
};

export const useMarkAllNotificationsRead = (token: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => authorizedFetch('/notifications/read-all', token, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
};

export const usePaymentHistory = (token: string) => {
  return useQuery({
    queryKey: ['payments'],
    queryFn: () => authorizedFetch<{ data: Payment[] }>('/payments/my', token),
    staleTime: 5 * 60 * 1000,
    enabled: !!token,
  });
};

export const useMyReviews = (token: string) => {
  return useQuery({
    queryKey: ['myReviews'],
    queryFn: () => authorizedFetch<Review[]>('/reviews/my', token),
    staleTime: 5 * 60 * 1000,
    enabled: !!token,
  });
};

// ─── Manager Room Management ────────────────────────────
export const useManagerHotels = (token: string) => {
  return useQuery({
    queryKey: ['managerHotels'],
    queryFn: () => authorizedFetch<Array<{ id: string; name: string }>>('/catalog/manager/hotels', token),
    staleTime: 5 * 60 * 1000,
    enabled: !!token,
  });
};

export const useManagerRooms = (token: string, hotelId: string | null) => {
  return useQuery({
    queryKey: ['managerRooms', hotelId],
    queryFn: () => authorizedFetch<any[]>(`/catalog/hotels/${hotelId}/rooms/operational`, token),
    staleTime: 1 * 60 * 1000,
    enabled: !!token && !!hotelId,
  });
};

export const useCountries = (token: string) => {
  return useQuery({
    queryKey: ['countries'],
    queryFn: () => authorizedFetch<Array<{ id: string; name: string; code: string }>>('/catalog/countries', token),
    staleTime: 30 * 60 * 1000,
    enabled: !!token,
  });
};

export const useCities = (token: string, country?: string) => {
  return useQuery({
    queryKey: ['cities', country],
    queryFn: () => {
      const qs = country ? `?country=${country}` : '';
      return authorizedFetch<Array<{ id: string; name: string }>>(`/catalog/cities${qs}`, token);
    },
    staleTime: 30 * 60 * 1000,
    enabled: !!token,
  });
};

export const useAmenities = (token: string) => {
  return useQuery({
    queryKey: ['amenities'],
    queryFn: () => authorizedFetch<Array<{ id: string; name: string }>>('/catalog/amenities', token),
    staleTime: 30 * 60 * 1000,
    enabled: !!token,
  });
};

// ─── Disputes ────────────────────────────────────────
export const useDisputes = (token: string, params?: { page?: number; pageSize?: number; status?: string; type?: string }) => {
  const query = new URLSearchParams();
  if (params?.page) query.set('page', String(params.page));
  if (params?.pageSize) query.set('pageSize', String(params.pageSize));
  if (params?.status) query.set('status', params.status);
  if (params?.type) query.set('type', params.type);
  return useQuery({
    queryKey: ['disputes', params],
    queryFn: () => authorizedFetch<{ data: any[]; meta?: any }>(`/disputes?${query.toString()}`, token),
    staleTime: 1 * 60 * 1000,
    enabled: !!token,
  });
};

export const useCreateDispute = (token: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { bookingId: string; reason: string }) =>
      authorizedFetch('/disputes', token, { method: 'POST', body }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['disputes'] }),
  });
};

export const useResolveDispute = (token: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ disputeId, status, resolution }: { disputeId: string; status: 'RESOLVED' | 'CLOSED' | 'DISMISSED'; resolution: string }) =>
      authorizedFetch(`/disputes/${disputeId}/resolve`, token, { method: 'PATCH', body: { status, resolution } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['disputes'] }),
  });
};

// ─── Contact / Messaging ─────────────────────────────
export const useContactThreads = (token: string, params?: { page?: number; pageSize?: number; status?: string }) => {
  const query = new URLSearchParams();
  if (params?.page) query.set('page', String(params.page));
  if (params?.pageSize) query.set('pageSize', String(params.pageSize));
  if (params?.status) query.set('status', params.status);
  return useQuery({
    queryKey: ['contactThreads', params],
    queryFn: () => authorizedFetch<any[]>(`/contact/threads?${query.toString() || 'page=1&pageSize=50'}`, token),
    staleTime: 1 * 60 * 1000,
    enabled: !!token,
  });
};

export const useContactThread = (
  token: string,
  threadId: string,
  options?: { refetchInterval?: number | false },
) => {
  return useQuery({
    queryKey: ['contactThread', threadId],
    queryFn: () => authorizedFetch<any>(`/contact/threads/${threadId}`, token),
    staleTime: 1000,
    refetchInterval: options?.refetchInterval ?? 5000,
    refetchIntervalInBackground: false,
    enabled: !!token && !!threadId,
  });
};

export const useCreateContactThread = (token: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { hotelId: string; subject: string; message: string }) =>
      authorizedFetch(`/hotels/${body.hotelId}/contact`, token, {
        method: 'POST',
        body: { subject: body.subject, message: body.message },
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['contactThreads'] }),
  });
};

export const useSendMessage = (token: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ threadId, content }: { threadId: string; content: string }) =>
      authorizedFetch(`/contact/threads/${threadId}/messages`, token, { method: 'POST', body: { content } }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['contactThread', variables.threadId] });
      queryClient.invalidateQueries({ queryKey: ['contactThreads'] });
    },
  });
};

export const useCloseContactThread = (token: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (threadId: string) =>
      authorizedFetch(`/contact/threads/${threadId}/status`, token, {
        method: 'PATCH',
        body: { status: 'CLOSED' },
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['contactThreads'] }),
  });
};

// ─── Booking Modification ────────────────────────────
export const useModifyBooking = (token: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ bookingId, ...body }: { bookingId: string; checkIn?: string; checkOut?: string; roomIds?: string[]; guests?: any; guestInfos?: any[] }) =>
      authorizedFetch(`/bookings/${bookingId}`, token, { method: 'PATCH', body }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['bookings', variables.bookingId] });
    },
  });
};

// ─── Price Lock ──────────────────────────────────────
export const usePriceLock = (token: string) => {
  return useMutation({
    mutationFn: (body: { hotelId: string; roomIds: string[]; checkIn: string; checkOut: string; guests?: any; promoCode?: string }) =>
      authorizedFetch<{ priceLockToken: string }>('/bookings/price-lock', token, { method: 'POST', body }),
  });
};

export const useConfirmPriceLock = (token: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { priceLockToken: string; hotelId: string; roomIds: string[]; checkIn: string; checkOut: string; guests?: any; guestInfos?: any[]; paymentMethod?: string; idempotencyKey?: string }) =>
      authorizedFetch<{ id: string }>('/bookings/confirm', token, { method: 'POST', body }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['bookings'] }),
  });
};

// ─── Admin Staff-Hotel ───────────────────────────────
export const useAssignStaffHotel = (token: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { staffId: string; hotelId: string }) =>
      authorizedFetch(`/admin/hotels/${body.hotelId}/staff`, token, { method: 'POST', body: { staffId: body.staffId } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['staffHotels'] }),
  });
};

export const useRemoveStaffHotel = (token: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { staffId: string; hotelId: string }) =>
      authorizedFetch(`/admin/hotels/${body.hotelId}/staff/${body.staffId}`, token, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['staffHotels'] }),
  });
};

// ─── Emergency Suspension ────────────────────────────
export const useEmergencySuspend = (token: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ hotelId, reason }: { hotelId: string; reason: string }) =>
      authorizedFetch('/admin/suspensions', token, { method: 'POST', body: { targetType: 'HOTEL', targetId: hotelId, reason } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['hotels'] }),
  });
};
