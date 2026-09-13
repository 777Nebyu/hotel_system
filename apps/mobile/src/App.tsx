import './i18n';
import React, { useEffect, useRef } from 'react';
import { AppState, AppStateStatus, BackHandler } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { ActivityIndicator, Platform, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Provider } from 'react-redux';
import { store } from './store';
import { useAppDispatch, useAppSelector } from './store/hooks';
import { restoreSession, loadSessionFromStorage, saveSessionToStorage, signOut } from './store/authSlice';
import { request, setAuthExpiredCallback, refreshAccessToken } from './api';
import { getStoredPushToken, deregisterPushToken } from './lib/notifications';
import { ToastProvider } from './components/Toast';
import OfflineBanner from './components/OfflineBanner';
import RootNavigator from './navigation/RootNavigator';
import { colors, darkColors } from './theme';
import { ThemeProvider, useTheme } from './hooks/useTheme';
import { useBiometricAuth } from './hooks/useBiometricAuth';
import type { LinkingOptions } from '@react-navigation/native';
import type { RootStackParamList } from './navigation/types';
import { navigationRef } from './lib/navigationRef';
import { ErrorBoundary } from './components/ErrorBoundary';
import { crashReporter } from './lib/crashReporting';

void crashReporter.init();

const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['yayetechhotel://', 'https://yayetech.com'],
  config: {
    screens: {
      VerifyEmail: 'verify/:token',
      ResetPassword: 'reset/:token',
      HotelDetail: 'hotel/:hotelId',
      BookingDetail: 'booking/:bookingId',
      MainTabs: {
        screens: {
          HomeTab: 'home',
          Search: 'search',
        },
      },
    },
  },
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 2, staleTime: 60 * 1000 },
  },
});

function isExpoGoClient(): boolean {
  return (
    Constants.appOwnership === 'expo' ||
    Constants.executionEnvironment === ExecutionEnvironment.StoreClient
  );
}

async function performSignOut() {
  try {
    const pushToken = await getStoredPushToken();
    if (pushToken) await deregisterPushToken(pushToken);
  } catch { /* ignore */ }
  await saveSessionToStorage(null);
  store.dispatch(signOut());
}

function SessionRestorer({ children }: { children: React.ReactNode }) {
  const dispatch = useAppDispatch();
  const isRestoring = useAppSelector((s) => s.auth.isRestoring);
  const session = useAppSelector((s) => s.auth.session);
  const { colorScheme } = useTheme();
  const bg = colorScheme === 'dark' ? darkColors.paper : colors.paper;
  const didRedirect = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        const session = await loadSessionFromStorage();
        dispatch(restoreSession(session));
      } catch {
        dispatch(restoreSession(null));
      }
    })();
  }, [dispatch]);

  // Role-based redirect after session restore (runs once)
  useEffect(() => {
    if (isRestoring || didRedirect.current) return;
    if (session?.user?.role && ['ADMIN', 'MANAGER', 'STAFF'].includes(session.user.role)) {
      didRedirect.current = true;
      const dest: Record<string, string> = {
        ADMIN: 'AdminOverview',
        MANAGER: 'ManagerOverview',
        STAFF: 'ManagerBookings',
      };
      const target = dest[session.user.role];
      if (target && navigationRef.current?.isReady()) {
        navigationRef.current.reset({ index: 0, routes: [{ name: target as any }] });
      }
    }
  }, [isRestoring, session]);

  if (isRestoring) {
    return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: bg }}><ActivityIndicator size="large" color={colors.teal} /></View>;
  }
  return <>{children}</>;
}

function NotificationHandler() {
  const session = useAppSelector((s) => s.auth.session);

  useEffect(() => {
    if (isExpoGoClient()) return;

    let isMounted = true;
    (async () => {
      try {
        const Notifications = await import('expo-notifications');
        Notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: false,
            shouldShowBanner: true,
            shouldShowList: true,
          }),
        });

        if (!session) return;

        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        if (existingStatus !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }
        if (finalStatus !== 'granted' || !isMounted) return;

        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('default', {
            name: 'default',
            importance: Notifications.AndroidImportance.HIGH,
          });
        }
        const token = await Notifications.getExpoPushTokenAsync();
        if (isMounted) {
          await request('/notifications/register', {
            method: 'POST',
            body: { token: token.data, platform: Platform.OS },
            token: session.accessToken,
          });
        }
      } catch { /* ignore */ }
    })();

    // Handle cold-start push notification tap
    (async () => {
      try {
        const Notifications = await import('expo-notifications');
        const response = await Notifications.getLastNotificationResponseAsync();
        if (response?.notification.request.content.data?.bookingId) {
          const bookingId = response.notification.request.content.data.bookingId as string;
          setTimeout(() => {
            navigationRef.current?.navigate('BookingDetail', { bookingId });
          }, 1000);
        }
      } catch { /* ignore */ }
    })();

    return () => {
      isMounted = false;
    };
  }, [session]);

  return null;
}

function AppStateAndBiometricHandler() {
  const session = useAppSelector((s) => s.auth.session);
  const dispatch = useAppDispatch();
  const { isAvailable, isEnabled, authenticate } = useBiometricAuth();
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextState: AppStateStatus) => {
      const wasBackground = appState.current.match(/inactive|background/);
      appState.current = nextState;

      if (wasBackground && nextState === 'active') {
        // 1. Biometric lock verification if enabled
        if (session && isAvailable && isEnabled) {
          const success = await authenticate('Unlock to continue');
          if (!success) {
            void performSignOut();
            return;
          }
        }

        // 2. Proactive token refresh when app comes to foreground
        if (session?.refreshToken) {
          try {
            await refreshAccessToken();
            const updated = await loadSessionFromStorage();
            if (updated) {
              dispatch(restoreSession(updated));
            }
          } catch {
            // Non-critical; 401 handler will intercept if expired on request
          }
        }
      }
    });

    return () => subscription.remove();
  }, [session, isAvailable, isEnabled, authenticate, dispatch]);

  return null;
}

function AppContent() {
  const { colorScheme } = useTheme();
  const navTheme = colorScheme === 'dark' ? DarkTheme : DefaultTheme;

  useEffect(() => {
    setAuthExpiredCallback(() => {
      void performSignOut();
    });
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (navigationRef.current?.isReady() && navigationRef.current.canGoBack()) {
        navigationRef.current.goBack();
        return true;
      }
      return true;
    });
    return () => sub.remove();
  }, []);

  return (
    <>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      <SessionRestorer>
        <NotificationHandler />
        <AppStateAndBiometricHandler />
        <OfflineBanner />
        <NavigationContainer ref={navigationRef} linking={linking} theme={navTheme}>
          <RootNavigator />
        </NavigationContainer>
      </SessionRestorer>
    </>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <Provider store={store}>
          <QueryClientProvider client={queryClient}>
            <ThemeProvider>
              <ToastProvider>
                <AppContent />
              </ToastProvider>
            </ThemeProvider>
          </QueryClientProvider>
        </Provider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
