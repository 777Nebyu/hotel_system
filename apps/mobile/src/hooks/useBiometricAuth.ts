import { useState, useEffect, useCallback } from 'react';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

const BIOMETRIC_ENABLED_KEY = 'useBiometrics';

export function useBiometricAuth() {
  const [isAvailable, setIsAvailable] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  useEffect(() => {
    (async () => {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      setIsAvailable(compatible);
      const stored = await SecureStore.getItemAsync(BIOMETRIC_ENABLED_KEY);
      setIsEnabled(stored === 'true');
    })();
  }, []);

  const authenticate = useCallback(async (promptMessage = 'Unlock with biometrics'): Promise<boolean> => {
    if (!isAvailable || !isEnabled) return false;
    setIsAuthenticating(true);
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage,
        cancelLabel: 'Use password',
        disableDeviceFallback: false,
      });
      return result.success;
    } finally {
      setIsAuthenticating(false);
    }
  }, [isAvailable, isEnabled]);

  const enable = useCallback(async (): Promise<boolean> => {
    if (!isAvailable) return false;
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Verify your identity to enable biometrics',
      cancelLabel: 'Cancel',
    });
    if (result.success) {
      await SecureStore.setItemAsync(BIOMETRIC_ENABLED_KEY, 'true');
      setIsEnabled(true);
      return true;
    }
    return false;
  }, [isAvailable]);

  const disable = useCallback(async () => {
    await SecureStore.deleteItemAsync(BIOMETRIC_ENABLED_KEY);
    setIsEnabled(false);
  }, []);

  return { isAvailable, isEnabled, isAuthenticating, authenticate, enable, disable };
}
