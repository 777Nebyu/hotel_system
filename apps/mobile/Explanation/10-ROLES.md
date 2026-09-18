# Roles & Access Control

## Overview

The system has **4 actor roles** defined in `@repo/shared-types`:

```typescript
type UserRole = 'CUSTOMER' | 'STAFF' | 'MANAGER' | 'ADMIN';
```

Role-based access is enforced at three levels:
1. **Navigation** — `RootNavigator.tsx` uses `<RoleGuard>` to block screens by role
2. **API** — Backend validates role on every endpoint
3. **UI** — Tabs and actions are conditionally rendered per role
---
## CUSTOMER
The end user who browses hotels, makes bookings, and manages their account.
### Tab Navigator
| Tab | Screen |
|-----|--------|
| Home | `HomeScreen` — featured hotels, upcoming trips, search hero |
| Bookings | `BookingHistoryScreen` — upcoming and past reservations |
| Saved | `FavoritesScreen` — saved/favorited hotels |
| Profile | `ProfileTab` — edit profile, settings, sign out |
### Accessible Screens
| Screen | Purpose |
|--------|---------|
| `SearchScreen` | Full hotel search with filters |
| `HotelDetailScreen` | Hotel gallery, rooms, amenities, reviews, policies |
| `RoomDetailScreen` | Room details and booking trigger |
| `BookingFlowScreen` | 5-step booking wizard (Dates → Guests → Payment → Review → Done) |
| `BookingDetailScreen` | Booking receipt, payment status, QR code |
| `BookingModifyScreen` | Modify dates or guests on existing booking |
| `BookingHistoryScreen` | All reservations list |
| `ReviewScreen` | Create or edit a hotel review |
| `MyReviewsScreen` | View own submitted reviews |
| `FavoritesScreen` | Saved hotels |
| `NotificationsScreen` | Notification inbox |
| `ProfileEditScreen` | Edit name, phone, profile photo |
| `AccountSecurityScreen` | Change password, enable biometrics |
| `SettingsScreen` | App preferences (notifications, language) |
| `HelpScreen` | FAQ and support |
| `DisputeScreen` | Create a new dispute |
| `DisputeDetailScreen` | View dispute status and resolution |
| `ContactInboxScreen` | Support message inbox |
| `ContactNewScreen` | Start new conversation with a hotel |
| `ContactThreadDetailScreen` | View conversation thread |
### Permissions
- ✅ Browse and search hotels
- ✅ Book rooms (5-step wizard with payment)
- ✅ Modify own bookings
- ✅ Cancel own bookings
- ✅ Write/edit own reviews
- ✅ Save/unsave hotels (favorites)
- ✅ Create and view own disputes
- ✅ Send support messages
- ✅ Download invoices
- ✅ Export bookings to calendar (ICS)
- ❌ Cannot access admin, manager, or staff screens
- ❌ Cannot manage hotels or rooms
- ❌ Cannot view other users' bookings
---
## STAFF
Front desk / hotel employee. Handles day-to-day operations like check-in/check-out and walk-in bookings. Has limited access compared to Manager.

### Tab Navigator
| Tab | Screen |
|-----|--------|
| Overview | `ManagerOverviewScreen` — occupancy, revenue, alerts |
| Bookings | `ManagerBookingsScreen` — hotel booking list |

### Accessible Screens
| Screen | Purpose |
|--------|---------|
| `ManagerOverviewScreen` | Hotel dashboard — occupancy, revenue, alerts |
| `ManagerBookingsScreen` | Hotel-specific booking list |
| `ManagerReportsScreen` | Operational reports (limited, server-enforced) |
| `ManagerMoreScreen` | Additional tools hub |
| `WalkInBookingScreen` | Create a walk-in booking for a guest |
| `EarlyCheckinLateCheckoutScreen` | Handle early check-in / late check-out requests |
| `BookingDetailScreen` | View booking details |

### Blocked Screens (vs Manager)
| Screen | Reason |
|--------|--------|
| `ManagerHotelScreen` | Staff cannot edit hotel profile |
| `ManagerRoomsScreen` | Staff cannot manage rooms or set pricing |

