# YayeTech Hotel - Mobile App Setup Guide

## Quick Start

1. **Locally development**: `cd apps/mobile && pnpm dev`

2. **Build development bundle**: `cd apps/mobile && pnpm build:dev`

3. **Build preview**: `cd apps/mobile && pnpm build:preview`

4. **Prepare for production build**: `cd apps/mobile && pnpm build:production`

5. **Build iOS**: `cd apps/mobile && eaz build ios --profile production`

6. **Build Android**: `cd apps/mobile && eaz build android --profile production`

7. **Submit to app stores**: `cd apps/mobile && eaz submit ios --platform ios` or `eaz submit android --platform android`

---

## EAS Credentials Setup

### iOS (Apple App Store)

1. Sign up for [Apple Developer Program](https://developer.apple.com/programs/)
2. Create an app in App Store Connect with bundle ID: `com.yayetech.hotel`
3. Fill the following in `eas.json`:

```json
"ios": {
  "appleId": "your-apple-id@your-domain.com",
  "ascAppId": "com.yayetech.hotel",
  "appleTeamId": "YOUR-12-DIGIT-TEAM-ID",
  "bundleIdentifier": "com.yayetech.hotel"
}
```

Run `eas login` and `eas build:ios --profile production` will handle the upload.

### Android (Google Play Store)

1. Create a project at [developer.android.com/studio/projects](https://developer.android.com/studio/projects)
2. Create an app with package name: `com.yayetech.hotel`
3. Download the **Service Account JSON** key from Google Play Console
4. Save it as `apps/mobile/google-services.json`
5. Fill the following in `eas.json`:

```json
"android": {
  "serviceAccountKeyPath": "./google-services.json",
  "package": "com.yayetech.hotel"
}
```

Run `eas login` and `eas build:android --profile production` will handle the upload.

---

## Testing with Live Backend API

### Development (localhost)

Set API URL in `.env`:
```env
EXPO_PUBLIC_API_URL=http://localhost:3001
```

### Staging

Set in `eas.json` preview profile:
```json
"env": {
  "EXPO_PUBLIC_API_URL": "https://api-staging.yayetech.com"
}
```

### Production

Set in `eas.json` production profile:
```json
"env": {
  "EXPO_PUBLIC_API_URL": "https://api.yayetech.com"
}
```

---

## App Icons & Splash Screen

**Current placeholder state**: All PNGs generated with brand teal (#1f6f64)

Replace with real designs from:
- Icon: `apps/mobile/assets/icon.png` (1024x1024 recommended)
- Splash: `apps/mobile/assets/splash.png` (1284x2778 recommended)
- Android adaptive: `apps/mobile/assets/adaptive-icon.png` (512x512)
- Web favicon: `apps/mobile/assets/favicon.png` (192x192)
- Notifications: `apps/mobile/assets/notification-icon.png` (192x192)

Run `npx expo prebuild -p ios` or `android` after replacing icons.

---

## Environment Variables

Available in app and EAS profiles:

| Variable | Description | default |
|----------|-------------|---------|
| `EXPO_PUBLIC_API_URL` | Backend API base URL | See profile |
| `EXPO_PUBLIC_MOCK_PAYMENT_SECRET` | Payment mock key (for local dev) | - |

---

## Production Checklist

- [ ] Replace all placeholder PNGs with real designs
- [ ] Verify EAS credentials in `eas.json`
- [ ] Download Google Services Account JSON and save to `apps/mobile/google-services.json`
- [ ] Set correct API URL in production profile
- [ ] Validate navigation flows
- [ ] Test auth flow (login, signup, logout)
- [ ] Test booking flow (dates → payment → confirmation)
- [ ] Test admin/manager screens (role-based access)
- [ ] Run device tests and E2E tests
- [ ] Build and test on physical devices
- [ ] Submit to App Store and Google Play

---

## Common Issues

### "Module not found" errors
Run: `pnpm install`

### Metro bundler issues
Run: `cd apps/mobile && pnpm start --clear`

### Expo build failures
Check Expo status at [status.expo.dev](https://status.expo.dev)

### Apple ID issues
Ensure 2FA is enabled on your Apple ID