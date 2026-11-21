/**
 * Temporary stand-in for screens owned by other Phase 2 workers
 * (Quran, Focus, Profile, Study, …). It shows an honest "coming soon"
 * instead of fake content. Each worker replaces its usage in App.tsx
 * with their real screen import when their file lands.
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
      <Text style={[T.title, { marginBottom: 16 }]}>{s.comingSoon}</Text>
      <EmptyState title={s.comingSoon} body={s.comingSoonBody} />
    </ScrollView>
  );
}
