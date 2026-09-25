import { QueryClient } from '@tanstack/react-query'

export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Default moderate stale time (2 minutes)
        staleTime: 1000 * 60 * 2,
        gcTime: 1000 * 60 * 15,
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
        retry: (failureCount, error: any) => {
          // Do not retry client 4xx errors (validation, auth, conflict)
          if (error?.status >= 400 && error?.status < 500) return false
          return failureCount < 2
        },
      },
      mutations: {
        retry: false,
      },
    },
  })
}

let browserQueryClient: QueryClient | undefined = undefined

export function getQueryClient(): QueryClient {
  if (typeof window === 'undefined') {
    // Server: always make a new query client
    return makeQueryClient()
  } else {
    // Browser: reuse client across renders
    if (!browserQueryClient) browserQueryClient = makeQueryClient()
    return browserQueryClient
  }
}

// Resource-specific cache query key factories & stale times
export const CACHE_POLICIES = {
  // Room availability: Very short staleTime (20s)
  AVAILABILITY: {
    staleTime: 1000 * 20,
    refetchOnWindowFocus: true,
  },
  // Hotel details and room catalog: Moderate staleTime (5 minutes)
  HOTEL_DETAILS: {
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  },
  // Static Catalogs (Cities, Amenities, Policies): Long staleTime (30 minutes)
  STATIC_CATALOG: {
    staleTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
  },
  // Operational Dashboard KPIs: Controlled refetch interval (30s)
  DASHBOARD_STATS: {
    staleTime: 1000 * 30,
    refetchInterval: 1000 * 30,
  },
} as const
