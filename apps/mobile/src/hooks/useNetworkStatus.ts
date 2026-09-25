import { useState, useEffect } from 'react';
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';

interface NetworkState {
  isConnected: boolean | null;
  isInternetReachable: boolean | null;
}

export function useNetworkStatus() {
  // Unknown until NetInfo reports — never assume online, otherwise the first
  // frames in airplane mode render the "online" UI.
  const [state, setState] = useState<NetworkState>({ isConnected: null, isInternetReachable: null });

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((info: NetInfoState) => {
      setState({
        isConnected: info.isConnected,
        isInternetReachable: info.isInternetReachable,
      });
    });
    void NetInfo.fetch().then((info) => {
      setState((prev) =>
        prev.isConnected === null
          ? { isConnected: info.isConnected, isInternetReachable: info.isInternetReachable }
          : prev,
      );
    }).catch(() => { /* keep unknown */ });
    return () => unsubscribe();
  }, []);

  return {
    isConnected: state.isConnected,
    isInternetReachable: state.isInternetReachable,
    isOffline: state.isConnected === false || state.isInternetReachable === false,
  };
}
