import { configureStore } from '@reduxjs/toolkit';
import authReducer from './authSlice';
import searchFiltersReducer from './searchFiltersSlice';
import bookingFlowReducer from './bookingFlowSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    searchFilters: searchFiltersReducer,
    bookingFlow: bookingFlowReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
