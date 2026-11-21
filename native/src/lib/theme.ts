/**
 * Design system for the AHDORA native app.
 *
 * Palette (exact, approved): Ice White / Deep Teal / Soft Peach.
 * NO gold anywhere.
 */
import { StyleSheet } from 'react-native';

export const C = {
  ice: '#F5F7F6',
  white: '#FFFFFF',
  ink: '#0E1A17',
  muted: '#687A75',
  teal950: '#06231F',
  teal900: '#0A352F',
  teal: '#0B4F4A',
  teal2: '#0F766E',
  peach: '#FFD9BE',
  peach2: '#FFF1E3',
  peachDeep: '#B45309',
  red: '#E11D2E',
  line: '#E6ECE9',
} as const;

export const S = {
  pad: 20,
  radius: 24,
  radiusSm: 16,
  gap: 12,
} as const;

/** Shared text styles. */
export const T = StyleSheet.create({
  eyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
    color: C.muted,
    textTransform: 'uppercase',
  },
  title: { fontSize: 28, fontWeight: '800', color: C.ink, letterSpacing: -0.5 },
  sub: { fontSize: 15, color: C.muted, marginTop: 6, lineHeight: 21 },
  cardTitle: { fontSize: 17, fontWeight: '800', color: C.ink },
  cardBody: { fontSize: 14, color: C.muted, lineHeight: 20 },
  label: { fontSize: 13, fontWeight: '700', color: C.ink, marginBottom: 6 },
  error: { fontSize: 13, color: C.red, marginTop: 10, lineHeight: 18 },
  note: { fontSize: 13, color: C.muted, textAlign: 'center', marginTop: 10, lineHeight: 18 },
});

/** Shared container / surface styles. */
export const L = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.ice },
  scroll: { paddingHorizontal: S.pad, paddingTop: 24, paddingBottom: 120 },
  scrollNoNav: { paddingHorizontal: S.pad, paddingTop: 24, paddingBottom: 40 },
  card: {
    backgroundColor: C.white,
    borderRadius: S.radius,
    borderWidth: 1,
    borderColor: C.line,
    padding: 18,
  },
  input: {
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: C.ink,
    marginBottom: 4,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
});
