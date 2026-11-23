/**
 * Shared UI primitives for the AHDORA native app.
 * Mihrab palette (see src/lib/theme.ts): cream background, deep-green
 * headers and primary buttons, pale-green tint for soft surfaces.
 * Pill buttons, chips, 52x32 switch, green-head gradient, 3-col tile
 * grid, segmented control, status pills, progress bar, fields.
 */
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { C, F, S } from '../lib/theme';
import { DARK, useAppTheme } from '../lib/appTheme';

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

export type PillButtonVariant = 'primary' | 'peach' | 'ghost' | 'soft' | 'dark';

export function PillButton({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  busy = false,
  small = false,
  block = false,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: PillButtonVariant;
  disabled?: boolean;
  busy?: boolean;
  small?: boolean;
  block?: boolean;
  style?: object;
}) {
  const { animations } = useAppTheme();
  const btnStyle =
    variant === 'primary'
      ? styles.btnPrimary
      : variant === 'peach'
        ? styles.btnPeach
        : variant === 'ghost'
          ? styles.btnGhost
          : variant === 'soft'
            ? styles.btnSoft
            : styles.btnDark; // 'dark' kept only because Home.tsx uses it; preview has no dark button.
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
      style={({ pressed }) => [
        styles.btn,
        small && styles.btnSmall,
        block && styles.btnBlock,
        btnStyle,
        (disabled || busy) && styles.btnDisabled,
        pressed && animations && styles.btnPressed,
        style,
      ]}
      accessibilityRole="button"
    >
      {busy ? (
        <ActivityIndicator color={variant === 'ghost' || variant === 'soft' ? C.teal700 : C.white} />
      ) : (
        <Text style={[textStyle, small && styles.btnTextSmall]}>{label}</Text>
      )}
    </Pressable>
  );
}

export function ProgressBar({
  value,
  max,
  color = C.teal500,
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
  const isOn = !!selected;
  const { animations } = useAppTheme();
  const toneBg =
    tone === 'peach' ? C.peach : tone === 'red' ? C.missedBg : tone === 'muted' ? C.ice : C.white;
  const toneText =
    tone === 'peach' ? C.peachInk : tone === 'red' ? C.red : tone === 'muted' ? C.muted : C.ink;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.chip,
        { backgroundColor: isOn ? C.teal700 : toneBg },
        isOn && styles.chipOn,
        pressed && onPress && animations && styles.pressed,
      ]}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityState={selected !== undefined ? { selected } : undefined}
    >
      <Text style={[styles.chipText, { color: isOn ? C.white : toneText }]}>{label}</Text>
    </Pressable>
  );
}

/** 52x32 switch: track switchOff grey off / teal500 (green) on, white 26px knob. */
export function Switch({
  value,
  onValueChange,
  disabled = false,
}: {
  value: boolean;
  onValueChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={() => onValueChange(!value)}
      disabled={disabled}
      style={[
        styles.switchTrack,
        { backgroundColor: value ? C.teal500 : C.switchOff },
        disabled && styles.btnDisabled,
      ]}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
    >
      <View style={[styles.switchKnob, value && styles.switchKnobOn]} />
    </Pressable>
  );
}

/** Deep-green header block: teal900→teal700 (deep green → primary green) gradient, radius 24. */
export function TealHead({
  children,
  style,
}: {
  children: ReactNode;
  style?: object;
}) {
  return (
    <LinearGradient
      colors={[C.teal900, C.teal700]}
      start={{ x: 0, y: 0 }}
      end={{ x: 0.9, y: 1 }}
      style={[styles.tealHead, style]}
    >
      {children}
    </LinearGradient>
  );
}

/** 3-column tile grid (preview .tiles). */
export function TileGrid({ children }: { children: ReactNode }) {
  return <View style={styles.tiles}>{children}</View>;
}

