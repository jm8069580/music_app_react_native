import { useEffect, useState, useCallback } from 'react';
import { StyleSheet, View, TouchableOpacity, Text } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { usePlayerStore } from '../services/player/playerStore';
import { Ionicons } from '@expo/vector-icons';

type Props = {
  videoUri: string;
};

export default function VideoPlayer({ videoUri }: Props) {
  const videoMode = usePlayerStore((s) => s.videoMode);
  const videoPlayer = useVideoPlayer(videoUri, (player) => {
    player.showNowPlayingNotification = false;
    player.staysActiveInBackground = false;
    player.timeUpdateEventInterval = 0.5;
  });

  const [videoTime, setVideoTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [videoIsPlaying, setVideoIsPlaying] = useState(false);
  const [showControls, setShowControls] = useState(true);

  useEffect(() => {
    const subPlaying = videoPlayer.addListener('playingChange', ({ isPlaying: playing }) => {
      setVideoIsPlaying(playing);
    });
    const subTime = videoPlayer.addListener('timeUpdate', ({ currentTime }) => {
      setVideoTime(currentTime);
    });
    return () => {
      subPlaying.remove();
      subTime.remove();
    };
  }, [videoPlayer]);

  useEffect(() => {
    const sub = videoPlayer.addListener('statusChange', ({ status }) => {
      if (status === 'readyToPlay') {
        setVideoDuration(videoPlayer.duration);
      }
    });
    return () => sub.remove();
  }, [videoPlayer]);

  useEffect(() => {
    if (!videoMode) {
      videoPlayer.pause();
      return;
    }
    videoPlayer.currentTime = 0;
    videoPlayer.play();
  }, [videoMode, videoUri]);

  useEffect(() => {
    if (showControls) {
      const timer = setTimeout(() => setShowControls(false), 4000);
      return () => clearTimeout(timer);
    }
  }, [showControls]);

  const togglePlay = useCallback(() => {
    if (videoIsPlaying) {
      videoPlayer.pause();
    } else {
      videoPlayer.play();
    }
  }, [videoIsPlaying, videoPlayer]);

  const seekBy = useCallback(
    (seconds: number) => {
      videoPlayer.currentTime = Math.max(0, Math.min(videoPlayer.currentTime + seconds, videoDuration));
    },
    [videoPlayer, videoDuration]
  );

  const formatTime = (sec: number) => {
    const s = Math.floor(sec || 0);
    const m = Math.floor(s / 60);
    const remainder = s % 60;
    return `${m}:${remainder.toString().padStart(2, '0')}`;
  };

  if (!videoMode) return null;

  return (
    <TouchableOpacity
      activeOpacity={1}
      style={styles.container}
      onPress={() => setShowControls((prev) => !prev)}
    >
      <VideoView
        player={videoPlayer}
        style={styles.video}
        contentFit="contain"
        nativeControls={false}
      />
      {showControls && (
        <View style={styles.controlsOverlay}>
          <View style={styles.topRow}>
            <Text style={styles.timeText}>
              {formatTime(videoTime)} / {formatTime(videoDuration)}
            </Text>
          </View>
          <View style={styles.centerRow}>
            <TouchableOpacity onPress={() => seekBy(-10)} style={styles.sideBtn} hitSlop={8}>
              <Ionicons name="play-back" size={28} color="#fff" />
              <Text style={styles.seekLabel}>10</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={togglePlay} style={styles.playBtn}>
              <Ionicons
                name={videoIsPlaying ? 'pause' : 'play'}
                size={36}
                color="#fff"
              />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => seekBy(10)} style={styles.sideBtn} hitSlop={8}>
              <Ionicons name="play-forward" size={28} color="#fff" />
              <Text style={styles.seekLabel}>10</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.progressRow}>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  { width: videoDuration > 0 ? `${(videoTime / videoDuration) * 100}%` : '0%' },
                ]}
              />
            </View>
          </View>
        </View>
      )}
    </TouchableOpacity>
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
  controlsOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'space-between',
    paddingTop: 10,
    paddingBottom: 14,
    paddingHorizontal: 14,
  },
  topRow: {
    alignItems: 'center',
  },
  timeText: {
    color: '#ddd',
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  centerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 32,
  },
  sideBtn: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  seekLabel: {
    color: '#fff',
    fontSize: 9,
    marginTop: -2,
  },
  playBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(29,185,84,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressRow: {
    paddingHorizontal: 4,
  },
  progressTrack: {
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#1db954',
    borderRadius: 2,
  },
});
