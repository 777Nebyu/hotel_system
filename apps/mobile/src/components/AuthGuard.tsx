import React, { useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { useAppSelector } from '../store/hooks';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const navigation = useNavigation<Nav>();
  const session = useAppSelector((s) => s.auth.session);
  const lastRole = useAppSelector((s) => s.auth.lastRole);
  const isAuthenticated = !!session?.accessToken;
  // SESSION-002: Deactivated accounts lose access immediately
  const isActive = session?.user?.isActive !== false;

  useEffect(() => {
    if (!isAuthenticated || !isActive) {
      const portalByRole: Record<string, 'Auth' | 'StaffAuth' | 'AdminAuth'> = {
        ADMIN: 'AdminAuth',
        MANAGER: 'StaffAuth',
        STAFF: 'StaffAuth',
      };
      const authRoute = portalByRole[lastRole ?? ''] ?? 'Auth';
      navigation.reset({
        index: 0,
        routes: authRoute === 'Auth'
          ? [{ name: 'Auth', params: { initialMode: 'login' } }]
          : [{ name: authRoute, params: { initialMode: 'login' } }],
      });
    }
  }, [isAuthenticated, isActive, lastRole, navigation]);

  if (!isAuthenticated || !isActive) {
    return null;
  }

  return <>{children}</>;
}
