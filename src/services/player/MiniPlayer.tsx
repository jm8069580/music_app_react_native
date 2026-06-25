import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation, useNavigationState } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsPlaying } from '@rntp/player';
import { usePlayerStore } from '../../services/player/playerStore';
import { Ionicons } from '@expo/vector-icons';

const TAB_BAR_HEIGHT = 56;

function getActiveRouteName(state: any): string | undefined {
  if (!state || typeof state.index !== 'number') return undefined;
  const route = state.routes[state.index];
  if (route?.state) return getActiveRouteName(route.state);
  return route?.name;
}

export const MiniPlayer: React.FC = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const compact = useNavigationState(getActiveRouteName) === 'PlaylistDetail';
  const currentSong = usePlayerStore((s) => s.currentSong);
  const isPlaying = useIsPlaying();
  const play = usePlayerStore((s) => s.play);
  const pause = usePlayerStore((s) => s.pause);
  const loading = usePlayerStore((s) => s.loading);

  if (!currentSong) return null;

  const artwork = currentSong.artwork_uri ? { uri: currentSong.artwork_uri } : require('../../../assets/default_artwork.png');

  return (
    <TouchableOpacity
      style={[
        styles.container,
        compact && styles.containerCompact,
        {
          bottom: TAB_BAR_HEIGHT + insets.bottom,
        },
      ]}
      activeOpacity={0.9}
      onPress={() => navigation.navigate('PlayerModal' as never)}
    >
      <Image source={artwork} style={[styles.art, compact && styles.artCompact]} />
      <View style={styles.meta}>
        <Text numberOfLines={1} style={styles.title}>{currentSong.title ?? 'Desconocido'}</Text>
        <Text numberOfLines={1} style={styles.artist}>{currentSong.artist ?? 'Desconocido'}</Text>
      </View>
      <TouchableOpacity onPress={() => (isPlaying ? pause() : play())} style={styles.control}>
        {loading ? <Ionicons name="ellipsis-horizontal" size={22} color="#fff" /> :
          <Ionicons name={isPlaying ? 'pause' : 'play'} size={22} color="#fff" />}
      </TouchableOpacity>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: '#121212',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#222',
  },
  containerCompact: {
    backgroundColor: 'rgba(11,11,11,0.85)',
    borderTopColor: 'rgba(255,255,255,0.08)',
    paddingVertical: 6,
  },
  art: { width: 48, height: 48, borderRadius: 4, backgroundColor: '#333' },
  artCompact: { width: 36, height: 36 },
  meta: { flex: 1, marginHorizontal: 10 },
  title: { color: '#fff', fontSize: 14 },
  artist: { color: '#aaa', fontSize: 12, marginTop: 2 },
  control: { padding: 8 },
});