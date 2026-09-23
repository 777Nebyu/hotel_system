# Shared Components

All reusable UI components live in `src/components/`.

## Component Catalog

### Layout & Structure

| Component | File | Purpose |
|-----------|------|---------|
| `ScreenHeader` | `ScreenHeader.tsx` | Top bar with back button, title, subtitle, optional right element |
| `Card` | `Shared.tsx` | Themed card container with shadow |
| `BottomSheet` | `BottomSheet.tsx` | iOS-style bottom sheet modal |
| `FadeIn` | `FadeIn.tsx` | Wrapper that fades children in on mount |

### Buttons & Actions

| Component | File | Purpose |
|-----------|------|---------|
| `Button` | `Shared.tsx` | Primary/secondary/danger button with loading state |
| `FAB` | `FAB.tsx` | Floating action button |

### Data Display

| Component | File | Purpose |
|-----------|------|---------|
| `Badge` | `Shared.tsx` | Status/count badge |
| `Stars` | `Shared.tsx` | Star rating display (1-5) |
| `ReviewCard` | `ReviewCard.tsx` | Review display card |
| `SkeletonList` | `Skeleton.tsx` | Loading skeleton for lists |
| `SkeletonKPI` | `Skeleton.tsx` | Loading skeleton for KPI cards |
| `SkeletonCard` | `Skeleton.tsx` | Loading skeleton for cards |

### Forms & Input

| Component | File | Purpose |
|-----------|------|---------|
| `TextInput` | (React Native) | Used directly with theme styles |
| `DatePickerModal` | `DatePickerModal.tsx` | Date range picker |
| `FilterPanel` | `FilterPanel.tsx` | Search filter controls |
| `PaymentMethodSelector` | `PaymentMethodSelector.tsx` | Payment method picker |

### Feedback

| Component | File | Purpose |
|-----------|------|---------|
| `EmptyState` | `Shared.tsx` | "No data" placeholder with icon |
| `ErrorBox` | `Shared.tsx` | Error display with retry button |
| `Toast` | `Toast.tsx` | Temporary notification popup |
| `ConfirmDialog` | `ConfirmDialog.tsx` | Confirmation modal |
| `OfflineBanner` | `OfflineBanner.tsx` | "You're offline" warning bar |

### Auth & Security

| Component | File | Purpose |
|-----------|------|---------|
| `AuthGuard` | `AuthGuard.tsx` | Protects routes requiring authentication |
| `ErrorBoundary` | `ErrorBoundary.tsx` | Catches React errors, shows fallback UI |

### Booking

| Component | File | Purpose |
|-----------|------|---------|
| `BookingComponents` | `BookingComponents.tsx` | Booking status cards |
| `BookingStepper` | `BookingStepper.tsx` | Multi-step progress indicator |
| `BookingReviewCard` | `BookingReviewCard.tsx` | Premium booking review section with dark-luxury styling |
| `AvailabilityCalendar` | `AvailabilityCalendar.tsx` | Room availability date picker |

### Responsive

| Component | File | Purpose |
|-----------|------|---------|
| `ScaledText` | `ScaledText.tsx` | Text that scales with screen size |

### Mock / Development

| Component | File | Purpose |
|-----------|------|---------|
| `MockModeBanner` | `MockModeBanner.tsx` | Banner indicating mock payment mode is active |
| `MockScenarioSelector` | `MockScenarioSelector.tsx` | Picker to select mock payment scenario (success, failed, etc.) |

## Common Pattern

```tsx
import { Card, Button, EmptyState } from '../components/Shared';
import ScreenHeader from '../components/ScreenHeader';
import { useToast } from '../components/Toast';

function MyScreen({ onBack }) {
  const toast = useToast();

  return (
    <View style={s.root}>
      <ScreenHeader title="My Screen" onBack={onBack} />
      <Card style={s.card}>
        <Text>Content</Text>
      </Card>
      <Button
        title="Save"
        onPress={() => toast('success', 'Saved!')}
      />
    </View>
  );
}
```

## Toast Usage

```typescript
import { useToast } from '../components/Toast';

function MyComponent() {
  const toast = useToast();

  // Show success toast
  toast('success', 'Settings saved');

  // Show error toast
  toast('error', 'Failed to load data');

  // Show info toast
  toast('info', 'Pull down to refresh');
}
```