### Permissions
- ✅ View hotel dashboard (occupancy, revenue, alerts)
- ✅ View and manage hotel bookings (confirm, reject, check-in, check-out)
- ✅ Create walk-in bookings
- ✅ Handle early check-in / late check-out requests
- ✅ View operational reports
- ❌ Cannot edit hotel profile or settings
- ❌ Cannot manage rooms, pricing, or inventory
- ❌ Cannot access any admin screens

---

## MANAGER

Hotel owner / general manager. Full control over their assigned hotel(s).

### Tab Navigator
| Tab | Screen |
|-----|--------|
| Overview | `ManagerOverviewScreen` — occupancy, revenue, alerts |
| Bookings | `ManagerBookingsScreen` — hotel booking list |
| Rooms | `ManagerRoomsScreen` — room inventory management |
| Reports | `ManagerReportsScreen` — hotel-level reports |
| More | `ManagerMoreScreen` — additional tools |

### Accessible Screens
| Screen | Purpose |
|--------|---------|
| `ManagerOverviewScreen` | Hotel dashboard — occupancy, revenue, alerts |
| `ManagerBookingsScreen` | Hotel-specific booking list |
| `ManagerHotelScreen` | Edit hotel details (name, description, amenities, images) |
| `ManagerRoomsScreen` | Manage room inventory (add, edit, remove rooms, set pricing) |
| `ManagerReportsScreen` | Full hotel-level reports (revenue, occupancy, cancellations) |
| `ManagerMoreScreen` | Additional tools hub |
| `WalkInBookingScreen` | Create a walk-in booking |
| `EarlyCheckinLateCheckoutScreen` | Handle early check-in / late check-out requests |
| `BookingDetailScreen` | View booking details |

### Permissions
- ✅ Everything Staff can do, plus:
- ✅ Edit hotel profile (name, description, address, star rating, amenities, images)
- ✅ Manage room inventory (create, update, delete rooms)
- ✅ Set room pricing and seasonal rates
- ✅ View full hotel-level reports
- ❌ Cannot access admin screens
- ❌ Cannot manage other hotels or users
- ❌ Cannot manage coupons or platform settings

---

## ADMIN

Platform administrator. Full control over the entire system.

### Tab Navigator
| Tab | Screen |
|-----|--------|
| Overview | `AdminOverviewScreen` — platform KPIs, alerts |
| Bookings | `AdminBookingsScreen` — all bookings across platform |
| Hotels | `AdminHotelsScreen` — all hotels, approval |
| Users | `AdminUsersScreen` — user management |
| Settings | `AdminSettingsScreen` — platform settings |

### Accessible Screens
| Screen | Purpose |
|--------|---------|
| **Dashboard** | |
| `AdminOverviewScreen` | Platform KPIs, alerts, top hotels |
| **Management** | |
| `AdminUsersScreen` | List/manage all users, change roles, suspend/restore |
| `AdminHotelsScreen` | List/manage all hotels, approve/reject |
| `AdminBookingsScreen` | List/manage all bookings, cancel, export CSV |
| `AdminPaymentsScreen` | Payment transactions, refunds, export CSV |
| `AdminCouponsScreen` | Create, update, delete promo codes |
| `AdminStaffHotelScreen` | Assign staff to hotels |
| **Moderation** | |
| `AdminReviewsScreen` | Moderate and delete reviews |
| `AdminDisputesScreen` | Resolve customer disputes |
| `AdminEmergencyScreen` | Emergency hotel suspension |
| `AdminFeatureFlagsScreen` | Toggle feature flags (maintenance mode) |
| **Platform** | |
| `AdminSettingsScreen` | Commission rate, currency, payment methods |
| `AdminAuditLogScreen` | View system audit trail |
| `AdminReportsScreen` | Revenue reports, charts, KPIs |
| **Shared** | |
| `DisputeDetailScreen` | View and resolve disputes (shared with Customer) |

