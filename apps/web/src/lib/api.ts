export const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001').replace(/\/$/, '')

export class ApiError extends Error {
  status: number
  code?: string
  details?: any

  constructor(message: string, status: number, code?: string, details?: any) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }
}

interface ApiOptions extends RequestInit {
  token?: string
  idempotencyKey?: string
  skipRefresh?: boolean
  retries?: number
}

function getStoredRefreshToken(): string | null {
  if (typeof window === 'undefined') return null
  const raw = localStorage.getItem('yayetech.session') || localStorage.getItem('luxstay.session')
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    return parsed?.refreshToken || parsed?.tokens?.refreshToken || null
  } catch {
    return null
  }
}

function updateStoredTokens(accessToken: string, refreshToken: string) {
  if (typeof window === 'undefined') return
  const key = localStorage.getItem('yayetech.session') ? 'yayetech.session' : 'luxstay.session'
  const raw = localStorage.getItem(key)
  if (!raw) return
  try {
    const parsed = JSON.parse(raw)
    parsed.accessToken = accessToken
    parsed.refreshToken = refreshToken
    if (parsed.tokens) {
      parsed.tokens.accessToken = accessToken
      parsed.tokens.refreshToken = refreshToken
    }
    localStorage.setItem(key, JSON.stringify(parsed))
  } catch {
    // Ignore storage update errors
  }
}

let isRefreshing = false
let refreshSubscribers: ((token: string | null) => void)[] = []

function onRefreshed(token: string | null) {
  refreshSubscribers.forEach((cb) => cb(token))
  refreshSubscribers = []
}

async function request<T>(path: string, opts: ApiOptions = {}): Promise<T> {
  const { token, idempotencyKey, skipRefresh, retries = 2, ...init } = opts
  const headers: Record<string, string> = { ...((init.headers as Record<string, string>) || {}) }

  if (init.body && !(init.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json'
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const method = (init.method || 'GET').toUpperCase()
  if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(method)) {
    headers['Idempotency-Key'] = idempotencyKey || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `lux-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`)
  }

  let res: Response
  try {
    res = await fetch(`${API_BASE_URL}${path}`, { ...init, headers, credentials: 'include' })
  } catch {
    if (retries > 0 && ['GET', 'HEAD'].includes(method)) {
      await new Promise((r) => setTimeout(r, 400))
      return request<T>(path, { ...opts, retries: retries - 1 })
    }
    throw new ApiError(`Cannot reach the LuxStay API at ${API_BASE_URL}. Start the backend, then try again.`, 0, 'NETWORK_ERROR')
  }

  // Handle 401 Token Refresh transparently
  if (res.status === 401 && !skipRefresh && !path.startsWith('/auth/login') && !path.startsWith('/auth/refresh')) {
    const storedRefresh = getStoredRefreshToken()
    if (storedRefresh) {
      if (!isRefreshing) {
        isRefreshing = true
        try {
          const refreshRes = await fetch(`${API_BASE_URL}/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken: storedRefresh }),
          })
          if (refreshRes.ok) {
            const refreshData = await refreshRes.json()
            const newAccess = refreshData.accessToken
            const newRefresh = refreshData.refreshToken
            if (newAccess && newRefresh) {
              updateStoredTokens(newAccess, newRefresh)
              isRefreshing = false
              onRefreshed(newAccess)
              return request<T>(path, { ...opts, token: newAccess, skipRefresh: true })
            }
          }
          isRefreshing = false
          onRefreshed(null)
          if (typeof window !== 'undefined') {
            localStorage.removeItem('luxstay.session')
          }
        } catch {
          isRefreshing = false
          onRefreshed(null)
        }
      } else {
        return new Promise<T>((resolve, reject) => {
          refreshSubscribers.push((newToken) => {
            if (newToken) {
              resolve(request<T>(path, { ...opts, token: newToken, skipRefresh: true }))
            } else {
              reject(new ApiError('Session expired. Please sign in again.', 401, 'UNAUTHORIZED'))
            }
          })
        })
      }
    }
  }

  // Retry on rate limit 429 or transient 502/503/504
  if ([429, 502, 503, 504].includes(res.status) && retries > 0) {
    const retryAfter = Number(res.headers.get('Retry-After')) || 1
    await new Promise((r) => setTimeout(r, Math.min(3000, retryAfter * 600)))
    return request<T>(path, { ...opts, retries: retries - 1 })
  }

  const text = await res.text()
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    data = text
  }

  if (!res.ok) {
    let message: string | undefined
    let code: string | undefined
    let details: any = undefined

    if (typeof data === 'object' && data !== null) {
      const errObj = 'error' in data && typeof (data as any).error === 'object' && (data as any).error !== null
        ? (data as any).error
        : data

      code = errObj.code || (data as any).code
      const rawMsg = errObj.message || (data as any).message
      message = Array.isArray(rawMsg) ? rawMsg.join(', ') : rawMsg
      details = errObj.details || (data as any).details
    }

    throw new ApiError(
      message || (typeof data === 'string' && data ? data : `Request failed (${res.status})`),
      res.status,
      code,
      details,
    )
  }

  return data as T
}

export const api = {
  get: <T>(path: string, token?: string, opts?: Partial<ApiOptions>) =>
    request<T>(path, { method: 'GET', token, ...opts }),
  post: <T>(path: string, body?: unknown, token?: string, opts?: Partial<ApiOptions>) =>
    request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined, token, ...opts }),
  patch: <T>(path: string, body?: unknown, token?: string, opts?: Partial<ApiOptions>) =>
    request<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined, token, ...opts }),
  put: <T>(path: string, body?: unknown, token?: string, opts?: Partial<ApiOptions>) =>
    request<T>(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined, token, ...opts }),
  delete: <T>(path: string, token?: string, opts?: Partial<ApiOptions>) =>
    request<T>(path, { method: 'DELETE', token, ...opts }),
  postForm: <T>(path: string, body: FormData, token?: string, opts?: Partial<ApiOptions>) =>
    request<T>(path, { method: 'POST', body, token, ...opts }),
}

export type { ApiOptions }