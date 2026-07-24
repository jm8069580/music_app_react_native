import { useEffect, useRef, useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { VideoView, useVideoPlayer, type VideoPlayer as VideoPlayerType } from 'expo-video';
import { usePlayerStore } from '../services/player/playerStore';

type Props = {
  videoUri: string;
};

export default function VideoPlayer({ videoUri }: Props) {
  const videoMode = usePlayerStore((s) => s.videoMode);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const videoPositionMillis = usePlayerStore((s) => s.videoPositionMillis);
  const updateVideoPosition = usePlayerStore((s) => s.updateVideoPosition);
  const hasInitializedRef = useRef(false);

  const onPlayerReady = useCallback((player: VideoPlayerType) => {
    player.showNowPlayingNotification = false;
    player.staysActiveInBackground = false;
    player.timeUpdateEventInterval = 0.5;

    const sub = player.addListener('timeUpdate', ({ currentTime }) => {
      updateVideoPosition(Math.round(currentTime * 1000));
    });

    return () => sub.remove();
  }, [updateVideoPosition]);

  const videoPlayer = useVideoPlayer(videoUri, (player) => {
    onPlayerReady(player);
  });

  useEffect(() => {
    if (!videoMode) {
      videoPlayer.pause();
      return;
    }
    if (!hasInitializedRef.current) {
      videoPlayer.currentTime = videoPositionMillis / 1000;
      hasInitializedRef.current = true;
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
    hasInitializedRef.current = false;
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
