import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import * as SecureStore from 'expo-secure-store';
import type { User } from '../types';

export type Session = { accessToken: string; refreshToken: string; user: User };

interface AuthState {
  session: Session | null;
  isRestoring: boolean;
}

const SESSION_KEY = 'yayetech.hotel.session';

const initialState: AuthState = { session: null, isRestoring: true };

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setSession(state, action: PayloadAction<Session | null>) {
      state.session = action.payload;
      state.isRestoring = false;
    },
    restoreSession(state, action: PayloadAction<Session | null>) {
      state.session = action.payload;
      state.isRestoring = false;
    },
    updateUser(state, action: PayloadAction<Partial<User>>) {
      if (state.session) {
        state.session.user = { ...state.session.user, ...action.payload };
      }
    },
    signOut(state) {
      state.session = null;
      state.isRestoring = false;
    },
  },
});

export const { setSession, restoreSession, updateUser, signOut } = authSlice.actions;
export default authSlice.reducer;

export const saveSessionToStorage = async (session: Session | null) => {
  if (session) await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
  else await SecureStore.deleteItemAsync(SESSION_KEY);
};

export const loadSessionFromStorage = async (): Promise<Session | null> => {
  const stored = await SecureStore.getItemAsync(SESSION_KEY);
  if (!stored) return null;
  try { return JSON.parse(stored) as Session; } catch { return null; }
};
