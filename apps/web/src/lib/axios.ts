import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios'

export const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001').replace(/\/$/, '')

export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'NETWORK_ERROR'
  | 'SERVER_ERROR'
  | 'UNKNOWN_ERROR'

export interface ApiFieldError {
  field: string
  message: string
}

export class ApiError extends Error {
  status: number
  code: ApiErrorCode
  details?: Record<string, string[]> | ApiFieldError[] | unknown
  retryAfter?: number

  constructor(
    message: string,
    status: number,
    code: ApiErrorCode,
    details?: unknown,
    retryAfter?: number,
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
    this.retryAfter = retryAfter
  }
}

// Token accessor callbacks configured by auth store
type TokenGetter = () => string | null | undefined
type TokenSetter = (accessToken: string, refreshToken: string) => void
type LogoutHandler = () => void

let getAccessToken: TokenGetter = () => null
let getRefreshToken: TokenGetter = () => null
let onTokensRefreshed: TokenSetter = () => {}
let onAuthFailed: LogoutHandler = () => {}

export function configureAuthInterceptors(config: {
  getAccessToken: TokenGetter
  getRefreshToken: TokenGetter
  onTokensRefreshed: TokenSetter
  onAuthFailed: LogoutHandler
}) {
  getAccessToken = config.getAccessToken
  getRefreshToken = config.getRefreshToken
  onTokensRefreshed = config.onTokensRefreshed
  onAuthFailed = config.onAuthFailed
}

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request Interceptor: Token injection and Idempotency Key
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getAccessToken()
  if (token && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${token}`
  }

  // Contract: Generate UUID Idempotency-Key on mutating HTTP methods
  const method = (config.method || 'GET').toUpperCase()
  if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(method) && !config.headers['Idempotency-Key']) {
    config.headers['Idempotency-Key'] =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `yayetech-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  }

  return config
})

// Concurrency locking for silent 401 token refresh
let isRefreshing = false
let refreshSubscribers: ((token: string | null) => void)[] = []

function subscribeTokenRefresh(cb: (token: string | null) => void) {
  refreshSubscribers.push(cb)
}

function notifyTokenRefresh(token: string | null) {
  refreshSubscribers.forEach((cb) => cb(token))
  refreshSubscribers = []
}

// Response Interceptor: 401 Token Refresh and Normalized Error Mapping
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean }

    // Handle Network Errors or Timeouts
    if (!error.response) {
      const isTimeout = error.code === 'ECONNABORTED'
      throw new ApiError(
        isTimeout
          ? 'The request timed out. Please check your connection and try again.'
          : `Unable to connect to the hotel system server at ${API_BASE_URL}.`,
        0,
        'NETWORK_ERROR',
      )
    }

    const { status, data, headers } = error.response
    const responseData = data as any

    // Handle 401 Token Refresh
    const isAuthEndpoint = originalRequest.url?.includes('/auth/login') || originalRequest.url?.includes('/auth/refresh')

    if (status === 401 && !originalRequest._retry && !isAuthEndpoint) {
      originalRequest._retry = true
      const refreshToken = getRefreshToken()

      if (!refreshToken) {
        onAuthFailed()
        throw new ApiError('Session expired. Please sign in again.', 401, 'UNAUTHORIZED')
      }

      if (!isRefreshing) {
        isRefreshing = true

        try {
          const refreshResponse = await axios.post(`${API_BASE_URL}/auth/refresh`, { refreshToken })
          const { accessToken, refreshToken: newRefresh } = refreshResponse.data

          if (accessToken && newRefresh) {
            onTokensRefreshed(accessToken, newRefresh)
            isRefreshing = false
            notifyTokenRefresh(accessToken)

            originalRequest.headers.Authorization = `Bearer ${accessToken}`
            return apiClient(originalRequest)
          } else {
            throw new Error('Malformed token response')
          }
        } catch (refreshErr) {
          isRefreshing = false
          notifyTokenRefresh(null)
          onAuthFailed()
          throw new ApiError('Your session has expired. Please sign in again.', 401, 'UNAUTHORIZED')
        }
      } else {
        // Wait for active refresh in-flight
        return new Promise((resolve, reject) => {
          subscribeTokenRefresh((newToken) => {
            if (newToken) {
              originalRequest.headers.Authorization = `Bearer ${newToken}`
              resolve(apiClient(originalRequest))
            } else {
              reject(new ApiError('Your session has expired. Please sign in again.', 401, 'UNAUTHORIZED'))
            }
          })
        })
      }
    }

    // Normalized API Error Mapping
    let normalizedCode: ApiErrorCode = 'UNKNOWN_ERROR'
    let message = 'An unexpected error occurred. Please try again.'
    let details: unknown = undefined
    let retryAfter: number | undefined

    if (status === 400) {
      normalizedCode = 'VALIDATION_ERROR'
      message = 'Please correct the highlighted input errors.'
    } else if (status === 401) {
      normalizedCode = 'UNAUTHORIZED'
      message = 'Please sign in to access this resource.'
    } else if (status === 403) {
      normalizedCode = 'FORBIDDEN'
      message = 'You do not have permission to perform this action.'
    } else if (status === 404) {
      normalizedCode = 'NOT_FOUND'
      message = 'The requested resource could not be found.'
    } else if (status === 409) {
      normalizedCode = 'CONFLICT'
      message = 'This room is no longer available for the selected dates. Please select alternative dates or rooms.'
    } else if (status === 429) {
      normalizedCode = 'RATE_LIMITED'
      const retryHeader = headers ? headers['retry-after'] : null
      retryAfter = retryHeader ? Number(retryHeader) : 60
      message = `Too many requests. Please wait ${retryAfter} seconds before trying again.`
    } else if (status >= 500) {
      normalizedCode = 'SERVER_ERROR'
      message = 'The server encountered an error processing your request. Please try again later.'
    }

    // Parse API message payload
    if (responseData) {
      const errObj =
        'error' in responseData && typeof responseData.error === 'object' && responseData.error !== null
          ? responseData.error
          : responseData

      if (errObj.message) {
        message = Array.isArray(errObj.message) ? errObj.message.join(', ') : errObj.message
      }
      details = errObj.details || errObj.issues || undefined
    }

    throw new ApiError(message, status, normalizedCode, details, retryAfter)
  },
)
