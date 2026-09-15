# Screens

## Guest Screens (27)

### Auth & Onboarding
| Screen | Purpose |
|--------|---------|
| `SplashScreen` | App loading/splash screen |
| `OnboardingScreen` | First-time user tutorial |
| `AuthScreen` | Login / Register |
| `ForgotPasswordScreen` | Request password reset |
| `ResetPasswordScreen` | Enter new password |
| `VerifyEmailScreen` | Email verification |

### Core Browsing
| Screen | Purpose |
|--------|---------|
| `HomeScreen` | Guest dashboard — featured hotels, recent bookings |
| `SearchScreen` | Search hotels with filters (dates, price, stars) |
| `HotelDetailScreen` | Hotel details, rooms, photos, reviews |
| `RoomDetailScreen` | Room details, pricing, availability |

### Booking
| Screen | Purpose |
|--------|---------|
| `BookingFlowScreen` | Multi-step booking wizard (dates → room → payment → confirm) |
| `BookingDetailScreen` | View booking details, status, QR code |
| `BookingHistoryScreen` | Past and upcoming bookings list |
| `BookingModifyScreen` | Modify dates or cancel booking |

### Account
| Screen | Purpose |
|--------|---------|
| `DashboardScreen` | Guest dashboard with stats |
| `ProfileEditScreen` | Edit profile (name, photo, phone) |
| `AccountSecurityScreen` | Change password, enable biometrics |
| `SettingsScreen` | Guest settings (notifications, language) |
| `FavoritesScreen` | Saved hotels |
| `NotificationsScreen` | Push notification history |

### Reviews & Disputes
| Screen | Purpose |
|--------|---------|
| `ReviewScreen` | Write a review for a completed booking |
| `MyReviewsScreen` | View my submitted reviews |
| `DisputeScreen` | Create a new dispute |
| `DisputeDetailScreen` | View dispute status and resolution |

### Support
| Screen | Purpose |
|--------|---------|
| `ContactInboxScreen` | Message inbox |
| `ContactNewScreen` | Start new conversation |
| `ContactThreadDetailScreen` | View conversation thread |
| `HelpScreen` | FAQ and support |

---

## Admin Screens (15)

### Dashboard
| Screen | Purpose |
|--------|---------|
| `AdminOverviewScreen` | Platform KPIs, alerts, top hotels, admin navigation |

### Management
| Screen | Purpose |
|--------|---------|
| `AdminHotelsScreen` | List/manage all hotels, approve pending |
| `AdminUsersScreen` | List/manage all users, change roles |
| `AdminBookingsScreen` | List/manage all bookings, cancel, export CSV |
| `AdminPaymentsScreen` | Payment transactions, issue refunds, export CSV |
| `AdminStaffHotelsScreen` | Assign staff to hotels |
| `AdminStaffHotelScreen` | Manage a specific staff-hotel assignment |

### Moderation
| Screen | Purpose |
|--------|---------|
| `AdminReviewsScreen` | Moderate flagged reviews |
| `AdminDisputesScreen` | Resolve customer disputes |
| `AdminEmergencyScreen` | Emergency hotel suspensions |

### Platform
| Screen | Purpose |
|--------|---------|
| `AdminSettingsScreen` | Commission rate, currency, payment methods |
| `AdminFeatureFlagsScreen` | Toggle feature flags |
| `AdminAuditLogScreen` | View system audit trail |
| `AdminReportsScreen` | Revenue reports, charts, KPIs |

---

## Manager Screens (8)

| Screen | Purpose |
|--------|---------|
| `ManagerOverviewScreen` | Hotel dashboard — occupancy, revenue, alerts |
| `ManagerBookingsScreen` | Hotel bookings list |
| `ManagerHotelScreen` | Edit hotel details |
| `ManagerRoomsScreen` | Manage room inventory |
| `ManagerReportsScreen` | Hotel-specific reports |
| `ManagerMoreScreen` | Additional manager tools |
| `WalkInBookingScreen` | Create walk-in booking |
| `EarlyCheckinLateCheckoutScreen` | Handle early/late requests |

---

## Screen Pattern

Every screen follows this structure:

```tsx
import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { useThemeColors } from '../../theme';
import ScreenHeader from '../../components/ScreenHeader';

interface Props {
  onBack: () => void;
  onNavigate?: (page: { screen: string } & Record<string, any>) => void;
}

export default function MyScreen({ onBack, onNavigate }: Props) {
  const c = useThemeColors();
  const s = useMemo(() => makeStyles(c), [c]);

  return (
    <View style={s.root}>
      <ScreenHeader title="My Screen" onBack={onBack} />
      {/* Screen content */}
    </View>
  );
}

const makeStyles = (c: ReturnType<typeof useThemeColors>) => StyleSheet.create({
  root: { flex: 1, backgroundColor: c.paper },
});
```
