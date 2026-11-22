/**
 * Support & Feedback screen (Profile → Support & Feedback).
 *
 * The user (2026-11-22) pointed out that the redesign dropped the
 * Support & Feedback option entirely — the web app has it (Profile →
 * Help & support → FeedbackForm) and the server endpoint is real, so
 * it belongs here too. One screen does both jobs:
 *   - Send: type (Feedback / Complaint), subject, message →
 *     POST /api/feedback (201, status 'open'). Nothing is faked: a
 *     failed save shows the real server error, never a success.
 *   - My messages: GET /api/feedback lists only this user's own
 *     rows, newest first, with their status (open / in_progress /
 *     resolved). Statuses change only on the support side.
 */
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import type { ScreenProps } from '../lib/nav';
import { stringsFor } from '../lib/strings';
import { C, T } from '../lib/theme';
import { Card, Input, PillButton, SegmentedControl, TealHead } from '../components/ui';
import {
  listFeedback,
  submitFeedback,
  type FeedbackItem,
  type FeedbackType,
} from '../lib/apiSocial';

/** The business support mailbox (Cloudflare Email Routing →
 * affanali7001@gmail.com). Shown in Help Center so users can
 * email directly as well as sending in-app feedback. */
const SUPPORT_EMAIL = 'support@ahdora.me';

export default function SupportScreen({ lang }: ScreenProps) {
  const s = stringsFor(lang);
  const [type, setType] = useState<FeedbackType>('feedback');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setListError('');
    try {
      setItems(await listFeedback());
    } catch (e) {
      setListError(e instanceof Error ? e.message : s.errorGeneric);
    } finally {
      setLoading(false);
    }
  }, [s.errorGeneric]);

  useEffect(() => {
    void load();
  }, [load]);

  async function send() {
    if (busy) return;
    const sub = subject.trim();
    const msg = message.trim();
    if (sub.length < 3 || msg.length < 3) {
      setError(s.supTooShort);
      return;
    }
    setBusy(true);
    setError('');
    setSent(false);
    try {
      await submitFeedback({ type, subject: sub, message: msg });
      setSubject('');
      setMessage('');
      setSent(true);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : s.errorGeneric);
    } finally {
      setBusy(false);
    }
  }

  function statusLabel(status: string): string {
    if (status === 'in_progress') return s.supInProgress;
    if (status === 'resolved') return s.supResolved;
    return s.supOpen;
  }

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 24 }}>
      <TealHead style={{ marginTop: 14 }}>
        <Text style={{ fontFamily: 'PlusJakartaSans', fontSize: 20, fontWeight: '800', color: C.white }}>
          {s.supTitle}
        </Text>
        <Text style={{ fontFamily: 'PlusJakartaSans', fontSize: 13, color: '#BFD8CF', marginTop: 4 }}>
          {s.supSub}
        </Text>
      </TealHead>
      <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
        <Card>
          <Text style={T.cardTitle}>{s.supEmailT}</Text>
          <Text style={[T.cardBody, { marginTop: 6 }]}>{s.supEmailBody}</Text>
          <Pressable
            onPress={() => void Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}
            accessibilityRole="link"
            accessibilityLabel={SUPPORT_EMAIL}
            style={{ marginTop: 8 }}
          >
            <Text
              style={{
                fontFamily: 'PlusJakartaSans',
                fontSize: 15,
                fontWeight: '800',
                color: C.teal700,
              }}
            >
              {SUPPORT_EMAIL}
            </Text>
          </Pressable>
        </Card>

        <Card>
          <Text style={T.cardTitle}>{s.supSendTitle}</Text>
          <View style={{ marginTop: 12 }}>
            <SegmentedControl
              options={[
                { value: 'feedback', label: s.supFeedback },
                { value: 'complaint', label: s.supComplaint },
              ]}
              value={type}
              onChange={(v) => setType(v as FeedbackType)}
            />
          </View>
          <Input
            value={subject}
            onChangeText={setSubject}
            placeholder={s.supSubjectPh}
            autoCapitalize="sentences"
            style={{ marginTop: 12 }}
          />
          <Input
            value={message}
            onChangeText={setMessage}
            placeholder={s.supMessagePh}
            autoCapitalize="sentences"
            multiline
            numberOfLines={5}
            style={{ marginTop: 10, minHeight: 110, textAlignVertical: 'top' }}
          />
          {error ? <Text style={[T.error, { marginTop: 8 }]}>{error}</Text> : null}
          {sent ? (
            <Text style={[T.cardBody, { marginTop: 8, color: C.teal700, fontWeight: '700' }]}>
              {s.supSent}
            </Text>
          ) : null}
          <View style={{ marginTop: 12 }}>
            <PillButton
              label={s.supSendBtn}
              variant="primary"
              block
              onPress={() => void send()}
              disabled={busy}
              busy={busy}
            />
          </View>
          <Text style={[T.note, { marginTop: 10 }]}>{s.supNote}</Text>
        </Card>

        <Card>
          <Text style={T.cardTitle}>{s.supMineTitle}</Text>
          {loading ? (
            <ActivityIndicator color={C.teal700} style={{ marginVertical: 16 }} />
          ) : listError ? (
            <Text style={[T.error, { marginTop: 8 }]}>{listError}</Text>
          ) : items.length === 0 ? (
            <Text style={[T.cardBody, { marginTop: 6 }]}>{s.supNone}</Text>
          ) : (
            items.map((it) => (
              <View
                key={it.id}
                style={{
                  paddingVertical: 10,
                  borderBottomWidth: 1,
                  borderBottomColor: C.line,
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                  <Text style={[T.cardTitle, { fontSize: 14 }]}>{it.subject}</Text>
                  <Text style={[T.cardBody, { color: C.teal700, fontWeight: '700' }]}>
                    {statusLabel(it.status)}
                  </Text>
                </View>
                <Text style={[T.cardBody, { marginTop: 4 }]} numberOfLines={3}>
                  {it.message}
                </Text>
                <Text style={[T.cardBody, { marginTop: 4, color: C.muted }]}>
                  {it.type === 'complaint' ? s.supComplaint : s.supFeedback} ·{' '}
                  {new Date(it.createdAt).toLocaleDateString()}
                </Text>
              </View>
            ))
          )}
        </Card>
      </View>
    </ScrollView>
  );
}
