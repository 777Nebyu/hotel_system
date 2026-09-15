# Navigation System

## Files

| File | Purpose |
|------|---------|
| `navigation/RootNavigator.tsx` | Top-level navigator — checks auth state and routes to correct tab navigator |
| `navigation/MainTabs.tsx` | Bottom tab bar (different tabs per role) |
| `navigation/types.ts` | TypeScript types for all route params |

## Navigation Structure

```
RootNavigator (Stack)
├─ SplashScreen (splash)
├─ OnboardingScreen (onboarding)
├─ AuthScreen (auth)
├─ ForgotPasswordScreen (forgotPassword)
├─ ResetPasswordScreen (resetPassword)
├─ VerifyEmailScreen (verifyEmail)
│

├─ GuestTabs (BottomTabs)        ← role: GUEST
│  ├─ HomeTab (home)
│  ├─ SearchTab (search)
│  ├─ BookingsTab (bookings)
│  ├─ FavoritesTab (favorites)
│  └─ ProfileTab (profile)
│
├─ ManagerTabs (BottomTabs)      ← role: MANAGER
│  ├─ OverviewTab (overview)
│  ├─ BookingsTab (bookings)

│  ├─ RoomsTab (rooms)
│  ├─ ReportsTab (reports)
│  └─ MoreTab (more)

├─ AdminTabs (BottomTabs)        ← role: ADMIN
│  ├─ OverviewTab (overview)
│  ├─ BookingsTab (bookings)
│  ├─ HotelsTab (hotels)
│  ├─ UsersTab (users)
  

│  └─ SettingsTab (settings)
│
└─ Modal Screens (push on top of tabs)
   ├─ HotelDetailScreen
   ├─ RoomDetailScreen
   ├─ BookingDetailScreen

   ├─ BookingFlowScreen
   ├─ BookingModifyScreen
   ├─ BookingHistoryScreen
   ├─ ReviewScreen
   ├─ DisputeScreen / DisputeDetailScreen
   ├─ ContactInboxScreen / ContactThreadDetailScreen
   ├─ NotificationsScreen
   ├─ ProfileEditScreen
   ├─ SettingsScreen
   ├─ HelpScreen
   └─ Admin-specific screens (15 total)
```

## How Navigation Works

1. **App starts** → `RootNavigator` checks Redux auth state
2. **No session** → Shows `AuthScreen`
3. **Has session** → Reads `user.role` and shows the correct tab navigator
4. **Screen push** → `onNavigate({ screen: 'HotelDetail', hotelId: '...' })` pattern
5. **Go back** → `onBack()` prop passed to every screen

## Screen Props Pattern

Every screen receives these props:

```typescript
interface Props {
  onBack: () => void;                    // Navigate back
  onNavigate?: (page: {                  // Navigate forward
    screen: string;
    [key: string]: any;                   // Extra params
  }) => void;
}
```


## Deep Linking

The app supports deep links via Expo:
- `yayetech://hotel/:id` → Opens hotel detail
- `yayetech://booking/:id` → Opens booking detail
