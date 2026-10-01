export interface CachedValue<T> {
  value: T
  savedAt: number
}

const PREFIX = 'hotel-system:web-cache:'

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

export function getCacheScope() {
  if (!canUseStorage()) return 'anonymous'
  try {
    const raw = window.localStorage.getItem('yayetech.session') || window.localStorage.getItem('luxstay.session')
    if (!raw) return 'anonymous'
    const session = JSON.parse(raw) as { user?: { id?: string; email?: string } }
    return session.user?.id || session.user?.email || 'anonymous'
  } catch {
    return 'anonymous'
  }
}

export function readCachedValue<T>(key: string): CachedValue<T> | null {
  if (!canUseStorage()) return null

  try {
    const raw = window.localStorage.getItem(PREFIX + key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CachedValue<T>
    if (!parsed || typeof parsed.savedAt !== 'number' || !('value' in parsed)) return null
    return parsed
  } catch {
    return null
  }
}

export function writeCachedValue<T>(key: string, value: T) {
  if (!canUseStorage()) return

  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify({ value, savedAt: Date.now() }))
  } catch {
    // Storage can be unavailable or full; the network response remains authoritative.
  }
}

export function formatCacheAge(savedAt: number) {
  const ageMinutes = Math.max(0, Math.floor((Date.now() - savedAt) / 60000))
  if (ageMinutes < 1) return 'just now'
  if (ageMinutes < 60) return `${ageMinutes} min ago`
  const ageHours = Math.floor(ageMinutes / 60)
  if (ageHours < 24) return `${ageHours} hr ago`
  return `${Math.floor(ageHours / 24)} days ago`
}
