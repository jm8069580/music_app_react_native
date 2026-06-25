import React, { useEffect, useRef } from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, Animated, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePlayerStore } from '../../services/player/playerStore';
import { useFavoritesStore, useIsFavorite } from '../../services/player/favoritesStore';
import { useProgress, useIsPlaying } from '@rntp/player';
import Slider from '@react-native-community/slider';
import { Ionicons } from '@expo/vector-icons';

const { height } = Dimensions.get('window');

export const PlayerScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(height)).current;
  useEffect(() => {
    Animated.timing(translateY, { toValue: 0, duration: 300, useNativeDriver: true }).start();
  }, []);

  const currentSong = usePlayerStore((s) => s.currentSong);
  const { position, duration } = useProgress();
  const isPlaying = useIsPlaying();
  const play = usePlayerStore((s) => s.play);
  const pause = usePlayerStore((s) => s.pause);
  const next = usePlayerStore((s) => s.next);
  const previous = usePlayerStore((s) => s.previous);
  const seekTo = usePlayerStore((s) => s.seekTo);
  const shuffle = usePlayerStore((s) => s.shuffle);
  const repeat = usePlayerStore((s) => s.repeat);
  const toggleShuffle = usePlayerStore((s) => s.toggleShuffle);
  const toggleRepeat = usePlayerStore((s) => s.toggleRepeat);
  const toggleFavorite = useFavoritesStore((s) => s.toggle);
  const isFavorite = useIsFavorite(currentSong?.id);

  if (!currentSong) {
    return null;
  }

  const artwork = currentSong.artwork_uri ? { uri: currentSong.artwork_uri } : require('../../../assets/default_artwork.png');

  const format = (sec: number) => {
    const total = Math.floor(sec || 0);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <Animated.View style={[styles.container, { transform: [{ translateY }], paddingBottom: insets.bottom }]}>
      <TouchableOpacity style={styles.close} onPress={() => navigation.goBack()}>
        <Ionicons name="chevron-down" size={28} color="#fff" />
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.lyricsBtn}
        onPress={() =>
          navigation.navigate('LyricsModal', {
            songId: currentSong.id,
            title: currentSong.title,
          })
        }
        hitSlop={10}
      >
        <Ionicons name="document-text-outline" size={24} color="#fff" />
      </TouchableOpacity>

      <Image source={artwork} style={styles.art} />
      <View style={styles.titleRow}>
        <View style={styles.titleSpacer} />
        <Text style={styles.title} numberOfLines={1}>{currentSong.title}</Text>
        <TouchableOpacity onPress={() => toggleFavorite(currentSong.id)} hitSlop={10} style={styles.heart}>
          <Ionicons
            name={isFavorite ? 'heart' : 'heart-outline'}
            size={26}
            color={isFavorite ? '#1db954' : '#fff'}
          />
        </TouchableOpacity>
      </View>
      <Text style={styles.artist}>{currentSong.artist}</Text>

      <Slider
        style={{ width: '90%', marginTop: 24 }}
        value={position}
        minimumValue={0}
        maximumValue={Math.max(duration, 1)}
        minimumTrackTintColor="#1DB954"
        maximumTrackTintColor="#444"
        onSlidingComplete={(val) => seekTo(Math.round(val * 1000))}
      />
      <View style={styles.times}>
        <Text style={styles.timeText}>{format(position)}</Text>
        <Text style={styles.timeText}>{format(duration)}</Text>
      </View>

      <View style={styles.controls}>
        <TouchableOpacity onPress={toggleShuffle}>
          <Ionicons
            name="shuffle"
            size={26}
            color={shuffle ? '#1db954' : '#888'}
          />
        </TouchableOpacity>

        <TouchableOpacity onPress={() => previous()}>
          <Ionicons name="play-skip-back" size={36} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity onPress={() => (isPlaying ? pause() : play())} style={{ marginHorizontal: 36 }}>
          <Ionicons name={isPlaying ? 'pause-circle' : 'play-circle'} size={64} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity onPress={() => next()}>
          <Ionicons name="play-skip-forward" size={36} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity onPress={toggleRepeat}>
          {repeat === 'one' ? (
            <View style={styles.repeatOneWrap}>
              <Ionicons name="repeat" size={24} color="#1db954" />
              <Text style={styles.repeatOneText}>1</Text>
            </View>
          ) : (
            <Ionicons
              name="repeat"
              size={26}
              color={repeat === 'all' ? '#1db954' : '#888'}
            />
          )}
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0, top: 0,
    backgroundColor: '#0b0b0b',
    alignItems: 'center',
    paddingTop: 48,
  },
  close: { position: 'absolute', left: 12, top: 40 },
  lyricsBtn: { position: 'absolute', right: 12, top: 40 },
  art: { width: 280, height: 280, borderRadius: 8, backgroundColor: '#222' },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '90%',
    marginTop: 18,
  },
  titleSpacer: { width: 34 },
  title: { color: '#fff', fontSize: 20, flex: 1, textAlign: 'center' },
  heart: { padding: 4, width: 34, alignItems: 'flex-end' },
  artist: { color: '#bbb', marginTop: 6 },
  times: { width: '90%', flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  timeText: { color: '#888' },
  controls: { flexDirection: 'row', alignItems: 'center', marginTop: 24, gap: 24 },
  repeatOneWrap: { position: 'relative' },
  repeatOneText: {
    position: 'absolute',
    top: -4, right: -6,
    color: '#1db954',
    fontSize: 10,
    fontWeight: 'bold',
  },
});