# API Layer

All mobile HTTP requests use `src/api.ts`.

## `request<T>()` behavior

- Builds the URL from `EXPO_PUBLIC_API_URL`.
- Adds `Authorization: Bearer <access token>` when provided.
- Sends JSON and parses JSON responses.
- Applies a request timeout and maps network failures to `NetworkError`.
- Attempts access-token refresh on `401`, then retries once.
- Throws `ApiError` with the server status/message for non-success responses.

## Current endpoint groups

| Area | Examples |
|---|---|
| Auth | `/auth/register`, `/auth/login`, `/auth/refresh`, `/auth/verify-email` |
| Catalog | `/hotels`, `/hotels/:id`, `/hotels/:id/rooms`, availability/amenities |
| Customer bookings | `POST /bookings`, `GET /bookings/my`, `GET /bookings/:id`, `POST /bookings/:bookingId/cancel` |
| Booking actions | `/bookings/:id/status-history`, modifications, disputes, reviews |
| Chapa payments | `/payments/:bookingId/chapa-intent`, `/payments/:paymentId/verify-otp`, `/payments/:paymentId/bank-callback`, `/payments/:paymentId/status` |
| Notifications | `GET /notifications`, `POST /notifications/push-token`, `/notifications/:id/read` |
| Manager/staff | manager bookings, check-in/out, reports, walk-in bookings, hotel/room management |
| Admin | `/admin/hotels`, `/admin/users`, `/admin/bookings`, `/admin/payments`, reports, settings, audit logs |

Always verify the controller before adding a mobile endpoint. For example, customer bookings are listed with `/bookings/my`, and cancellation uses `POST`, not `PATCH`.

## Response shapes

Many list endpoints return `{ data, meta }`; detail and action endpoints may return the resource directly. Screens type the expected shape at the call site and must not assume every endpoint uses the same envelope.

## Push registration

After authentication, the app obtains an Expo token and calls:

```text
POST /notifications/push-token
Authorization: Bearer <access token>
{ "token": "ExponentPushToken[...]" }
```
