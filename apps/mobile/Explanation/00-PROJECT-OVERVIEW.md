# YayeTech Hotel Mobile App — Current Overview

This document describes the implementation currently in `apps/mobile`.

## Roles

The API and mobile app use four roles:

- `CUSTOMER` — browse hotels, book rooms, pay, manage personal bookings, reviews, disputes, and support.
- `STAFF` — operate assigned hotels: bookings, check-in/out, reports, and walk-in bookings.
- `MANAGER` — manage assigned hotels, rooms, pricing, bookings, reports, and walk-ins.
- `ADMIN` — platform-wide users, hotels, bookings, payments, reports, settings, moderation, and audit tools.

There is no `GUEST` role in the code. Unauthenticated visitors can browse public content, but booking and account actions require `CUSTOMER` authentication.

## Technology

| Layer | Current implementation |
|---|---|
| Framework | React Native 0.81.5 + Expo SDK 54 |
| Language | TypeScript 5.9 |
| Navigation | React Navigation 7 native stack + customer bottom tabs |
| Client state | Redux Toolkit |
| Server state | TanStack React Query |
| Styling | React Native `StyleSheet` + `useTheme` tokens |
| API | Typed `fetch` wrapper in `src/api.ts` |
| Storage | SecureStore for sessions and push tokens |
| Tests | Jest + React Native Testing Library |

## Source layout

```text
apps/mobile/
├── index.ts
├── src/
│   ├── App.tsx
│   ├── api.ts
│   ├── navigation/       # RootNavigator, MainTabs, route types
│   ├── screens/          # 58 TSX screen files
│   │   ├── admin/         # 15 admin screens
│   │   └── manager/       # 9 manager/staff screens
│   ├── components/
│   ├── hooks/
│   ├── store/             # auth, booking flow, search filters
│   ├── lib/               # push, biometrics, calendar, navigation
│   └── locales/           # English and Amharic
└── Explanation/
```

## Main flows

- Authentication: login/register → session restore → role guard.
- Customer booking: dates → guests → payment method → review → confirmation.
- Payments: Chapa mock flow with Telebirr OTP and bank authorization screens.
- Hotel operations: booking list → confirm/reject → check-in → check-out.
- Notifications: in-app list, push registration, and role-aware booking deep links.

## Run

From the monorepo root:

```bash
pnpm install
pnpm --filter mobile start
```

Set `EXPO_PUBLIC_API_URL` in `apps/mobile/.env` to an API address reachable by the device.
