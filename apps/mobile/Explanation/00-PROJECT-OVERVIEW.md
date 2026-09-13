# YayeTech Hotel - Mobile App Overview

## What is this?

A **React Native / Expo** mobile application for the YayeTech Hotel Booking System. It serves three user roles:

- **Guest** — Browse hotels, book rooms, manage bookings, leave reviews, raise disputes
- **Hotel Manager** — Manage rooms, view bookings, handle walk-ins, generate reports
- **Platform Admin** — Oversee all hotels, users, payments, disputes, settings

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React Native 0.81 + Expo SDK 54 |
| Language | TypeScript 5.9 |
| State | Redux Toolkit + React Query |
| Navigation | React Navigation 7 (native-stack + bottom-tabs) |
| Styling | React Native StyleSheet + custom theme system |
| API | REST (fetch wrapper) |
| Storage | Expo SecureStore (tokens), AsyncStorage (cache) |
| Testing | Jest + React Native Testing Library |

## Project Structure

```
mobile/
├── index.ts              # Expo entrypoint
├── src/
│   ├── App.tsx           # Root component (providers wrap here)
│   ├── api.ts            # HTTP client (fetch wrapper + auth retry)
│   ├── theme.ts          # Light/dark theme tokens
│   ├── types.ts          # Shared TypeScript types
│   ├── errors.ts         # Error classes (ApiError, NetworkError)
│   ├── i18n.ts           # Internationalization (English + Amharic)
│   │
│   ├── navigation/       # React Navigation setup
│   ├── screens/          # 50 screen components
│   │   ├── (27 guest screens)
│   │   ├── admin/        # (15 admin screens)
│   │   └── manager/      # (8 manager screens)
│   ├── components/       # 19 reusable UI components
│   ├── hooks/            # 9 custom React hooks
│   ├── store/            # Redux store (auth, booking flow, search)
│   ├── lib/              # Utility libraries
│   └── locales/          # Translation files (en, am)
```

## How to Run

```bash
# Install dependencies
pnpm install

# Start Expo dev server
cd apps/mobile
pnpm start

# Run on Android emulator
pnpm android

# Run on iOS simulator
pnpm ios
```

## Environment Variables

Set in `.env`:
```
EXPO_PUBLIC_API_URL=http://192.168.1.12:3001
EXPO_PUBLIC_MOCK_PAYMENT_SECRET=your-secret-here
```

## Key Features

1. **Authentication** — Email/password login, JWT tokens, biometric auth
2. **Hotel Search** — Filters, date picker, availability calendar
3. **Booking Flow** — Multi-step wizard with payment
4. **Real-time Updates** — Pull-to-refresh on all data screens
5. **Offline Support** — Network detection, offline banner
6. **Dark Mode** — Full light/dark theme with system preference detection
7. **Internationalization** — English and Amharic languages
8. **Role-based Access** — Different navigation and screens per role
