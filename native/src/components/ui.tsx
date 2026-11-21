/**
 * Shared UI primitives for the AHDORA native app.
 * Clean, premium, spacious — Ice White / Deep Teal / Soft Peach, no gold.
 */
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { C, S } from '../lib/theme';

export function Card({
  children,
  style,
}: {
  children: ReactNode;
  style?: object;
}) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({
  title,
  sub,
  action,
}: {
  title: string;
  sub?: string;
  action?: ReactNode;
}) {
  return (
    <View style={styles.sectionHead}>
      <View style={{ flex: 1 }}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {sub ? <Text style={styles.sectionSub}>{sub}</Text> : null}
      </View>
      {action}
    </View>
  );
}

export function PillButton({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  busy = false,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'peach' | 'ghost' | 'dark';
  disabled?: boolean;
  busy?: boolean;
}) {
  const style =
    variant === 'primary'
      ? styles.btnPrimary
      : variant === 'peach'
        ? styles.btnPeach
        : variant === 'dark'
          ? styles.btnDark
          : styles.btnGhost;
  const textStyle =
    variant === 'primary' || variant === 'dark'
      ? styles.btnTextLight
      : variant === 'peach'
        ? styles.btnTextPeach
        : styles.btnTextGhost;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      style={[styles.btn, style, (disabled || busy) && styles.btnDisabled]}
      accessibilityRole="button"
    >
      {busy ? (
        <ActivityIndicator color={variant === 'ghost' ? C.teal : C.white} />
      ) : (
        <Text style={textStyle}>{label}</Text>
      )}
    </Pressable>
  );
}

export function ProgressBar({
  value,
  max,
  color = C.teal2,
}: {
  value: number;
  max: number;
  color?: string;
}) {
  const pct = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${pct * 100}%`, backgroundColor: color }]} />
    </View>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  tone = 'teal',
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  tone?: 'teal' | 'peach' | 'red' | 'muted';
}) {
  const toneBg =
    tone === 'peach' ? C.peach2 : tone === 'red' ? '#FDECEC' : tone === 'muted' ? C.ice : '#E6F2F0';
  const toneText =
    tone === 'peach' ? C.peachDeep : tone === 'red' ? C.red : tone === 'muted' ? C.muted : C.teal;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={[
        styles.chip,
        { backgroundColor: selected ? C.teal950 : toneBg },
      ]}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityState={selected !== undefined ? { selected } : undefined}
    >
      <Text style={[styles.chipText, { color: selected ? C.white : toneText }]}>{label}</Text>
    </Pressable>
  );
}

export function EmptyState({ title, body }: { title: string; body?: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>{title}</Text>
      {body ? <Text style={styles.emptyBody}>{body}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: C.white,
    borderRadius: S.radius,
    borderWidth: 1,
    borderColor: C.line,
    padding: 18,
    marginBottom: S.gap,
  },
  sectionHead: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10, marginTop: 18 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: C.ink },
  sectionSub: { fontSize: 13, color: C.muted, marginTop: 2, lineHeight: 18 },
  btn: {
    borderRadius: 999,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  btnPrimary: { backgroundColor: C.teal },
  btnPeach: { backgroundColor: C.peach },
  btnDark: { backgroundColor: C.teal950 },
  btnGhost: { backgroundColor: C.white, borderWidth: 1, borderColor: C.line },
  btnDisabled: { opacity: 0.55 },
  btnTextLight: { color: C.white, fontSize: 16, fontWeight: '800' },
  btnTextPeach: { color: C.teal950, fontSize: 16, fontWeight: '800' },
  btnTextGhost: { color: C.teal, fontSize: 16, fontWeight: '800' },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: C.line,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 999 },
  chip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginRight: 8,
    marginBottom: 8,
  },
  chipText: { fontSize: 13, fontWeight: '700' },
  empty: {
    backgroundColor: C.white,
    borderRadius: S.radius,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: C.line,
    padding: 18,
    marginBottom: S.gap,
  },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: C.ink },
  emptyBody: { fontSize: 13, color: C.muted, marginTop: 4, lineHeight: 18 },
});
