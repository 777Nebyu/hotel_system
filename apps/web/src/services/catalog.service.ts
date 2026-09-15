import { apiClient } from '@/lib/axios'
import type {
  Hotel,
  HotelSummary,
  Paginated,
  Room,
  RoomAvailability,
  HotelPolicy,
  ReviewsResponse,
  FavoriteHotel,
} from '@/lib/types'
import type { SearchHotelsQuery } from '@repo/shared-types'

function toQueryString(params?: Record<string, string | number | boolean | string[] | undefined>): string {
  if (!params) return ''
  const searchParams = new URLSearchParams()

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return
    if (Array.isArray(value)) {
      if (value.length > 0) {
        searchParams.set(key, value.join(','))
      }
    } else {
      searchParams.set(key, String(value))
    }
  })

  const qs = searchParams.toString()
  return qs ? `?${qs}` : ''
}

export const catalogService = {
  searchHotels: async (params?: Partial<SearchHotelsQuery>): Promise<Paginated<HotelSummary>> => {
    const res = await apiClient.get<Paginated<HotelSummary>>(`/catalog/hotels${toQueryString(params as any)}`)
    return res.data
  },

  getHotelById: async (id: string): Promise<Hotel> => {
    const res = await apiClient.get<Hotel>(`/catalog/hotels/${id}`)
    return res.data
  },

  getHotelRooms: async (
    hotelId: string,
    params?: { startDate?: string; endDate?: string; checkIn?: string; checkOut?: string },
  ): Promise<RoomAvailability[]> => {
    const checkIn = params?.checkIn || params?.startDate
    const checkOut = params?.checkOut || params?.endDate
    const queryParams: Record<string, string> = {}
    if (checkIn) queryParams.checkIn = checkIn
    if (checkOut) queryParams.checkOut = checkOut
    const res = await apiClient.get<RoomAvailability[]>(
      `/catalog/hotels/${hotelId}/rooms${toQueryString(queryParams)}`,
    )
    return res.data
  },

  getRoomById: async (roomId: string): Promise<Room> => {
    const res = await apiClient.get<Room>(`/catalog/rooms/${roomId}`)
    return res.data
  },

  getHotelPolicy: async (hotelId: string): Promise<HotelPolicy> => {
    const res = await apiClient.get<HotelPolicy>(`/catalog/hotels/${hotelId}/policy`)
    return res.data
  },

  getCities: async (country?: string): Promise<Array<{ id: string; name: string; country: { name: string } }>> => {
    const res = await apiClient.get<Array<{ id: string; name: string; country: { name: string } }>>(
      `/catalog/cities${toQueryString({ country })}`,
    )
    return res.data
  },

  getCountries: async (): Promise<Array<{ id: string; name: string; code: string }>> => {
    const res = await apiClient.get<Array<{ id: string; name: string; code: string }>>('/catalog/countries')
    return res.data
  },

  getAmenities: async (): Promise<Array<{ id: string; name: string }>> => {
    const res = await apiClient.get<Array<{ id: string; name: string }>>('/catalog/amenities')
    return res.data
  },

  getHotelReviews: async (hotelId: string, page = 1): Promise<ReviewsResponse> => {
    const res = await apiClient.get<ReviewsResponse>(`/hotels/${hotelId}/reviews?page=${page}`)
    return res.data
  },

  getFavorites: async (): Promise<FavoriteHotel[]> => {
    const res = await apiClient.get<FavoriteHotel[]>('/favorites/my')
    return res.data
  },

  addFavorite: async (hotelId: string): Promise<void> => {
    await apiClient.post(`/favorites/${hotelId}`)
  },

  removeFavorite: async (hotelId: string): Promise<void> => {
    await apiClient.delete(`/favorites/${hotelId}`)
  },

  getMyReviews: async (): Promise<any[]> => {
    const res = await apiClient.get<any[]>('/reviews/my')
    return res.data
  },

  createReview: async (data: {
    hotelId: string
    bookingId?: string
    rating: number
    comment: string
    photos?: string[]
  }): Promise<any> => {
    const res = await apiClient.post('/reviews', data)
    return res.data
  },

  deleteReview: async (reviewId: string): Promise<void> => {
    await apiClient.delete(`/reviews/${reviewId}`)
  },
}
