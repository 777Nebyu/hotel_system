# Navigation System

## Navigation files

| File | Responsibility |
|---|---|
| `src/navigation/RootNavigator.tsx` | Native stack, protected screens, role guards |
| `src/navigation/MainTabs.tsx` | Customer bottom tabs |
| `src/navigation/types.ts` | `RootStackParamList` and `TabParamList` |
| `src/lib/navigationRef.ts` | Imperative navigation for push/deep-link handlers |

## Actual structure

```text
RootNavigator (native stack)
├── MainTabs (customer)
│   ├── HomeTab
│   ├── BookingsTab
│   ├── FavoritesTab
│   └── ProfileTab
├── Auth / ForgotPassword / VerifyEmail / ResetPassword
├── HotelDetail / Search / RoomDetail
├── BookingFlow / BookingDetail / BookingModify
├── PaymentHistory / ChapaCheckout / TelebirrOtp / BankAuth / PaymentResult
├── Notifications / Reviews / Disputes / Support
├── ManagerOverview / ManagerBookings / ManagerHotel / ManagerRooms
├── ManagerReports / ManagerMore / ManagerBilling / WalkInBooking
└── AdminOverview / AdminUsers / AdminHotels / AdminBookings / ...
```

There is no separate Guest, Manager, or Admin tab navigator in the current source.

## Protection

- Public browsing screens can be opened without a session.
- `withProtected()` adds `AuthGuard` to authenticated screens.
- `RoleGuard` enforces allowed roles on customer, staff, manager, and admin screens.
- Backend authorization remains authoritative; hiding a screen is not a security boundary.

## Navigation patterns

Most screens use `useNavigation()` and `useRoute()` from React Navigation. Some manager/admin wrappers receive `onBack` and `onNavigate` callbacks from `RootNavigator`; this is not a universal prop contract.

## Deep links and notification taps

Configured links include `yayetech://hotel/:hotelId` and `yayetech://booking/:bookingId`. Push taps are handled in `App.tsx`: customer booking alerts open `BookingDetail`, while booking alerts for staff, managers, and admins open `ManagerBookings`.
