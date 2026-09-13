# Architecture & Data Flow

## Provider Hierarchy

The app wraps all screens in a provider tree (in `App.tsx`):

```
ReduxProvider (store)
  └─ ThemeProvider (light/dark mode)
      └─ ToastProvider (toast notifications)
          └─ NavigationContainer
              └─ RootNavigator (auth check → role-based routing)
```

## Data Flow

```
User Action
    ↓
Screen Component (React)
    ↓
Redux Dispatch (auth state, booking flow)
    ↓
API Request (api.ts → fetch)
    ↓
NestJS Backend (port 3001)
    ↓
PostgreSQL Database
    ↓
Response → Screen re-renders
```

## API Layer (`src/api.ts`)

All HTTP requests go through a central `request()` function that handles:

1. **Base URL** — Reads from `EXPO_PUBLIC_API_URL` env var
2. **Auth headers** — Automatically attaches `Bearer <token>`
3. **Token refresh** — On 401, refreshes the JWT and retries once
4. **Error handling** — Converts HTTP errors to typed `ApiError` objects
5. **Timeout** — 15-second abort timeout
6. **Network detection** — Shows friendly error when offline

```typescript
// Usage in any screen:
import { request } from '../../api';

const data = await request<Hotel[]>('/hotels', { method: 'GET', token });
```

## State Management

### Redux Toolkit (global state)
- `authSlice` — User session, tokens, role
- `bookingFlowSlice` — Multi-step booking wizard state
- `searchFiltersSlice` — Hotel search parameters
- `offlineCache` — Cached data for offline use

### React Query (server state)
- Used in some screens for data fetching with caching
- `useQueries` hook for parallel queries

## Authentication Flow

```
1. User enters email + password
2. POST /auth/login → { accessToken, refreshToken, user }
3. Tokens stored in Expo SecureStore
4. Redux dispatches saveSession()
5. RootNavigator detects auth → routes to MainTabs
6. On app restart: check SecureStore for existing session
```

## Role-Based Routing

```
RootNavigator
  ├─ No auth → AuthScreen (login/register)
  ├─ ADMIN → AdminTabs (overview, bookings, hotels, users, ...)
  ├─ MANAGER → ManagerTabs (overview, bookings, rooms, ...)
  └─ GUEST → GuestTabs (home, search, bookings, profile)
```
