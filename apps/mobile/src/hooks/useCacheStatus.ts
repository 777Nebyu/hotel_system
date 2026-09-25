import { useSyncExternalStore } from 'react';
import { getServingCachedData, subscribeServingCachedData } from '../store/cacheStatus';

/** True when the last successful read came from the offline cache rather than the network. */
export function useServingCachedData(): boolean {
  return useSyncExternalStore(subscribeServingCachedData, getServingCachedData, getServingCachedData);
}
