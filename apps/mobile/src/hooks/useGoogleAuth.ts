import { useState, useCallback } from 'react';
import { Platform } from 'react-native';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { request as apiRequest } from '../api';
import type { Session } from '../store/authSlice';
import {
  GoogleAuthError,
  OAUTH_SCHEME,
  assertIdTokenNonce,
  extractIdToken,
  generateNonce,
} from '../lib/oauth';

WebBrowser.maybeCompleteAuthSession();

const discovery = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
};

type GooglePromptResult =
  | { type: 'success'; idToken: string }
  | { type: 'cancel' };

let nativeGoogleConfigured = false;

async function promptNativeGoogle(clientId: string): Promise<GooglePromptResult> {
  if (!clientId) {
    throw new GoogleAuthError('googleConfig', 'Google sign-in is not configured for this build.');
  }

  // This module contains native code and is intentionally loaded only on a
  // native build. Expo Go cannot provide the Android package/SHA-1 identity.
  const { GoogleSignin, statusCodes } = await import('@react-native-google-signin/google-signin');
  if (!nativeGoogleConfigured) {
    // webClientId is the audience of the ID token sent to our API. Android
    // package/SHA-1 verification is handled by Google Play Services.
    GoogleSignin.configure({ webClientId: clientId });
    nativeGoogleConfigured = true;
  }

  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const result = await GoogleSignin.signIn();
    if (result.type !== 'success' || !result.data.idToken) return { type: 'cancel' };
    return { type: 'success', idToken: result.data.idToken };
  } catch (error: any) {
    if (error?.code === statusCodes.SIGN_IN_CANCELLED) return { type: 'cancel' };
    if (error?.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
      throw new GoogleAuthError('googleProviderError', 'Google Play Services is unavailable or needs an update.');
    }
    if (error?.code === 'MODULE_NOT_FOUND' || /native module|TurboModule|Expo Go/i.test(String(error?.message ?? ''))) {
      throw new GoogleAuthError(
        'googleConfig',
        'Google sign-in requires the LuxSty Android development build, not Expo Go.',
      );
    }
    throw new GoogleAuthError(
      'googleProviderError',
      error?.message || 'Google sign-in was denied.',
    );
  }
}

async function promptWebGoogle(clientId: string, redirectUri: string): Promise<GooglePromptResult> {
  if (!clientId) {
    throw new GoogleAuthError('googleConfig', 'Google sign-in is not configured for this build.');
  }

  const nonce = generateNonce();
  const req = new AuthSession.AuthRequest({
    clientId,
    redirectUri,
    responseType: AuthSession.ResponseType.IdToken,
    scopes: ['openid', 'profile', 'email'],
    usePKCE: false,
    extraParams: { nonce },
  });
  const result = await req.promptAsync(discovery);
  if (result.type === 'error') {
    if (result.error?.code === 'state_mismatch') {
      throw new GoogleAuthError('googleStateMismatch', 'Google sign-in could not be verified.');
    }
    throw new GoogleAuthError(
      'googleProviderError',
      result.error?.description ?? 'Google sign-in was denied.',
    );
  }
  if (result.type !== 'success') return { type: 'cancel' };

  const idToken = extractIdToken(result);
  if (!idToken) {
    throw new GoogleAuthError('googleProviderError', 'Google did not return a sign-in token.');
  }
  assertIdTokenNonce(idToken, nonce);
  return { type: 'success', idToken };
}

export function useGoogleAuth() {
  const [loading, setLoading] = useState(false);

  const redirectUri = AuthSession.makeRedirectUri({
    scheme: OAUTH_SCHEME,
    path: 'google-auth',
  });
  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '';

  const promptAsync = useCallback(async (): Promise<GooglePromptResult> => {
    if (Platform.OS !== 'web') return promptNativeGoogle(webClientId);
    return promptWebGoogle(webClientId, redirectUri);
  }, [redirectUri, webClientId]);

  const handleGoogleAuth = useCallback(async (idToken: string): Promise<Session & { mfaRequired?: boolean; challengeToken?: string }> => {
    const session = await apiRequest<Session & { mfaRequired?: boolean; challengeToken?: string }>('/auth/google', {
      method: 'POST',
      body: { credential: idToken },
    });
    return session;
  }, []);

  return { promptAsync, handleGoogleAuth, loading, setLoading };
}
