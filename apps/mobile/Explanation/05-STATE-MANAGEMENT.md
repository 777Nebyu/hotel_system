# State Management

## Redux Toolkit (Global State)

### Store Setup

```typescript
// store/index.ts
import { configureStore } from '@reduxjs/toolkit';
import authReducer from './authSlice';
import bookingFlowReducer from './bookingFlowSlice';
import searchFiltersReducer from './searchFiltersSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    bookingFlow: bookingFlowReducer,
    searchFilters: searchFiltersReducer,
  },
});
```

### Slices

#### `authSlice.ts` — Authentication State
```typescript
interface AuthState {
  session: {
    accessToken: string;
    refreshToken: string;
    user: {
      id: string;
      email: string;
      fullName: string;
      role: 'GUEST' | 'MANAGER' | 'ADMIN';
    };
  } | null;
}

// Actions
saveSession(session)   // Store login data
clearSession()         // Logout
signOut()              // Full logout (clear storage + Redux)
```

**Usage in screens:**
```typescript
import { useAppSelector, useAppDispatch } from '../../store/hooks';

function MyScreen() {
  const token = useAppSelector((s) => s.auth.session?.accessToken ?? '');
  const user = useAppSelector((s) => s.auth.session?.user);
  const dispatch = useAppDispatch();

  // Use token for API calls
  const data = await request('/hotels', { token });

  // Logout
  dispatch(signOut());
}
```

#### `bookingFlowSlice.ts` — Multi-Step Booking Wizard
```typescript
interface BookingFlowState {
  hotelId: string | null;
  roomId: string | null;
  checkIn: string | null;
  checkOut: string | null;
  guests: number;
  step: 'dates' | 'room' | 'payment' | 'confirm';
}

// Actions
setHotel(hotelId)
setRoom(roomId, price)
setDates(checkIn, checkOut)
setGuests(count)
setStep(step)
resetFlow()
```

#### `searchFiltersSlice.ts` — Hotel Search
```typescript
interface SearchFiltersState {
  query: string;
  checkIn: string | null;
  checkOut: string | null;
  minPrice: number;
  maxPrice: number;
  starRating: number;
  amenities: string[];
}

// Actions
setFilters(filters)
clearFilters()
```

### Hooks

```typescript
// store/hooks.ts
import { useSelector, useDispatch } from 'react-redux';
import type { RootState, AppDispatch } from './index';

export const useAppSelector = useSelector.withTypes<RootState>();
export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
```

## React Query (Server State)

Used in some screens for data fetching with automatic caching:

```typescript
import { useQueries } from '../../hooks/useQueries';

// Parallel queries
const [hotels, bookings] = useQueries([
  { key: ['hotels'], fn: () => request('/hotels', { token }) },
  { key: ['bookings'], fn: () => request('/bookings', { token }) },
]);
```

## When to Use What

| Use Case | Solution |
|----------|----------|
| User session / auth | Redux (`authSlice`) |
| Multi-step booking wizard | Redux (`bookingFlowSlice`) |
| Search filters | Redux (`searchFiltersSlice`) |
| API data (hotels, bookings, etc.) | Direct `request()` + `useState`/`useCallback` |
| Complex data dependencies | React Query |
| Offline cache | `offlineCache.ts` |
