/**
 * Design system for the AHDORA native app.
 *
 * Palette — MIHRAB app UI, sampled from the Mihrab app screenshots
 * (~/workspace/user/media_library/image/, 2026-11-23 11:33–11:34) with
 * PIL pixel sampling — every value below traces to a screenshot:
 * - Primary green #1F5E49 — the "Morning" pill (11-33-34-88 Duas)
 *   and the "Unmark today" button (11-33-54-21 Fasting), both
 *   sampled twice; the marketing green behind them is #1E5D48.
 * - Deep green #0F4C44 — the Mihrab logo tile (11-33-31-61).
 * - Cream background #FAF7F2 — Duas screen bg (11-33-34-88) and
 *   Hifz screen bg (11-34-04-76), both sampled.
 * - Pale green tint #E2EEEA — "Fast kept" card (11-33-54-21) and
 *   the selected Translation tab (11-33-57-50), both sampled.
 * - Ink #191814 — Fasting/Duas titles; muted grey #888682 — Duas
 *   transliteration; bronze #847147 — "Juz" label (11-33-31-61).
 * - Dark navy #232C49 — Tilawah player card (11-33-42-51); dark
 *   navy bg #1D2441 + card #0F1630 + nav #161D37, light-blue accent
 *   #87A5D9 (play button) and muted #949AB3 (nav labels), all from
 *   the dark Home in 11-34-04-76.
 * The old Ice White / Deep Teal / Soft Peach palette is retired:
 * the `peach*` token names stay as aliases (screens use them) but
 * now point at the green tint — NO gold anywhere. The dark navy
 * Tilawah player card stays navy, as in the screenshots.
 */
import { StyleSheet } from 'react-native';

export const C = {
  // Mihrab palette (sampled — see the header comment for sources).
  green: '#1F5E49', // primary green — headers, buttons, selected pills
  greenDeep: '#0F4C44', // deep green — header gradient, pill nav, dark cards
  cream: '#FAF7F2', // cream/off-white app background
  tint: '#E2EEEA', // pale green tint — selected tabs, soft cards, hairlines
  bronze: '#847147', // muted bronze accent — mushaf "Juz" labels
  navy: '#232C49', // dark navy — Tilawah player card (stays navy)
  skyBlue: '#87A5D9', // light blue — accents on the navy player / dark mode
  mushafBg: '#FFFFFF', // mushaf page (sampled white, 11-33-31-61)
  mushafInk: '#191814',
  // Legacy token names — same values as above, so every screen that
  // already uses them picks up the Mihrab palette with no edits.
  ice: '#FAF7F2', // = cream
  white: '#FFFFFF',
  ink: '#191814',
  muted: '#888682',
  teal950: '#0F4C44', // = greenDeep
  teal900: '#0F4C44', // = greenDeep
  teal700: '#1F5E49', // = green
  teal500: '#1F5E49', // = green
  teal100: '#E2EEEA', // = tint
  peach: '#E2EEEA', // retired: soft peach is now the pale green tint
  peachMid: '#1F5E49', // retired: peach accent is now the primary green
  peachInk: '#1F5E49', // retired: dark text on tint
  red: '#C2402E',
  amber: '#B97A12',
  line: '#E2EEEA', // = tint
  // Preview extras.
  switchOff: '#9CA2AE', // sampled Mihrab toggle-off track (11-33-54-21)
  navInactive: '#E2EEEA', // pale tint text on the deep-green header/nav
  peachText: '#1F5E49', // = green (dark text on tint surfaces)
  missedBg: '#FADFD9',
  missedBorder: '#F0B7AA',
  qazaBg: '#FCE9C8',
  qazaBorder: '#EBCB8B',
  // Aliases kept for screens written before the redesign — same values.
  teal: '#1F5E49', // = teal700
  teal2: '#1F5E49', // = teal500
  peach2: '#E2EEEA', // = tint
  peachDeep: '#1F5E49', // = peachInk
} as const;

export const S = {
  pad: 18,
  radius: 20, // card radius (preview .card)
  radiusSm: 16, // input radius (preview .field input)
  radiusLg: 24, // teal-head radius
  gap: 12,
  // Top clearance INSIDE the root SafeAreaView (which now supplies
  // the real status-bar inset on Android — see App.tsx). 20 + the
  // real inset ≈ the old 52 on a normal phone, without pushing
  // buttons under the status bar on tall-notch phones.
  screenTop: 20,
  screenBottom: 24, // pill nav is in-flow now (was 108 for the floating pill)
} as const;

/**
 * Font families. Loaded in App.tsx via expo-font `useFonts` with the
 * FontFamilyDefinition array form (SDK 58 docs), so one family name covers
 * all weights and `fontWeight` selects the face.
 * - sans: Plus Jakarta Sans 400/500/600/700/800 (@expo-google-fonts/plus-jakarta-sans)
 * - arabic: Amiri 400/700 (@expo-google-fonts/amiri)
 */
export const F = {
  sans: 'PlusJakartaSans',
  arabic: 'Amiri',
} as const;

/** Shared text styles (preview typography: H1 26/800, H2 19/800, sub 14/1.55). */
export const T = StyleSheet.create({
  eyebrow: {
    fontFamily: F.sans,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
    color: C.muted,
    textTransform: 'uppercase',
  },
  title: {
    fontFamily: F.sans,
    fontSize: 26,
    fontWeight: '800',
    color: C.ink,
    letterSpacing: -0.5,
    lineHeight: 31,
  },
  h2: {
    fontFamily: F.sans,
    fontSize: 19,
    fontWeight: '800',
    color: C.ink,
    letterSpacing: -0.2,
  },
  sub: {
    fontFamily: F.sans,
    fontSize: 14,
    color: C.muted,
    marginTop: 6,
    lineHeight: 22, // 14 * 1.55
  },
  cardTitle: {
    fontFamily: F.sans,
    fontSize: 15.5,
    fontWeight: '800',
    color: C.ink,
  },
  cardBody: {
    fontFamily: F.sans,
    fontSize: 14,
    color: C.muted,
    lineHeight: 20,
  },
  label: {
    fontFamily: F.sans,
    fontSize: 12.5,
    fontWeight: '700',
    color: C.teal700,
    marginBottom: 6,
  },
  arabic: { fontFamily: F.arabic },
  error: {
    fontFamily: F.sans,
    fontSize: 13,
    color: C.red,
    marginTop: 10,
    lineHeight: 18,
  },
  note: {
    fontFamily: F.sans,
    fontSize: 13,
    color: C.muted,
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 18,
  },
});

/** Shared container / surface styles (preview .screen / .card / .field input). */
export const L = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.ice },
  scroll: {
    paddingHorizontal: S.pad,
    paddingTop: S.screenTop,
    paddingBottom: S.screenBottom,
  },
  scrollNoNav: {
    paddingHorizontal: S.pad,
    paddingTop: S.screenTop,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: C.white,
    borderRadius: S.radius,
    borderWidth: 1,
    borderColor: C.line,
    padding: 16,
  },
  input: {
    fontFamily: F.sans,
    backgroundColor: C.white,
    borderWidth: 1.5,
    borderColor: C.line,
    borderRadius: S.radiusSm,
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontSize: 15,
    color: C.ink,
    marginBottom: 4,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
});
