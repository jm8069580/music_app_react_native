import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { usePlayerStore } from '../services/player/playerStore';

type Props = {
  videoUri: string;
};

export default function VideoPlayer({ videoUri }: Props) {
  const positionMillis = usePlayerStore((s) => s.positionMillis);
  const videoMode = usePlayerStore((s) => s.videoMode);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const videoPlayer = useVideoPlayer(videoUri, (player) => {
    player.currentTime = positionMillis / 1000;
    player.showNowPlayingNotification = false;
    player.staysActiveInBackground = false;
  });
  const syncedRef = useRef(false);

  useEffect(() => {
    if (!videoMode) {
      videoPlayer.pause();
      return;
    }
    if (!syncedRef.current) {
      videoPlayer.currentTime = positionMillis / 1000;
      syncedRef.current = true;
    }
    videoPlayer.play();
  }, [videoMode]);

  useEffect(() => {
    if (videoMode) {
      if (isPlaying) {
        videoPlayer.play();
      } else {
        videoPlayer.pause();
      }
    }
  }, [isPlaying, videoMode]);

  useEffect(() => {
    if (videoMode && positionMillis > 0) {
      const diff = Math.abs(videoPlayer.currentTime * 1000 - positionMillis);
      if (diff > 2000) {
        videoPlayer.currentTime = positionMillis / 1000;
      }
    }
  }, [positionMillis, videoMode]);

  useEffect(() => {
    syncedRef.current = false;
  }, [videoUri]);

  if (!videoMode) return null;

  return (
    <View style={styles.container}>
      <VideoView
        player={videoPlayer}
        style={styles.video}
        contentFit="contain"
        nativeControls={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 280,
    height: 280,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  video: {
    width: '100%',
    height: '100%',
  },
});