/** One tile: white card, 42px icon chip in teal100 (tint); the `peach` prop (kept name) switches the chip to the tint surface. */
export function Tile({
  label,
  icon,
  onPress,
  peach = false,
  dark = false,
}: {
  label: string;
  icon: ReactNode;
  onPress: () => void;
  peach?: boolean;
  /** Dark-theme variant: dark navy card, light label. */
  dark?: boolean;
}) {
  const { animations } = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        dark && styles.tileDark,
        pressed && animations && styles.tilePressed,
      ]}
      accessibilityRole="button"
    >
      <View
        style={[styles.tileIcon, peach && styles.tileIconPeach, dark && !peach && styles.tileIconDark]}
      >
        {icon}
      </View>
      <Text style={[styles.tileLabel, dark && styles.tileLabelDark]}>{label}</Text>
    </Pressable>
  );
}

/** Segmented control: teal100 (tint) track, teal900 (deep green) active pill. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.segmented}>
      {options.map((opt) => {
        const on = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            style={[styles.segmentBtn, on && styles.segmentBtnOn]}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
          >
            <Text style={[styles.segmentText, on && styles.segmentTextOn]}>{opt.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export type PrayerStatus = 'prayed' | 'missed' | 'qaza' | 'not-yet' | 'none';

/** Status pill: prayed green/white, missed pink/red, qaza amber, not-yet plain. */
export function StatusPill({
  state,
  label,
  onPress,
}: {
  state: PrayerStatus;
  label?: string;
  onPress?: () => void;
}) {
  const { animations } = useAppTheme();
  const norm = state === 'none' ? 'not-yet' : state;
  const text =
    label ??
    (norm === 'prayed' ? 'Prayed' : norm === 'missed' ? 'Missed' : norm === 'qaza' ? 'Qaza' : 'Not yet');
  const style =
    norm === 'prayed'
      ? styles.statusPrayed
      : norm === 'missed'
        ? styles.statusMissed
        : norm === 'qaza'
          ? styles.statusQaza
          : styles.statusNotYet;
  const textStyle =
    norm === 'prayed'
      ? styles.statusTextPrayed
      : norm === 'missed'
        ? styles.statusTextMissed
        : norm === 'qaza'
          ? styles.statusTextQaza
          : styles.statusTextNotYet;
  if (!onPress) {
    return (
      <View style={[styles.statusPill, style]}>
        <Text style={textStyle}>{text}</Text>
      </View>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.statusPill, style, pressed && animations && styles.pressed]}
      accessibilityRole="button"
    >
      <Text style={textStyle}>{text}</Text>
    </Pressable>
  );
}

/** Field label: 12.5px bold teal700 (primary green). */
export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

/** Text input: radius 16, 1.5px line border, 13px/16px padding, 15px text. */
export function Input(props: TextInputProps) {
  return (
    <TextInput
      placeholderTextColor={C.muted}
      {...props}
      style={[styles.input, props.style]}
    />
  );
}

