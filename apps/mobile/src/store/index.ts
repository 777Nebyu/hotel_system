import { configureStore } from '@reduxjs/toolkit';
import AsyncStorage from '@react-native-async-storage/async-storage';
import authReducer from './authSlice';
import searchFiltersReducer from './searchFiltersSlice';
import bookingFlowReducer, { hydrateBookingFlow } from './bookingFlowSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    searchFilters: searchFiltersReducer,
    bookingFlow: bookingFlowReducer,
  },
});

// ─── Booking draft persistence ──────────────────────────────────────────────
// Keeps guest details / step progress alive across app kills so a checkout
// started before a crash (or an offline drop) can be resumed instead of lost.

export const BOOKING_DRAFT_KEY = 'luxsty.bookingFlow.draft';

export async function restoreBookingDraft(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(BOOKING_DRAFT_KEY);
    if (!raw) return;
    const draft = JSON.parse(raw) as { hotelId?: string | null; currentStep?: string };
    if (!draft?.hotelId || draft.currentStep === 'done') {
      await AsyncStorage.removeItem(BOOKING_DRAFT_KEY);
      return;
    }
    // Never clobber a booking the user has already started this session.
    if (store.getState().bookingFlow.hotelId) return;
    store.dispatch(hydrateBookingFlow(draft as never));
  } catch { /* ignore corrupt drafts */ }
}

export async function saveBookingDraft(state: unknown): Promise<void> {
  try {
    const s = state as { hotelId?: string | null };
    if (s?.hotelId) {
      await AsyncStorage.setItem(BOOKING_DRAFT_KEY, JSON.stringify(state));
    } else {
      await AsyncStorage.removeItem(BOOKING_DRAFT_KEY);
    }
  } catch { /* ignore quota/serialization errors */ }
}

// Best-effort restore on startup; BookingFlowScreen re-validates on entry.
void restoreBookingDraft();

let draftSaveTimer: ReturnType<typeof setTimeout> | null = null;
store.subscribe(() => {
  if (draftSaveTimer) clearTimeout(draftSaveTimer);
  draftSaveTimer = setTimeout(() => {
    void saveBookingDraft(store.getState().bookingFlow);
  }, 400);
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
