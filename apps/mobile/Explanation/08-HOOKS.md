# Custom Hooks

All custom hooks live in `src/hooks/`.

## Hooks Catalog

### `useTheme.ts` — Theme Provider

Provides theme context to the entire app.

```typescript
import { useTheme, ThemeProvider } from '../hooks/useTheme';

// In App.tsx (provider):
<ThemeProvider>
  <App />
</ThemeProvider>

// In any component:
const { colorScheme, toggleTheme, isDark } = useTheme();
```

### `useAppColorScheme.ts` — Color Scheme Detection

Returns the current system color scheme (light/dark).

```typescript
import { useAppColorScheme } from '../hooks/useAppColorScheme';

const scheme = useAppColorScheme(); // 'light' | 'dark'
```

### `useResponsive.ts` — Responsive Breakpoints

Returns screen size category for responsive layouts.

```typescript
import { useResponsive } from '../hooks/useResponsive';

const { isSmall, isMedium, isLarge, width } = useResponsive();
// isSmall:  < 360px
// isMedium: 360-430px
// isLarge:  > 430px
```

### `useResponsivePadding.ts` — Adaptive Padding

Returns padding value based on screen width.

```typescript
import { useResponsivePadding } from '../hooks/useResponsivePadding';

const padding = useResponsivePadding(); // 16px on small, 20px on large
```

### `useDebounce.ts` — Debounced Value

Debounces a value to prevent excessive re-renders (e.g., search input).

```typescript
import { useDebounce } from '../hooks/useDebounce';

const [search, setSearch] = useState('');
const debouncedSearch = useDebounce(search, 300);
// debouncedSearch updates 300ms after user stops typing
```

### `useNetworkStatus.ts` — Online/Offline Detection

Tracks network connectivity status.

```typescript
import { useNetworkStatus } from '../hooks/useNetworkStatus';

const { isOnline, isOffline } = useNetworkStatus();
```

### `useBiometricAuth.ts` — Biometric Authentication

Handles Face ID / fingerprint authentication.

```typescript
import { useBiometricAuth } from '../hooks/useBiometricAuth';

const { authenticate, isAvailable, isEnabled } = useBiometricAuth();

const success = await authenticate('Sign in with biometrics');
```

### `useHaptics.ts` — Haptic Feedback

Triggers vibration feedback for user actions.

```typescript
import { useHaptics } from '../hooks/useHaptics';

const { light, medium, heavy, success, error } = useHaptics();

success(); // Vibration for success action
error();   // Vibration for error action
```

### `useQueries.ts` — Parallel Data Fetching

Runs multiple API queries in parallel.

```typescript
import { useQueries } from '../hooks/useQueries';

const [hotels, bookings] = useQueries([
  { key: ['hotels'], fn: () => request('/hotels', { token }) },
  { key: ['bookings'], fn: () => request('/bookings', { token }) },
]);
// Both requests run simultaneously
```

## Common Usage Pattern

```tsx
import { useThemeColors } from '../../theme';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { useDebounce } from '../../hooks/useDebounce';

function SearchScreen() {
  const c = useThemeColors();
  const { isOnline } = useNetworkStatus();
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 300);

  useEffect(() => {
    if (isOnline && debouncedQuery) {
      searchHotels(debouncedQuery);
    }
  }, [debouncedQuery, isOnline]);

  return (
    <View>
      {!isOnline && <OfflineBanner />}
      <TextInput value={query} onChangeText={setQuery} />
    </View>
  );
}
```
