import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_PREFIX = 'cache:';
const DEFAULT_MAX_AGE = 30 * 60 * 1000; // 30 minutes

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

export async function cacheQuery<T>(key: string, data: T): Promise<void> {
  const entry: CacheEntry<T> = { data, timestamp: Date.now() };
  await AsyncStorage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify(entry));
}

export async function getCachedQuery<T>(key: string, maxAge = DEFAULT_MAX_AGE): Promise<T | null> {
  const raw = await AsyncStorage.getItem(`${CACHE_PREFIX}${key}`);
  if (!raw) return null;
  let entry: CacheEntry<T>;
  try {
    entry = JSON.parse(raw) as CacheEntry<T>;
  } catch {
    await AsyncStorage.removeItem(`${CACHE_PREFIX}${key}`);
    return null;
  }
  if (Date.now() - entry.timestamp > maxAge) return null;
  return entry.data;
}

export async function invalidateCache(key: string): Promise<void> {
  await AsyncStorage.removeItem(`${CACHE_PREFIX}${key}`);
}

export async function clearAllCache(): Promise<void> {
  const keys = await AsyncStorage.getAllKeys();
  const cacheKeys = keys.filter(k => k.startsWith(CACHE_PREFIX));
  await AsyncStorage.multiRemove(cacheKeys);
}

export const clearOfflineCache = clearAllCache;
