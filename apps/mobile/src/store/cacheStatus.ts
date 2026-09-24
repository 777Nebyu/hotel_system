let servingCachedData = false;
const listeners = new Set<(value: boolean) => void>();

/** Called by cachedFetch when a response was served from AsyncStorage instead of the network. */
export function setServingCachedData(value: boolean): void {
  if (servingCachedData === value) return;
  servingCachedData = value;
  listeners.forEach((listener) => listener(value));
}

export function getServingCachedData(): boolean {
  return servingCachedData;
}

export function subscribeServingCachedData(listener: (value: boolean) => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
