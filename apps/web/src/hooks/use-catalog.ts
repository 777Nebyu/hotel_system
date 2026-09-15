import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { catalogService } from '@/services/catalog.service'
import { CACHE_POLICIES } from '@/lib/query-client'
import type { SearchHotelsQuery } from '@repo/shared-types'
import { useAuth } from '@/lib/auth-store'

export function useHotelSearchQuery(params?: Partial<SearchHotelsQuery>) {
  return useQuery({
    queryKey: ['hotels', 'search', params],
    queryFn: () => catalogService.searchHotels(params),
    ...CACHE_POLICIES.HOTEL_DETAILS,
  })
}

export function useHotelQuery(id: string) {
  return useQuery({
    queryKey: ['hotel', id],
    queryFn: () => catalogService.getHotelById(id),
    enabled: Boolean(id),
    ...CACHE_POLICIES.HOTEL_DETAILS,
  })
}

export function useHotelRoomsQuery(
  hotelId: string,
  dates?: { startDate?: string; endDate?: string },
) {
  return useQuery({
    queryKey: ['hotel', hotelId, 'rooms', dates?.startDate, dates?.endDate],
    queryFn: () => catalogService.getHotelRooms(hotelId, dates),
    enabled: Boolean(hotelId),
    ...CACHE_POLICIES.AVAILABILITY, // 20s staleTime + window focus refetch
  })
}

export function useHotelPolicyQuery(hotelId: string) {
  return useQuery({
    queryKey: ['hotel', hotelId, 'policy'],
    queryFn: () => catalogService.getHotelPolicy(hotelId),
    enabled: Boolean(hotelId),
    ...CACHE_POLICIES.STATIC_CATALOG,
  })
}

export function useCitiesQuery(country?: string) {
  return useQuery({
    queryKey: ['catalog', 'cities', country],
    queryFn: () => catalogService.getCities(country),
    ...CACHE_POLICIES.STATIC_CATALOG,
  })
}

export function useAmenitiesQuery() {
  return useQuery({
    queryKey: ['catalog', 'amenities'],
    queryFn: () => catalogService.getAmenities(),
    ...CACHE_POLICIES.STATIC_CATALOG,
  })
}

export function useHotelReviewsQuery(hotelId: string, page = 1) {
  return useQuery({
    queryKey: ['hotel', hotelId, 'reviews', page],
    queryFn: () => catalogService.getHotelReviews(hotelId, page),
    enabled: Boolean(hotelId),
    staleTime: 1000 * 60 * 5,
  })
}

export function useFavoritesQuery() {
  const user = useAuth((s) => s.user)
  return useQuery({
    queryKey: ['favorites', 'mine'],
    queryFn: () => catalogService.getFavorites(),
    enabled: Boolean(user),
    staleTime: 1000 * 60 * 5,
  })
}

export function useToggleFavoriteMutation() {
  const queryClient = useQueryClient()
  const user = useAuth((s) => s.user)

  return useMutation({
    mutationFn: async ({ hotelId, isFavorite }: { hotelId: string; isFavorite: boolean }) => {
      if (!user) throw new Error('Sign in required')
      if (isFavorite) {
        await catalogService.removeFavorite(hotelId)
      } else {
        await catalogService.addFavorite(hotelId)
      }
    },
    // Contract 2.E: Optimistic UI boundary permits wishlisting with error rollback
    onMutate: async ({ hotelId, isFavorite }) => {
      await queryClient.cancelQueries({ queryKey: ['favorites', 'mine'] })
      const previous = queryClient.getQueryData<any[]>(['favorites', 'mine'])

      if (previous) {
        if (isFavorite) {
          queryClient.setQueryData(['favorites', 'mine'], previous.filter((h) => h.id !== hotelId))
        } else {
          queryClient.setQueryData(['favorites', 'mine'], [...previous, { id: hotelId }])
        }
      }

      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['favorites', 'mine'], context.previous)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['favorites', 'mine'] })
    },
  })
}

export function useMyReviewsQuery() {
  const user = useAuth((s) => s.user)

  return useQuery({
    queryKey: ['reviews', 'mine'],
    queryFn: () => catalogService.getMyReviews(),
    enabled: Boolean(user),
    staleTime: 1000 * 60 * 2,
  })
}

export function useCreateReviewMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: {
      hotelId: string
      bookingId?: string
      rating: number
      comment: string
      photos?: string[]
    }) => catalogService.createReview(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviews'] })
      queryClient.invalidateQueries({ queryKey: ['hotel'] })
    },
  })
}

export function useDeleteReviewMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (reviewId: string) => catalogService.deleteReview(reviewId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviews'] })
      queryClient.invalidateQueries({ queryKey: ['hotel'] })
    },
  })
}

