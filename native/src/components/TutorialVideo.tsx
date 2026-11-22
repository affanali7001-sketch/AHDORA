/**
 * Tutorial video card (expo-video). Streams the mp4 from its URL.
 *
 * Fixed 2026-11-22 (user: "video nahi chal rhi hai"): the old
 * version gave the player a Google Drive `uc` link (a 303 redirect
 * to drive.usercontent) and NO way to start it — the player never
 * autoplays and the only affordance was the native controls, so on
 * a slow connection the video just sat black. Now:
 * - the URL is the DIRECT drive.usercontent link (no redirect),
 * - a big tap-to-play button sits over the video (tapping it calls
 *   player.play()),
 * - while buffering it shows a spinner + "load ho raha hai",
 * - on error it shows a message with Retry and "Browser mein kholo"
 *   (opens the Drive link in the browser as a fallback).
 * No autoplay: the user taps play. The files are small (under
 * 1.5 MB after the 2026-11-22 re-encode) so they start on slow
 * mobile data.
 */
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { VideoView, useVideoPlayer, type VideoPlayerStatus } from 'expo-video';
import { C, F } from '../lib/theme';
import { PillButton } from './ui';

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
  const [status, setStatus] = useState<VideoPlayerStatus>(player.status);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const statusSub = player.addListener('statusChange', (event) => {
      setStatus(event.status);
    });
    const playingSub = player.addListener('playingChange', (event) => {
      setPlaying(event.isPlaying);
    });
    return () => {
      statusSub.remove();
      playingSub.remove();
    };
  }, [player]);

  function retry() {
    player.replace(url);
    player.play();
  }

  const showOverlay = !playing;
  const isError = status === 'error';

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.videoWrap}>
        <VideoView
          style={styles.video}
          player={player}
          fullscreenOptions={{ enable: true }}
          contentFit="contain"
        />
        {showOverlay ? (
          <View style={styles.overlay} pointerEvents="box-none">
            {isError ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>
                  Video load nahi ho paya. Internet check karo aur dobara try karo.
                </Text>
                <View style={styles.errorBtns}>
                  <PillButton label="Dobara try karo" small onPress={retry} />
                  <PillButton
                    label="Browser mein kholo"
                    small
                    variant="ghost"
                    onPress={() => void Linking.openURL(url)}
                  />
                </View>
              </View>
            ) : status === 'loading' ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator color={C.white} size="large" />
                <Text style={styles.loadingText}>Video load ho raha hai…</Text>
              </View>
            ) : (
              <Pressable
                onPress={() => player.play()}
                style={styles.playBtn}
                accessibilityRole="button"
                accessibilityLabel="Play video"
              >
                <Text style={styles.playIcon}>▶</Text>
              </Pressable>
            )}
          </View>
        ) : null}
      </View>
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
  videoWrap: {
    position: 'relative',
    width: '100%',
    aspectRatio: 9 / 16,
    maxHeight: 520,
    backgroundColor: C.teal950,
    borderRadius: 20,
    overflow: 'hidden',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(11,74,65,0.85)',
    borderWidth: 2,
    borderColor: C.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playIcon: {
    fontSize: 28,
    color: C.white,
    marginLeft: 4,
  },
  loadingBox: {
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 24,
  },
  loadingText: {
    fontFamily: F.sans,
    fontSize: 13.5,
    fontWeight: '700',
    color: C.white,
    textAlign: 'center',
  },
  errorBox: {
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 24,
  },
  errorText: {
    fontFamily: F.sans,
    fontSize: 13.5,
    fontWeight: '700',
    color: C.white,
    textAlign: 'center',
    lineHeight: 20,
  },
  errorBtns: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  note: {
    fontFamily: F.sans,
    fontSize: 13,
    color: C.muted,
    marginTop: 8,
    lineHeight: 20,
  },
});
