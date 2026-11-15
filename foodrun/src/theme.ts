/**
 * FoodRun design tokens — source: foodrun-context/CLAUDE.md §3.
 * Liquid-glass iOS look: frosted cards over a blurred navy/orange background.
 *
 * Contrast rules (WCAG):
 * - ink on mist 15.4:1, white on navy 12.5:1, navy on orange 5.1:1 — all pass.
 * - White on orange is 2.5:1 and FAILS. Never put white text on orange.
 *   Orange buttons always use navy text.
 */

export const colors = {
  /** Primary. Titles, key text, avatars, code tiles, active tab. */
  navy: '#12355B',
  /** Accent. ONLY tappable primary actions and "happening now" states. */
  orange: '#F28C28',
  /** App background base. */
  mist: '#F4F7FB',
  /** Body text. */
  ink: '#1B1F24',
  /** Glass card tint, text on navy. */
  white: '#FFFFFF',
  /** Secondary text. */
  muted: '#6B7686',
  /** Labels, inactive tabs. */
  faint: '#7C8798',
  /** Dividers, empty progress. */
  line: 'rgba(18,53,91,0.10)',
  /** Checkmarks only. */
  success: '#1E8E5A',
  /** Errors, destructive actions. */
  danger: '#C0392B',
} as const;

/** Background gradient stops (§3.2): vertical #EEF3F9 → #F4F7FB (45%) → #FBF3EA. */
export const backgroundGradient = {
  colors: ['#EEF3F9', '#F4F7FB', '#FBF3EA'] as const,
  locations: [0, 0.45, 1] as const,
};

/**
 * Soft blobs behind the glass (§3.2). Drawn as SVG radial gradients, so the
 * falloff is baked into the fill instead of coming from a live blur pass —
 * see AppBackground for why that matters.
 */
export const blobs = [
  { core: '#12355B', opacity: 0.26, size: 420, cx: '8%', cy: '4%' },
  { core: '#F28C28', opacity: 0.3, size: 380, cx: '104%', cy: '42%' },
  { core: '#12355B', opacity: 0.16, size: 360, cx: '-4%', cy: '88%' },
] as const;

/** Glass surface (§3.3). */
export const glass = {
  fill: 'rgba(255,255,255,0.62)',
  blurIntensity: 50, // expo-blur intensity ~40–60, tint "light"
  border: 'rgba(255,255,255,0.78)',
  shadow: {
    shadowColor: '#12355B',
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 14,
    shadowOpacity: 0.1,
    elevation: 4,
  },
  sheetFill: 'rgba(250,252,255,0.97)',
  sheetBlurIntensity: 60,
  toastFill: 'rgba(18,30,45,0.88)',
} as const;

/** Radii (§3.3). */
export const radius = {
  bigCard: 28,
  runCard: 24,
  field: 16,
  segmented: 12,
  pill: 999,
  sheetTop: 30,
  codeTile: 16,
} as const;

/** Type scale (§3.4). Font: Inter (fallback system). */
export const type = {
  largeTitle: { fontSize: 34, fontWeight: '700', letterSpacing: -1, color: colors.navy } as const,
  cardHeadline: { fontSize: 24, fontWeight: '700', letterSpacing: -0.6, color: colors.navy } as const,
  rowTitle: { fontSize: 17, fontWeight: '600', color: colors.ink } as const,
  body: { fontSize: 15, color: colors.ink } as const,
  secondary: { fontSize: 14, color: colors.muted } as const,
  eyebrow: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    color: colors.faint,
  } as const,
  heroNumber: {
    fontSize: 96,
    fontWeight: '700',
    letterSpacing: -5,
    color: colors.navy,
    fontVariant: ['tabular-nums'],
  } as const,
} as const;

export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semiBold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;

/** Layout (§3.7): one 20px left/right margin on every screen. */
export const layout = {
  screenMargin: 20,
  tabBarSide: 14,
  tabBarBottom: 18,
} as const;

/** Motion (§3.6). Respect Reduce Motion (cross-fade only). */
export const motion = {
  screenChange: { duration: 280, translateX: 18 },
  sheet: { duration: 300 }, // cubic-bezier(.2,.9,.3,1)
  pressScale: 0.97,
  joinPressScale: 0.94,
  progress: { duration: 500 },
  scanSweep: { duration: 1200 },
} as const;

/** Handoff code tiles (§3.4). */
export const codeTile = {
  small: { width: 56, height: 66, radius: 16, fontSize: 30 },
  big: { width: 66, height: 84, radius: 18, fontSize: 40 },
} as const;
