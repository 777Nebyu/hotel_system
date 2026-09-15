import { create } from 'zustand'
import { apiClient, configureAuthInterceptors, ApiError } from './axios'
import type { User, AuthTokens } from './types'

export interface AuthResponse {
  user: User
  accessToken: string
  refreshToken: string
}

const STORAGE_KEY = 'yayetech.session'
const LEGACY_STORAGE_KEY = 'luxstay.session'

function getSavedSession(): AuthResponse | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function persistSession(data: AuthResponse | null) {
  if (typeof window === 'undefined') return
  try {
    if (data) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    } else {
      localStorage.removeItem(STORAGE_KEY)
      localStorage.removeItem(LEGACY_STORAGE_KEY)
    }
  } catch {
    // Ignore storage quota or security errors
  }
}

interface AuthState {
  user: User | null
  tokens: AuthTokens | null
  loading: boolean
  isInitialized: boolean
  
  // Role helpers
  isAdmin: boolean
  isManager: boolean
  isStaff: boolean
  isCustomer: boolean

  // Actions
  login: (email: string, password: string) => Promise<AuthResponse>
  logout: () => void
  refreshAuth: () => Promise<void>
  loadFromStorage: () => void
  setUser: (user: User) => void
  setTokens: (tokens: AuthTokens) => void
  setSession: (data: AuthResponse) => void
}

export const useAuth = create<AuthState>((set, get) => {
  // Wire up Axios interceptors to this store
  if (typeof window !== 'undefined') {
    configureAuthInterceptors({
      getAccessToken: () => get().tokens?.accessToken,
      getRefreshToken: () => get().tokens?.refreshToken,
      onTokensRefreshed: (accessToken, refreshToken) => {
        const currentUser = get().user
        if (currentUser) {
          get().setSession({ user: currentUser, accessToken, refreshToken })
        }
      },
      onAuthFailed: () => {
        get().logout()
      },
    })
  }

  return {
    user: null,
    tokens: null,
    loading: false,
    isInitialized: false,

    isAdmin: false,
    isManager: false,
    isStaff: false,
    isCustomer: false,

    login: async (email: string, password: string) => {
      set({ loading: true })
      try {
        const res = await apiClient.post<AuthResponse>('/auth/login', { email, password })
        const data = res.data

        if (!['ADMIN', 'MANAGER', 'CUSTOMER', 'STAFF'].includes(data.user.role)) {
          throw new ApiError('This portal is available to registered accounts only.', 403, 'FORBIDDEN')
        }

        set({
          user: data.user,
          tokens: { accessToken: data.accessToken, refreshToken: data.refreshToken },
          isAdmin: data.user.role === 'ADMIN',
          isManager: data.user.role === 'MANAGER',
          isStaff: data.user.role === 'STAFF',
          isCustomer: data.user.role === 'CUSTOMER',
          loading: false,
          isInitialized: true,
        })
        persistSession(data)
        return data
      } catch (err) {
        set({ loading: false })
        throw err
      }
    },

    logout: () => {
      const token = get().tokens?.accessToken
      if (token) {
        apiClient.post('/auth/logout').catch(() => undefined)
      }
      set({
        user: null,
        tokens: null,
        isAdmin: false,
        isManager: false,
        isStaff: false,
        isCustomer: false,
        loading: false,
      })
      persistSession(null)
    },

    refreshAuth: async () => {
      const { tokens, user } = get()
      if (!tokens?.refreshToken) return
      try {
        const res = await apiClient.post<{ accessToken: string; refreshToken: string }>('/auth/refresh', {
          refreshToken: tokens.refreshToken,
        })
        const { accessToken, refreshToken } = res.data
        if (user && accessToken && refreshToken) {
          get().setSession({ user, accessToken, refreshToken })
        }
      } catch {
        get().logout()
      }
    },

    setUser: (user: User) => {
      set({
        user,
        isAdmin: user.role === 'ADMIN',
        isManager: user.role === 'MANAGER',
        isStaff: user.role === 'STAFF',
        isCustomer: user.role === 'CUSTOMER',
      })
      const saved = getSavedSession()
      if (saved) {
        saved.user = user
        persistSession(saved)
      }
    },

    setTokens: (tokens: AuthTokens) => {
      set({ tokens })
      const saved = getSavedSession()
      if (saved) {
        saved.accessToken = tokens.accessToken
        saved.refreshToken = tokens.refreshToken
        persistSession(saved)
      }
    },

    setSession: (data: AuthResponse) => {
      set({
        user: data.user,
        tokens: { accessToken: data.accessToken, refreshToken: data.refreshToken },
        isAdmin: data.user.role === 'ADMIN',
        isManager: data.user.role === 'MANAGER',
        isStaff: data.user.role === 'STAFF',
        isCustomer: data.user.role === 'CUSTOMER',
        isInitialized: true,
      })
      persistSession(data)
    },

    loadFromStorage: () => {
      const saved = getSavedSession()
      if (!saved || !saved.user || !['ADMIN', 'MANAGER', 'CUSTOMER', 'STAFF'].includes(saved.user.role)) {
        persistSession(null)
        set({ isInitialized: true })
        return
      }
      set({
        user: saved.user,
        tokens: { accessToken: saved.accessToken, refreshToken: saved.refreshToken },
        isAdmin: saved.user.role === 'ADMIN',
        isManager: saved.user.role === 'MANAGER',
        isStaff: saved.user.role === 'STAFF',
        isCustomer: saved.user.role === 'CUSTOMER',
        isInitialized: true,
      })
    },
  }
})
