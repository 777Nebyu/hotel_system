# Setup & Configuration

## Prerequisites

- **Node.js** 18+ (check with `node --version`)
- **pnpm** (package manager)
- **Expo CLI** (`npm install -g expo-cli`)
- **Android Studio** (for Android emulator) or **Xcode** (for iOS simulator)
- **Docker** (for database and Redis)

## Quick Start

### 1. Start Backend Services

```bash
cd hotel_system

# Start PostgreSQL and Redis
docker compose up -d

# Verify they're running
docker ps
# Should show: hotel_system-postgres-1 (port 5434)
#              hotel_system-redis-1 (port 6379)
```

### 2. Start API Server

```bash
cd apps/api

# Install dependencies (if not done)
pnpm install

# Build
pnpm run build

# Start
node dist/src/main.js
```

Verify: `curl http://localhost:3001/health` should return `{"status":"ok"}`

### 3. Start Mobile App

```bash
cd apps/mobile

# Install dependencies (if not done)
pnpm install

# Start Expo
pnpm start
```

### 4. Connect from Phone

1. Find your computer's WiFi IP:
   ```bash
   ip addr show | grep 'inet '
   # Look for: inet 192.168.x.x/24
   ```

2. Update `.env`:
   ```
   EXPO_PUBLIC_API_URL=http://YOUR_IP:3001
   ```

3. Scan QR code with Expo Go app (Android) or Camera (iOS)

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `EXPO_PUBLIC_API_URL` | Backend API URL | `http://192.168.1.12:3001` |
| `EXPO_PUBLIC_MOCK_PAYMENT_SECRET` | Payment processing secret | `c0d95ce...` |

## Project Configuration

### `app.json` — Expo Config
```json
{
  "expo": {
    "name": "YayeTech Hotel",
    "slug": "yayetech-hotel",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "splash": { "image": "./assets/splash.png" },
    "plugins": ["expo-secure-store", "expo-notifications"]
  }
}
```

### `tsconfig.json` — TypeScript
```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  }
}
```

### `eas.json` — Build Profiles
```json
{
  "profiles": {
    "development": { "developmentClient": true },
    "preview": { "distribution": "internal" },
    "production": {}
  }
}
```

## Testing

```bash
# Run all tests
pnpm test

# Run specific test
pnpm test -- auth.test.ts

# Run with coverage
pnpm test -- --coverage
```

## Building for Production

### Android (APK)
```bash
eas build --platform android --profile preview
```

### iOS (IPA)
```bash
eas build --platform ios --profile production
```

## Troubleshooting

### "Cannot reach server"
- Check API is running: `curl http://localhost:3001/health`
- Check IP in `.env` matches your machine's IP
- Ensure phone and computer are on same WiFi network

### "Session expired"
- Tokens expire after 15 minutes
- App auto-refreshes using refresh token
- If refresh fails, user must re-login

### Build fails
```bash
# Clear cache
rm -rf node_modules
pnpm install

# Clear Expo cache
expo r -c
```

### TypeScript errors
```bash
npx tsc --noEmit --project tsconfig.json
```

## Database Schema

The app uses PostgreSQL with Prisma ORM. Key models:

- `User` — Guests, managers, admins
- `Hotel` — Hotel listings
- `Room` — Individual rooms
- `Booking` — Guest reservations
- `Payment` — Transaction records
- `Review` — Guest reviews
- `Dispute` — Customer complaints
- `PlatformSetting` — System configuration
- `AuditLog` — System audit trail
- `FeatureFlag` — Feature toggles

## Monorepo Structure

```
hotel_system/
├── apps/
│   ├── api/           # NestJS backend (port 3001)
│   ├── mobile/        # React Native app (this project)
│   └── web/           # Next.js web app
├── packages/
│   └── shared-types/  # Shared TypeScript types
├── docker-compose.yml # PostgreSQL + Redis
└── package.json       # Root workspace config
```
