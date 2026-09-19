# Architecture & Data Flow

## Provider hierarchy

`App.tsx` composes the app as:

```text
ErrorBoundary
└── SafeAreaProvider
    └── Redux Provider
        └── QueryClientProvider
            └── ThemeProvider
                └── ToastProvider
                    └── SessionRestorer
                        ├── NotificationHandler
                        ├── AppStateAndBiometricHandler
                        ├── OfflineBanner
                        └── NavigationContainer → RootNavigator
```

## Data flow

Screens read the authenticated session from Redux, call `request()` from `src/api.ts`, and keep screen-specific server data in local state or React Query hooks. Booking form state is stored in `bookingFlowSlice`; search filters are stored in `searchFiltersSlice`.

```text
Screen
  ↓
request(path, options)
  ↓
API_URL + JWT + timeout/refresh handling
  ↓
NestJS API
```

## Authentication

1. `AuthScreen` calls `/auth/login` or `/auth/register`.
2. The session is saved to SecureStore and Redux.
3. `SessionRestorer` restores the session when the app starts.
4. `AuthGuard` protects authenticated screens.
5. `RoleGuard` limits staff, manager, customer, and admin routes.

## Role routing

There are no separate `GuestTabs`, `ManagerTabs`, or `AdminTabs` components. `MainTabs` is the customer-facing bottom navigator. Manager, staff, and admin tools are root-stack screens wrapped with `AuthGuard` and `RoleGuard`.

## Push notifications

`NotificationHandler` registers the authenticated Expo token with `/notifications/push-token`, listens for foreground taps, handles cold-start taps, and routes booking alerts to the correct customer or hotel-operations screen.
