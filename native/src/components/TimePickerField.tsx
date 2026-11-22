/**
 * TimePickerField — a clock-style time picker (NOT a keyboard text input).
 *
 * The user asked for this explicitly (2026-11-22): timing must be
 * picked on a clock dial with AM/PM, never typed manually as HH:mm
 * on the keyboard. Uses @react-native-community/datetimepicker
 * (mode="time", 12-hour clock): on Android it opens the native
 * clock dial with an AM/PM selector; on iOS the native time wheels.
 *
 * The stored value stays "HH:mm" (24h, e.g. "22:30") so every
 * existing validator and the server contract are unchanged; the
 * field DISPLAYS it in 12h AM/PM ("10:30 PM") via formatTime12h.
 * An empty value shows the placeholder and opens the picker at a
 * sensible default (the placeholder time when it parses, else noon).
 */
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { formatTime12h } from '../lib/apiCore';
import { C } from '../lib/theme';

type Props = {
  /** Current value as "HH:mm" (24h). Empty string means "not set". */
  value: string;
  onChange: (hhmm: string) => void;
  placeholder?: string;
  editable?: boolean;
};

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

function toDate(value: string, fallback: string): Date {
  const src = HHMM.test(value) ? value : HHMM.test(fallback) ? fallback : '12:00';
  const [h, m] = src.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

function toHHMM(date: Date): string {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

export default function TimePickerField({ value, onChange, placeholder, editable = true }: Props) {
  const [open, setOpen] = useState(false);

  function handleChange(event: DateTimePickerEvent, selected?: Date) {
    // Android fires once with type 'dismissed' when the user backs
    // out — close without changing the value. On 'set', keep the
    // picked time. (iOS fires on every wheel move; the picker stays
    // open until the user taps elsewhere, which is the native UX.)
    if (event.type === 'dismissed') {
      setOpen(false);
      return;
    }
    if (selected) onChange(toHHMM(selected));
    // On Android the picker closes itself after a pick; on iOS the
    // user dismisses it by tapping the field again / elsewhere.
    if (event.type === 'set') setOpen(false);
  }

  const display = value ? formatTime12h(value) : (placeholder ?? '');
  return (
    <View>
      <Pressable
        onPress={() => {
          if (editable) setOpen(true);
        }}
        accessibilityRole="button"
        style={[styles.field, !editable && styles.disabled]}
      >
        <Text style={[styles.text, !value && styles.placeholder]}>{display || '—'}</Text>
        <Text style={styles.clock}>🕐</Text>
      </Pressable>
      {open ? (
        <DateTimePicker
          value={toDate(value, placeholder ?? '')}
          mode="time"
          is24Hour={false}
          display="default"
          onChange={handleChange}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  disabled: { opacity: 0.6 },
  text: { fontSize: 15, color: C.ink },
  placeholder: { color: C.muted },
  clock: { fontSize: 16, marginLeft: 8 },
});
