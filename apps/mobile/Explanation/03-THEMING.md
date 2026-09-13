# Theme System

## Files

| File | Purpose |
|------|---------|
| `theme.ts` | All color tokens, typography, spacing, shadows |

## How It Works

The theme system provides **two complete color palettes** (light and dark) that share the same semantic structure. A React hook picks the right one based on the device's color scheme.

```typescript
import { useThemeColors } from '../../theme';

function MyScreen() {
  const c = useThemeColors();  // Returns light or dark palette
  const s = useMemo(() => makeStyles(c), [c]);  // Memoized styles

  return <View style={s.container}>...</View>;
}
```

## Color Palette

### Light Mode
| Token | Value | Usage |
|-------|-------|-------|
| `c.paper` | `#F5F6F8` | Page background |
| `c.surface` | `#FFFFFF` | Cards, sheets |
| `c.paperDeep` | `#ECEDF1` | Elevated surfaces |
| `c.clay` | `#E0E3E8` | Borders, dividers |
| `c.ink` | `#1A2332` | Primary text |
| `c.inkSoft` | `#4A5568` | Secondary text |
| `c.inkMuted` | `#8E9BB0` | Tertiary text |
| `c.teal` | `#0F8A83` | Primary accent |
| `c.gold` | `#C8983A` | Gold accent |
| `c.brick` | `#DC2626` | Error/danger |
| `c.success` | `#16A34A` | Success states |
| `c.warning` | `#D97706` | Warning states |
| `c.info` | `#2563EB` | Info states |

### Dark Mode
| Token | Value | Usage |
|-------|-------|-------|
| `c.paper` | `#0B1929` | Page background (deepest) |
| `c.surface` | `#142A42` | Cards |
| `c.paperDeep` | `#102035` | Elevated surfaces |
| `c.clay` | `#1A3350` | Highest elevation |
| `c.ink` | `#E4EAF0` | Primary text (soft white) |
| `c.inkSoft` | `#8DA4BD` | Secondary text |
| `c.inkMuted` | `#546A82` | Tertiary text |
| `c.teal` | `#14B8A6` | Primary accent (brighter for dark bg) |
| `c.gold` | `#E2B94A` | Gold accent |
| `c.brick` | `#F87171` | Error/danger |
| `c.success` | `#16A34A` | Success states |
| `c.warning` | `#D97706` | Warning states |
| `c.info` | `#60A5FA` | Info states |

## Surface Hierarchy (Dark Mode)

```
Darkest  →  paper (#0B1929)      ← Page background
           →  paperDeep (#102035) ← Elevated sections
           →  surface (#142A42)   ← Cards
           →  clay (#1A3350)      ← Highest elevation (modals, dropdowns)
Lightest
```

## Pattern for Every Screen

```tsx
import React, { useMemo } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { useThemeColors } from '../../theme';

export default function MyScreen() {
  const c = useThemeColors();
  const s = useMemo(() => makeStyles(c), [c]);

  return (
    <View style={s.root}>
      <Text style={s.title}>Hello</Text>
    </View>
  );
}

const makeStyles = (c: ReturnType<typeof useThemeColors>) => StyleSheet.create({
  root:  { flex: 1, backgroundColor: c.paper },
  title: { color: c.ink, fontSize: 16 },
});
```

## Typography

```typescript
import { font } from '../../theme';

// Serif display font (headings)
font.display  // Georgia / serif

// System sans-serif (body text)
font.sans     // System / sans-serif

// Monospace (code, IDs)
font.mono     // Menlo / monospace
```

## Spacing (4px grid)

```typescript
import { sp } from '../../theme';

sp[1]  // 4px
sp[2]  // 8px
sp[3]  // 12px
sp[4]  // 16px
sp[5]  // 20px
sp[6]  // 24px
sp[8]  // 32px
sp[10] // 40px
sp[12] // 48px
```

## Shadows

```typescript
import { shadowCard, shadowMd } from '../../theme';

// Subtle card shadow
<View style={[styles.card, shadowCard]}>

// Medium elevation shadow
<View style={[styles.dropdown, shadowMd]}>
```
