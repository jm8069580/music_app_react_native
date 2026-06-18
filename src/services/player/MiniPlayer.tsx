import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsPlaying } from '@rntp/player';
import { usePlayerStore } from '../../services/player/playerStore';
import { Ionicons } from '@expo/vector-icons';

export const MiniPlayer: React.FC = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const currentSong = usePlayerStore((s) => s.currentSong);
  const isPlaying = useIsPlaying();
  const play = usePlayerStore((s) => s.play);
  const pause = usePlayerStore((s) => s.pause);
  const loading = usePlayerStore((s) => s.loading);

  if (!currentSong) return null;

  const artwork = currentSong.artwork_uri ? { uri: currentSong.artwork_uri } : require('../../../assets/default_artwork.png');

  return (
    <TouchableOpacity style={[styles.container, { paddingBottom: insets.bottom + 8 }]} activeOpacity={0.9} onPress={() => navigation.navigate('PlayerModal' as never)}>
      <Image source={artwork} style={styles.art} />
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
    backgroundColor: '#121212',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 8,
    // paddingBottom se aplica en línea: 8 + inset inferior del dispositivo,
    // para no chocar con la barra de gestos/navegación del móvil.
    borderTopWidth: 1,
    borderTopColor: '#222',
  },
  art: { width: 48, height: 48, borderRadius: 4, backgroundColor: '#333' },
  meta: { flex: 1, marginHorizontal: 10 },
  title: { color: '#fff', fontSize: 14 },
  artist: { color: '#aaa', fontSize: 12, marginTop: 2 },
  control: { padding: 8 },
});