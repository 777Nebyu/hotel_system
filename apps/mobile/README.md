# YayeTech Hotel Mobile

Expo/React Native customer app with secure token persistence, registration/sign-in, automatic access-token refresh, hotel discovery, and profile/logout.

## Setup

1. Start the API and make it reachable from your phone or emulator.
2. Copy `.env.example` to `.env` and set `EXPO_PUBLIC_API_URL`:
   - physical device: use your computer's LAN IP, such as `http://192.168.1.10:3001`;
   - Android emulator: `http://10.0.2.2:3001`;
   - iOS simulator: `http://localhost:3001`.
3. From the repository root run `corepack pnpm install`.
4. Run `corepack pnpm --filter mobile start`, then scan the QR code with Expo Go or open an emulator.

Run static type checks with `corepack pnpm --filter mobile check-types`.
