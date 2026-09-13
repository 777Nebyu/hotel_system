/**
 * useResponsive — OT.md compliant responsive system
 *
 * Breakpoints from OT.md §24:
 *   320–359   compact
 *   360–389   standard mobile
 *   390–430   comfortable mobile
 *   431–599   large phone / small tablet
 *   600–767   tablet compact
 *   768+      tablet
 *
 * Usage:
 *   const r = useResponsive();
 *   style={{ padding: r.pad, fontSize: r.body }}
 */

import { useMemo } from 'react';
import { Dimensions, useWindowDimensions } from 'react-native';

// ─── Breakpoint enum ─────────────────────────────────────────────────────────
export type Breakpoint =
  | 'compact'       // 320–359
  | 'standard'      // 360–389
  | 'comfortable'   // 390–430
  | 'largePhone'    // 431–599
  | 'tabletCompact' // 600–767
  | 'tablet';       // 768+

export interface ResponsiveValues {
  // ── Viewport
  width:      number;
  height:     number;
  bp:         Breakpoint;
  isCompact:  boolean;  // 320–359 — need the most care
  isSmall:    boolean;  // ≤ 389
  isStandard: boolean;  // 360–389
  isLarge:    boolean;  // 390–430
  isTablet:   boolean;  // ≥ 600

  // ── Horizontal padding (OT.md §5)
  // small: 16, standard: 16, large: 20, tablet: 24
  pad:        number;
  padSm:      number;  // tight contexts (card inner padding)
  padLg:      number;  // section spacer

  // ── Vertical spacing (OT.md §27 spacing system)
  sp2:  number;  //  8
  sp3:  number;  // 12
  sp4:  number;  // 16
  sp5:  number;  // 20
  sp6:  number;  // 24
  sp8:  number;  // 32

  // ── Typography scale (OT.md §8)
  // screenTitle:  24–30
  // sectionTitle: 20–24
  // cardTitle:    16–18
  // body:         14–16
  // secondary:    12–14
  screenTitle:   number;
  sectionTitle:  number;
  cardTitle:     number;
  body:          number;
  bodySmall:     number;
  caption:       number;

  // ── Touch targets (OT.md §9) — min 44, prefer 48
  hit:    number;  // min touch target
  hitLg:  number;  // preferred

  // ── Card image heights — consistent aspect ratios
  hotelImageH: number;  // hotel list card image
  galleryMainH:number;  // hotel detail hero gallery

  // ── Column layout helpers
  cols: (count: number) => number;  // returns item width for N columns
  half: number;                     // ~50% minus pad
}

function getBreakpoint(w: number): Breakpoint {
  if (w < 360)  return 'compact';
  if (w < 390)  return 'standard';
  if (w < 431)  return 'comfortable';
  if (w < 600)  return 'largePhone';
  if (w < 768)  return 'tabletCompact';
  return 'tablet';
}

export function useResponsive(): ResponsiveValues {
  const { width, height } = useWindowDimensions();

  return useMemo<ResponsiveValues>(() => {
    const bp = getBreakpoint(width);
    const isCompact  = bp === 'compact';
    const isSmall    = width < 390;
    const isStandard = bp === 'standard';
    const isLarge    = bp === 'comfortable' || bp === 'largePhone';
    const isTablet   = bp === 'tabletCompact' || bp === 'tablet';

    // Horizontal padding
    const pad   = width < 360 ? 16 : width < 390 ? 16 : width < 431 ? 20 : width < 600 ? 20 : 24;
    const padSm = width < 360 ? 12 : 14;
    const padLg = width < 360 ? 20 : width < 390 ? 24 : 28;

    // Vertical spacing — base 4px grid
    const sp2 = 8;
    const sp3 = 12;
    const sp4 = 16;
    const sp5 = 20;
    const sp6 = 24;
    const sp8 = 32;

    // Typography — scale within OT.md bounds
    const screenTitle  = width < 360 ? 24 : width < 390 ? 26 : width < 431 ? 28 : 30;
    const sectionTitle = width < 360 ? 20 : width < 390 ? 21 : 22;
    const cardTitle    = width < 360 ? 15 : width < 390 ? 16 : 17;
    const body         = width < 360 ? 14 : 15;
    const bodySmall    = width < 360 ? 13 : 14;
    const caption      = width < 360 ? 11 : 12;

    // Touch targets
    const hit   = 44;
    const hitLg = 48;

    // Image heights — 16:9-ish with clamped bounds
    const hotelImageH  = Math.round(Math.min(Math.max((width - pad * 2) * 0.5625, 180), 240));
    const galleryMainH = Math.round(Math.min(Math.max((width) * 0.56, 220), 320));

    // Column helpers
    const cols = (count: number) =>
      Math.floor((width - pad * 2 - (count - 1) * sp3) / count);

    const half = cols(2);

    return {
      width, height, bp,
      isCompact, isSmall, isStandard, isLarge, isTablet,
      pad, padSm, padLg,
      sp2, sp3, sp4, sp5, sp6, sp8,
      screenTitle, sectionTitle, cardTitle, body, bodySmall, caption,
      hit, hitLg,
      hotelImageH, galleryMainH,
      cols, half,
    };
  }, [width, height]);
}

// ─── Static snapshot (outside component, for StyleSheet.create contexts) ─────
// Used when a hook can't be called (e.g. inside a pure function).
export function getResponsiveSnapshot(): Pick<
  ResponsiveValues,
  'pad' | 'body' | 'caption' | 'cardTitle' | 'hit'
> {
  const w = Dimensions.get('window').width;
  return {
    pad:       w < 360 ? 16 : w < 390 ? 16 : 20,
    body:      w < 360 ? 14 : 15,
    caption:   w < 360 ? 11 : 12,
    cardTitle: w < 360 ? 15 : 16,
    hit:       44,
  };
}
