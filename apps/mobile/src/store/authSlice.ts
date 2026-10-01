import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import * as SecureStore from '../lib/secureStorage';
import type { User, UserRole } from '../types';
import { clearAllCache } from './offlineCache';

export type Session = { accessToken: string; refreshToken: string; user: User };

interface AuthState {
  session: Session | null;
  isRestoring: boolean;
  lastRole?: UserRole | null;
}

const SESSION_KEY = 'luxsty.hotel.session';

const initialState: AuthState = { session: null, isRestoring: true, lastRole: null };

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setSession(state, action: PayloadAction<Session | null>) {
      state.session = action.payload;
      if (action.payload?.user?.role) state.lastRole = action.payload.user.role;
      state.isRestoring = false;
    },
    restoreSession(state, action: PayloadAction<Session | null>) {
      state.session = action.payload;
      if (action.payload?.user?.role) state.lastRole = action.payload.user.role;
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
  else {
    await SecureStore.deleteItemAsync(SESSION_KEY);
    await clearAllCache();
  }
};

export const loadSessionFromStorage = async (): Promise<Session | null> => {
  const stored = await SecureStore.getItemAsync(SESSION_KEY);
  if (!stored) return null;
  try { return JSON.parse(stored) as Session; } catch { return null; }
};
