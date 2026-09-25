import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from './secureStorage';

const BIOMETRIC_KEY = 'luxsty.biometric.enabled';
const REFRESH_TOKEN_KEY = 'luxsty.biometric.refreshToken';
const LEGACY_CREDENTIALS_KEY = 'luxsty.biometric.credentials';

export async function isBiometricAvailable(): Promise<boolean> {
  const compatible = await LocalAuthentication.hasHardwareAsync();
  const enrolled = await LocalAuthentication.isEnrolledAsync();
  return compatible && enrolled;
}

export async function authenticateWithBiometrics(promptMessage = 'Authenticate to continue'): Promise<boolean> {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage,
    cancelLabel: 'Use password',
    disableDeviceFallback: false,
  });
  return result.success;
}

export async function isBiometricEnabled(): Promise<boolean> {
  try {
    const val = await SecureStore.getItemAsync(BIOMETRIC_KEY);
    return val === 'true';
  } catch {
    return false;
  }
}

export async function enableBiometric(refreshToken: string): Promise<boolean> {
  const available = await isBiometricAvailable();
  if (!available) return false;

  const authenticated = await authenticateWithBiometrics('Verify your identity to enable biometrics');
  if (!authenticated) return false;

  await SecureStore.setItemAsync(BIOMETRIC_KEY, 'true');
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
  // Clean up any insecure legacy credential storage
  await SecureStore.deleteItemAsync(LEGACY_CREDENTIALS_KEY).catch(() => {});
  return true;
}

export async function disableBiometric(): Promise<void> {
  await SecureStore.deleteItemAsync(BIOMETRIC_KEY);
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
  await SecureStore.deleteItemAsync(LEGACY_CREDENTIALS_KEY).catch(() => {});
}

export async function getStoredRefreshToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
  } catch {
    return null;
  }
}
