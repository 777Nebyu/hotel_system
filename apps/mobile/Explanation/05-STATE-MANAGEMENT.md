# State Management

## Redux Toolkit

Redux stores client state that must survive screen changes:

- `authSlice` — session, user, access/refresh tokens, restore state.
- `bookingFlowSlice` — customer booking wizard dates, guests, room, payment method, quote, and current step.
- `searchFiltersSlice` — catalog search and filter selections.

The role type is `CUSTOMER | STAFF | MANAGER | ADMIN`; `GUEST` is not a runtime role.

## React Query

`src/hooks/useQueries.ts` provides cached server queries such as notifications, unread counts, hotels, and bookings. Screens that need specialized data may still use `request()` with `useState`/`useCallback`.

## Local component state

Loading, error, modal, form, and screen-only UI state stays in the screen component. Server data should not be copied into Redux unless it is part of an active client workflow.

## Booking flow

The current booking steps are:

```text
dates → guests → payment → review → done
```

Payment-specific navigation then continues through Chapa Checkout, Telebirr OTP or Bank Auth, and Payment Result screens as needed.

## Persistence

Sessions and the registered push token use Expo SecureStore. Redux is restored on startup by `SessionRestorer`; logout clears the stored session and deregisters the local token where supported.
