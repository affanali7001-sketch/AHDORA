/**
 * Design system for the AHDORA native app.
 *
 * Palette — EXACT preview tokens (~/workspace/ts-spaces/ahdora-ui-preview/index.html,
 * phone vars, lines 84-86). Ice White / Deep Teal / Soft Peach. NO gold anywhere.
 */
import { StyleSheet } from 'react-native';

export const C = {
  ice: '#F4F8F6',
  white: '#FFFFFF',
  ink: '#152420',
  muted: '#5E7267',
  teal950: '#06302A',
  teal900: '#07332E',
  teal700: '#0B4A41',
  teal500: '#0E7A64',
  teal100: '#DDEEE8',
  peach: '#FBD9BE',
  peachMid: '#F6A96B',
  peachInk: '#8A4416',
  red: '#C2402E',
  amber: '#B97A12',
  line: '#E0EAE4',
  // Preview extras.
  switchOff: '#CBD8D1',
  navInactive: '#BFD8CF',
  peachText: '#4A2405',
  missedBg: '#FADFD9',
  missedBorder: '#F0B7AA',
  qazaBg: '#FCE9C8',
  qazaBorder: '#EBCB8B',
  // Aliases kept for screens written before the redesign — same preview values.
  teal: '#0B4A41', // = teal700
  teal2: '#0E7A64', // = teal500
  peach2: '#FDEBD9', // preview peach-soft
  peachDeep: '#8A4416', // = peachInk
} as const;

export const S = {
  pad: 18,
  radius: 20, // card radius (preview .card)
  radiusSm: 16, // input radius (preview .field input)
  radiusLg: 24, // teal-head radius
  gap: 12,
  screenTop: 52,
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
