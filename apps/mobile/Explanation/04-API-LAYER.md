# API Layer

## File

`src/api.ts` — The single HTTP client for all backend communication.

## How It Works

Every API call goes through `request<T>()`:

```typescript
import { request } from '../../api';

// GET request
const hotels = await request<Hotel[]>('/hotels', { method: 'GET', token });

// POST request
const booking = await request<Booking>('/bookings', {
  method: 'POST',
  body: { hotelId, roomId, checkIn, checkOut },
  token,
});

// PUT request
await request(`/admin/settings/commissionRate`, {
  method: 'PUT',
  body: { value: { rate: 10 } },
  token,
});
```

## Features

### 1. Automatic Auth Headers
```typescript
// Token is automatically added as Authorization: Bearer <token>
request('/hotels', { token: 'eyJ...' });
// Sends: Authorization: Bearer eyJ...
```

### 2. Token Refresh on 401
```
Request → 401 Unauthorized
  → Refresh token sent to /auth/refresh
  → New access token received
  → Original request retried with new token
  → If refresh fails → User logged out
```

### 3. Error Handling
```typescript
try {
  await request('/hotels');
} catch (err) {
  if (err instanceof ApiError) {
    console.log(err.status);   // 400, 401, 404, 500...
    console.log(err.message);  // "Hotel not found"
  }
  if (err instanceof NetworkError) {
    console.log(err.message);  // "Cannot reach server..."
  }
}
```

### 4. Timeout
- Default: 15 seconds
- Aborts request if server doesn't respond

### 5. Offline Detection
- Checks network status before request
- Shows `NetworkError` with friendly message if offline

## API Base URL

Read from environment variable:
```typescript
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001';
```

## Available Endpoints

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/register` | Register new user |
| POST | `/auth/login` | Login |
| POST | `/auth/logout` | Logout |
| POST | `/auth/refresh` | Refresh access token |
| POST | `/auth/forgot-password` | Request password reset |
| POST | `/auth/reset-password` | Reset password |
| POST | `/auth/verify-email` | Verify email |

### Hotels
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/hotels` | List hotels |
| GET | `/hotels/:id` | Get hotel details |
| GET | `/hotels/:id/rooms` | Get hotel rooms |

### Bookings
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/bookings` | Create booking |
| GET | `/bookings` | List my bookings |
| GET | `/bookings/:id` | Get booking details |
| PATCH | `/bookings/:id/cancel` | Cancel booking |

### Admin
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/hotels` | List all hotels |
| GET | `/admin/users` | List all users |
| GET | `/admin/bookings` | List all bookings |
| GET | `/admin/payments` | List all payments |
| GET | `/admin/settings` | Get platform settings |
| PUT | `/admin/settings/:key` | Update setting |
| GET | `/admin/reports/overview` | Dashboard data |
| GET | `/admin/audit-logs` | Audit trail |

### Disputes
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/disputes` | List disputes |
| POST | `/disputes` | Create dispute |
| PATCH | `/disputes/:id/resolve` | Resolve dispute |
| PATCH | `/disputes/:id/assign` | Assign dispute |

## Request/Response Types

All shared types are in `@repo/shared-types` (monorepo package):

```typescript
import type { Hotel, Booking, User, UpsertSetting } from '@repo/shared-types';
```
