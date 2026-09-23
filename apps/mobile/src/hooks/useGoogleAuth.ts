import { useState, useCallback } from 'react';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { request as apiRequest } from '../api';
import type { Session } from '../store/authSlice';

WebBrowser.maybeCompleteAuthSession();

const discovery = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
};

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function useGoogleAuth() {
  const [loading, setLoading] = useState(false);

  const redirectUri = AuthSession.makeRedirectUri({
    scheme: 'luxsty',
    path: 'google-auth',
  });

  const clientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '';

  const promptAsync = useCallback(async (): Promise<AuthSession.AuthSessionResult | null> => {
    try {
      const req = new AuthSession.AuthRequest({
        clientId,
        redirectUri,
        responseType: AuthSession.ResponseType.IdToken,
        scopes: ['openid', 'profile', 'email'],
        usePKCE: false,
        extraParams: {
          nonce: generateUUID(),
        },
      });

      const result = await req.promptAsync(discovery);
      return result;
    } catch {
      return null;
    }
  }, [clientId, redirectUri]);

  const handleGoogleAuth = useCallback(async (idToken: string): Promise<Session> => {
    const session = await apiRequest<Session>('/auth/google', {
      method: 'POST',
      body: { credential: idToken },
    });
    return session;
  }, []);

  return { promptAsync, handleGoogleAuth, loading, setLoading };
}
