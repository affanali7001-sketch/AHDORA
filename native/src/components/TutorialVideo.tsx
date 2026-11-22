/**
 * Tutorial video card (expo-video). Streams the mp4 from its URL —
 * the files are small (under 1.5 MB) so they play on slow mobile data.
 * Native playback controls are shown, so the user can play/pause and
 * go fullscreen. No autoplay: the user taps play.
 */
import { StyleSheet, Text, View } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { C, F } from '../lib/theme';

export default function TutorialVideo({
  url,
  title,
  note,
}: {
  url: string;
  title: string;
  note?: string;
}) {
  const player = useVideoPlayer(url, (p) => {
    p.loop = false;
  });
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{title}</Text>
      <VideoView
        style={styles.video}
        player={player}
        fullscreenOptions={{ enable: true }}
        contentFit="contain"
      />
      {note ? <Text style={styles.note}>{note}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 20 },
  title: {
    fontFamily: F.sans,
    fontSize: 16.5,
    fontWeight: '800',
    color: C.ink,
    marginBottom: 10,
  },
  video: {
    width: '100%',
    aspectRatio: 9 / 16,
    maxHeight: 520,
    backgroundColor: C.teal950,
    borderRadius: 20,
    overflow: 'hidden',
  },
  note: {
    fontFamily: F.sans,
    fontSize: 13,
    color: C.muted,
    marginTop: 8,
    lineHeight: 20,
  },
});
