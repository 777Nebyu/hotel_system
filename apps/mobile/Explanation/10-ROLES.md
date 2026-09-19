# Roles & Access Control — Current Implementation

The mobile app and API use four roles. Role checks in the mobile UI improve navigation, but the API remains the security boundary.

## Roles

| Role | Scope | Main responsibility |
|---|---|---|
| `CUSTOMER` | Own account and bookings | Browse, book, pay, review, dispute, support |
| `STAFF` | Assigned hotel(s) | Front-desk booking operations and check-in/out |
| `MANAGER` | Managed hotel(s) | Hotel, room, pricing, booking, and report management |
| `ADMIN` | Platform-wide | Users, hotels, payments, reports, settings, moderation, audit |

`GUEST` is not a token role. A logged-out visitor is simply unauthenticated.

## Where access is enforced

1. `RootNavigator.tsx` wraps protected routes with `AuthGuard`.
2. `RoleGuard` checks the current Redux session role before rendering restricted screens.
3. API controllers and services enforce JWT role and hotel-resource scope.

## Customer access

Customers can use the customer bottom tabs (`HomeTab`, `BookingsTab`, `FavoritesTab`, `ProfileTab`) and protected customer flows:

- Booking flow and payment screens
- Booking details and modifications
- Reviews and personal review history
- Disputes and support conversations
- Notifications, account security, settings, and help

Customers cannot access manager or admin routes.

## Staff access

Staff can access `ManagerBookings`, `ManagerReports`, `ManagerMore`, `WalkInBooking`, and operational check-in/out workflows for assigned hotels. Staff cannot edit hotel profiles, rooms, or pricing and cannot access admin screens.

## Manager access

Managers can access hotel overview, bookings, billing, reports, hotel profile, room inventory, walk-ins, and early/late stay operations. Resource ownership is checked by the API; a manager cannot manage another manager's hotel.

## Admin access

Admins can access all admin screens: users, hotels, bookings, payments, coupons, reviews, reports, settings, audit logs, staff-hotel assignments, disputes, emergency controls, and feature flags. Admin has no hotel resource-scope restriction.

## Role matrix

| Capability | Customer | Staff | Manager | Admin |
|---|:---:|:---:|:---:|:---:|
| Browse hotels/rooms | ✓ | ✓ | ✓ | ✓ |
| Create personal booking | ✓ | — | — | — |
| Cancel own booking | ✓ | — | — | — |
| Confirm/reject booking | — | Assigned hotel | Own hotel | All |
| Check in/out guests | — | Assigned hotel | Own hotel | All |
| Walk-in booking | — | ✓ | ✓ | ✓ |
| Manage hotel/rooms/pricing | — | — | Own hotel | All |
| Leave own completed-stay review | ✓ | — | — | — |
| Platform user/settings/audit management | — | — | — | ✓ |

## Notification routing

Customer booking notifications open `BookingDetail`. `new_booking` and other booking alerts received by staff, managers, or admins open `ManagerBookings`. Push taps are handled in `App.tsx` for foreground and cold-start cases.
