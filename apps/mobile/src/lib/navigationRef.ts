import { createRef } from 'react';
import type { NavigationContainerRef } from '@react-navigation/native';
import type { RootStackParamList } from '../navigation/types';

/**
 * A module-level navigation ref that can be used to navigate imperatively
 * outside of React components (e.g. cold-start push notification handlers,
 * background tasks, and RootNavigator helpers).
 *
 * Attach this to <NavigationContainer ref={navigationRef}> in App.tsx.
 */
export const navigationRef = createRef<NavigationContainerRef<RootStackParamList>>();
