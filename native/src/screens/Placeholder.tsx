/**
 * Fallback for an unknown screen id. All 24 real screens are wired
 * in App.tsx, so this should never render; if it does, it says so
 * honestly instead of promising a screen that is "coming soon".
 */
import { ScrollView, Text } from 'react-native';
import type { ScreenProps } from '../lib/nav';
import { stringsFor } from '../lib/strings';
import { L, T } from '../lib/theme';
import { EmptyState } from '../components/ui';

export default function PlaceholderScreen({ lang }: ScreenProps) {
  const s = stringsFor(lang);
  return (
    <ScrollView contentContainerStyle={L.scrollNoNav} showsVerticalScrollIndicator={false}>
      <Text style={[T.title, { marginBottom: 16 }]}>{s.screenNotFound}</Text>
      <EmptyState title={s.screenNotFound} body={s.screenNotFoundBody} />
    </ScrollView>
  );
}