### Permissions
- ✅ Full platform overview (users, hotels, bookings, revenue)
- ✅ User management (suspend, restore, change roles)
- ✅ Hotel management (approve, reject, activate, deactivate)
- ✅ View and manage all bookings across all hotels
- ✅ View and manage all payments, issue refunds
- ✅ Coupon / promo code management
- ✅ Review moderation (delete any review)
- ✅ Dispute resolution
- ✅ Emergency hotel suspension
- ✅ Feature flag management
- ✅ Audit log viewer
- ✅ Revenue and analytics reports
- ✅ Staff-to-hotel assignments
- ✅ Data export (CSV/Excel)
- ❌ Cannot edit hotel profiles (Manager's job)
- ❌ Cannot manage rooms directly (Manager's job)
- ❌ Cannot create bookings (Customer's job)

---

## Role Comparison Matrix

| Capability | CUSTOMER | STAFF | MANAGER | ADMIN |
|-----------|----------|-------|---------|-------|
| Browse hotels | ✅ | ✅ | ✅ | ✅ |
| Search with filters |  | ✅ | ✅ | ✅ |
| Book rooms | ✅ | ✅ ✅(walk-in) | ✅ (walk-in) | ❌ |
| Modify own bookings | ✅ | ❌ | ❌ | ❌ |
| Cancel own bookings | ✅ | ❌ | ❌ | ❌ |
| Write reviews | ✅ | ❌ | ❌ | ❌ |
| Save favorites | ✅ | ❌ | ❌ | ❌ |
| Create disputes | ✅ | ❌ | ❌ | ❌ |
| Send support messages | ✅ | ✅ | ✅ | ✅ |
| View hotel dashboard | ❌ | ✅ | ✅ | ✅ |
| Manage hotel bookings | ❌ | ✅ | ✅ | ✅ |
| Confirm/reject bookings | ❌ | ✅ | ✅ | ❌ |
| Check-in/check-out guests | ❌ | ✅ | ✅ | ❌ |
| Handle early/late requests | ❌ | ✅ | ✅ | ❌ |
| Edit hotel profile | ❌ | ❌ | ✅ | ❌ |
| Manage rooms/pricing | ❌ | ❌ | ✅ | ❌ |
| View hotel reports | ❌ | ✅ (limited) | ✅ | ✅ (all) |
| Manage all users | ❌ | ❌ | ❌ | ✅ |
| Manage all hotels | ❌ | ❌ | ❌ | ✅ |
| Approve/reject hotels | ❌ | ❌ | ❌ | ✅ |
| Manage coupons | ❌ | ❌ | ❌ | ✅ |
| Moderate reviews | ❌ | ❌ | ❌ | ✅ |
| Resolve disputes | ❌ | ❌ | ❌ | ✅ |
| Emergency suspension | ❌ | ❌ | ❌ | ✅ |
| Feature flags | ❌ | ❌ | ❌ | ✅ |
| Audit logs | ❌ | ❌ | ❌ | ✅ |
| Platform settings | ❌ | ❌ | ❌ | ✅ |
| Export data | ❌ | ❌ | ❌ | ✅ |

---

## Navigation Flow Per Role

```
App Launch
  │
  ├─ No session → AuthScreen (Login/Register)
  │
  ├─ CUSTOMER → GuestTabs
  │  ├─ HomeTab
  │  ├─ BookingsTab
  │  ├─ FavoritesTab
  │  └─ ProfileTab
  │
  ├─ STAFF → ManagerTabs (limited)
  │  ├─ OverviewTab
  │  ├─ BookingsTab
  │  └─ MoreTab
  │
  ├─ MANAGER → ManagerTabs (full)
  │  ├─ OverviewTab
  │  ├─ BookingsTab
  │  ├─ RoomsTab
  │  ├─ ReportsTab
  │  └─ MoreTab
  │
  └─ ADMIN → AdminTabs
     ├─ OverviewTab
     ├─ BookingsTab
     ├─ HotelsTab
     ├─ UsersTab
     └─ SettingsTab
```

---

## Implementation Details

### RoleGuard Component (`RootNavigator.tsx:64-77`)
```tsx
<RoleGuard allowedRoles={['ADMIN']}>
  <AdminOverviewScreen />
</RoleGuard>
```
Checks `session.user.role` against `allowedRoles`. Shows "Access Denied" if not matched.

### AuthGuard Component (`components/AuthGuard.tsx`)
Wraps protected screens. Redirects to `AuthScreen` if no session exists.

### API Enforcement
Backend validates role on every request. Even if a user manually navigates to a screen, the API returns 403 for unauthorized actions.
