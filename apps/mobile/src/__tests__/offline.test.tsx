import React from 'react';
import { render, screen, act } from '@testing-library/react-native';
import { renderHook } from '@testing-library/react-native';
import NetInfo from '@react-native-community/netinfo';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import OfflineBanner from '../components/OfflineBanner';
import { setServingCachedData } from '../store/cacheStatus';

const netInfoMock = NetInfo as unknown as {
  __setNetInfoState: (s: unknown) => void;
};

describe('useNetworkStatus', () => {
  afterEach(() => {
    act(() => netInfoMock.__setNetInfoState({ isConnected: true, isInternetReachable: true, type: 'wifi', details: null }));
  });

  it('reports online when connected and reachable', () => {
    act(() => netInfoMock.__setNetInfoState({ isConnected: true, isInternetReachable: true, type: 'wifi', details: null }));
    const { result } = renderHook(() => useNetworkStatus());
    expect(result.current.isOffline).toBe(false);
  });

  it('reports offline when not connected', () => {
    act(() => netInfoMock.__setNetInfoState({ isConnected: false, isInternetReachable: false, type: 'none', details: null }));
    const { result } = renderHook(() => useNetworkStatus());
    expect(result.current.isOffline).toBe(true);
  });

  it('reports offline when connected but internet unreachable', () => {
    act(() => netInfoMock.__setNetInfoState({ isConnected: true, isInternetReachable: false, type: 'wifi', details: null }));
    const { result } = renderHook(() => useNetworkStatus());
    expect(result.current.isOffline).toBe(true);
  });

  it('updates when connectivity changes after mount', () => {
    act(() => netInfoMock.__setNetInfoState({ isConnected: true, isInternetReachable: true, type: 'wifi', details: null }));
    const { result } = renderHook(() => useNetworkStatus());
    expect(result.current.isOffline).toBe(false);
    act(() => netInfoMock.__setNetInfoState({ isConnected: false, isInternetReachable: false, type: 'none', details: null }));
    expect(result.current.isOffline).toBe(true);
  });
});

describe('OfflineBanner', () => {
  afterEach(() => {
    act(() => setServingCachedData(false));
    act(() => netInfoMock.__setNetInfoState({ isConnected: true, isInternetReachable: true, type: 'wifi', details: null }));
  });

  it('renders nothing when online with fresh data', () => {
    act(() => netInfoMock.__setNetInfoState({ isConnected: true, isInternetReachable: true, type: 'wifi', details: null }));
    const { toJSON } = render(<OfflineBanner />);
    expect(toJSON()).toBeNull();
  });

  it('shows the offline notice when connectivity drops', () => {
    act(() => netInfoMock.__setNetInfoState({ isConnected: false, isInternetReachable: false, type: 'none', details: null }));
    render(<OfflineBanner />);
    expect(screen.getByText(/offline/i)).toBeTruthy();
  });

  it('adds a saved-data note when cached data is being served offline', () => {
    act(() => netInfoMock.__setNetInfoState({ isConnected: false, isInternetReachable: false, type: 'none', details: null }));
    act(() => setServingCachedData(true));
    render(<OfflineBanner />);
    expect(screen.getByText(/offline/i)).toBeTruthy();
    expect(screen.getByText(/saved data/i)).toBeTruthy();
  });

  it('shows a stale-data notice when online but serving the cache', () => {
    act(() => netInfoMock.__setNetInfoState({ isConnected: true, isInternetReachable: true, type: 'wifi', details: null }));
    act(() => setServingCachedData(true));
    render(<OfflineBanner />);
    expect(screen.getByText(/saved data/i)).toBeTruthy();
    expect(screen.queryByText(/offline/i)).toBeNull();
  });
});
