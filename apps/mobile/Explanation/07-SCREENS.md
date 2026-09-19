# Screens — Current Inventory

The source currently contains 58 `.tsx` screen files. Screens are lazy-loaded by `RootNavigator` where appropriate.

## Customer/public flow

`Splash`, `Onboarding`, `Auth`, `ForgotPassword`, `VerifyEmail`, `ResetPassword`, `Home`, `Search`, `HotelDetail`, `RoomDetail`, `BookingFlow`, `BookingDetail`, `BookingModify`, `BookingHistory`, `Favorites`, `ProfileEdit`, `AccountSecurity`, `Notifications`, `Settings`, `Help`, `Review`, `MyReviews`, `Disputes`, `DisputeDetail`, `ContactInbox`, `ContactThreadDetail`, `ContactNew`, and payment/mock screens.

Customer-only routes are protected with `RoleGuard(['CUSTOMER'])`; public browsing routes remain accessible without login.

## Manager/staff screens

The shared operations area contains:

- `ManagerOverviewScreen`
- `ManagerBookingsScreen`
- `ManagerHotelScreen`
- `ManagerRoomsScreen`
- `ManagerReportsScreen`
- `ManagerMoreScreen`
- `ManagerBillingScreen`
- `WalkInBookingScreen`
- `EarlyCheckinLateCheckoutScreen`

Staff receives the operational subset. Hotel and room editing is restricted to managers/admins.

## Admin screens

Admin routes include overview, users, hotels, bookings, payments, coupons, reviews, reports, settings, audit logs, staff-hotel assignments, disputes, emergency controls, and feature flags.

## Screen implementation pattern

There is no universal `onBack`/`onNavigate` prop requirement. Most current screens use:

```tsx
const navigation = useNavigation();
const route = useRoute();
```

Static manager/admin wrappers may pass callback props where a screen was designed for them. Route parameter types are defined in `src/navigation/types.ts`.