export function EmptyState({ title, body, dark = false }: { title: string; body?: string; dark?: boolean }) {
  return (
    <View style={styles.empty}>
      <Text style={[styles.emptyTitle, dark && styles.emptyTitleDark]}>{title}</Text>
      {body ? <Text style={[styles.emptyBody, dark && styles.emptyBodyDark]}>{body}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: C.white,
    borderRadius: S.radius,
    borderWidth: 1,
    borderColor: C.line,
    padding: 16,
    marginBottom: S.gap,
  },
  sectionHead: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10, marginTop: 18 },
  sectionTitle: { fontFamily: F.sans, fontSize: 19, fontWeight: '800', color: C.ink },
  sectionSub: { fontFamily: F.sans, fontSize: 14, color: C.muted, marginTop: 4, lineHeight: 22 },
  pressed: { transform: [{ scale: 0.96 }] },
  btn: {
    borderRadius: 999,
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
    paddingVertical: 13,
    marginBottom: 12,
  },
  btnSmall: { minHeight: 40, paddingHorizontal: 16, paddingVertical: 8 },
  btnBlock: { width: '100%' },
  btnPrimary: { backgroundColor: C.teal700 },
  btnPeach: { backgroundColor: C.peachMid },
  btnGhost: { backgroundColor: C.teal100 },
  btnSoft: { backgroundColor: C.white, borderWidth: 1, borderColor: C.line },
  btnDark: { backgroundColor: C.teal900 },
  btnDisabled: { opacity: 0.55 },
  btnPressed: { transform: [{ scale: 0.96 }] },
  btnTextLight: { fontFamily: F.sans, color: C.white, fontSize: 15, fontWeight: '800' },
  btnTextPeach: { fontFamily: F.sans, color: C.white, fontSize: 15, fontWeight: '800' },
  btnTextGhost: { fontFamily: F.sans, color: C.teal900, fontSize: 15, fontWeight: '800' },
  btnTextSmall: { fontSize: 13.5 },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: C.teal100,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 999 },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: C.line,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
    marginBottom: 8,
  },
  chipOn: { borderColor: C.teal700 },
  chipText: { fontFamily: F.sans, fontSize: 13, fontWeight: '700' },
  switchTrack: {
    width: 52,
    height: 32,
    borderRadius: 999,
    justifyContent: 'center',
    flexShrink: 0,
  },
  switchKnob: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: C.white,
    marginLeft: 3,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  switchKnobOn: { transform: [{ translateX: 20 }] },
  tealHead: {
    borderRadius: S.radiusLg,
    paddingHorizontal: 18,
    paddingVertical: 20,
    marginTop: 2,
  },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 },
  tile: {
    flexGrow: 1,
    flexBasis: '30%',
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 18,
    paddingHorizontal: 8,
    paddingTop: 14,
    paddingBottom: 12,
    alignItems: 'center',
    gap: 8,
    minHeight: 86,
  },
  tilePressed: { transform: [{ scale: 0.94 }] },
  tileDark: { backgroundColor: DARK.card, borderColor: DARK.border },
  tileIconDark: { backgroundColor: DARK.chip },
  tileLabelDark: { color: DARK.text },
  tileIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: C.teal100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileIconPeach: { backgroundColor: C.peach },
  tileLabel: {
    fontFamily: F.sans,
    fontSize: 12.5,
    fontWeight: '700',
    color: C.ink,
    textAlign: 'center',
  },
  segmented: {
    flexDirection: 'row',
    backgroundColor: C.teal100,
    borderRadius: 999,
    padding: 5,
    marginTop: 16,
  },
  segmentBtn: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentBtnOn: { backgroundColor: C.teal900 },
  segmentText: { fontFamily: F.sans, fontSize: 14.5, fontWeight: '800', color: C.teal900 },
  segmentTextOn: { color: C.white },
  statusPill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.white,
    paddingHorizontal: 12,
    paddingVertical: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusPrayed: { backgroundColor: C.teal500, borderColor: C.teal500 },
  statusMissed: { backgroundColor: C.missedBg, borderColor: C.missedBorder },
  statusQaza: { backgroundColor: C.qazaBg, borderColor: C.qazaBorder },
  statusNotYet: {},
  statusTextPrayed: { fontFamily: F.sans, fontSize: 12, fontWeight: '800', color: C.white },
  statusTextMissed: { fontFamily: F.sans, fontSize: 12, fontWeight: '800', color: C.red },
  statusTextQaza: { fontFamily: F.sans, fontSize: 12, fontWeight: '800', color: C.amber },
  statusTextNotYet: { fontFamily: F.sans, fontSize: 12, fontWeight: '800', color: C.muted },
  field: { marginTop: 14 },
  fieldLabel: {
    fontFamily: F.sans,
    fontSize: 12.5,
    fontWeight: '700',
    color: C.teal700,
    marginBottom: 6,
    marginLeft: 4,
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
    minHeight: 50,
  },
  empty: {
    backgroundColor: C.white,
    borderRadius: S.radius,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: C.line,
    padding: 18,
    marginBottom: S.gap,
  },
  emptyTitle: { fontFamily: F.sans, fontSize: 15, fontWeight: '700', color: C.ink },
  emptyTitleDark: { color: DARK.text },
  emptyBody: { fontFamily: F.sans, fontSize: 13, color: C.muted, marginTop: 4, lineHeight: 18 },
  emptyBodyDark: { color: DARK.muted },
});
