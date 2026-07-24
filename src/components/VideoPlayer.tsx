import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { usePlayerStore } from '../services/player/playerStore';

type Props = {
  videoUri: string;
};

export default function VideoPlayer({ videoUri }: Props) {
  const videoMode = usePlayerStore((s) => s.videoMode);
  const isPlaying = usePlayerStore((s) => s.isPlaying);

  const videoPlayer = useVideoPlayer(videoUri, (player) => {
    player.showNowPlayingNotification = false;
    player.staysActiveInBackground = false;
  });

  const prevUriRef = useRef<string | null>(null);

  useEffect(() => {
    if (!videoMode) {
      videoPlayer.pause();
      return;
    }
    if (prevUriRef.current !== videoUri) {
      videoPlayer.currentTime = 0;
      prevUriRef.current = videoUri;
    }
    videoPlayer.play();
  }, [videoMode, videoUri]);

  useEffect(() => {
    if (videoMode) {
      if (isPlaying) {
        videoPlayer.play();
      } else {
        videoPlayer.pause();
      }
    }
  }, [isPlaying, videoMode]);

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
