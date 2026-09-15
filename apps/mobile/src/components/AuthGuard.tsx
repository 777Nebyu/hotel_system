import React, { useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { useAppSelector } from '../store/hooks';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const navigation = useNavigation<Nav>();
  const session = useAppSelector((s) => s.auth.session);
  const isAuthenticated = !!session?.accessToken;
  // SESSION-002: Deactivated accounts lose access immediately
  const isActive = session?.user?.isActive !== false;

  useEffect(() => {
    if (!isAuthenticated || !isActive) {
      navigation.reset({
        index: 0,
        routes: [{ name: 'Auth', params: { initialMode: 'login' } }],
      });
    }
  }, [isAuthenticated, isActive, navigation]);

  if (!isAuthenticated || !isActive) {
    return null;
  }

  return <>{children}</>;
}
