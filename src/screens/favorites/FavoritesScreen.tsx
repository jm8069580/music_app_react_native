import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Pressable,
  TouchableOpacity,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';

import { getFavoriteSongs } from '../../services/db/songsRepository';
import { usePlayerStore } from '../../services/player/playerStore';
import { useFavoritesStore } from '../../services/player/favoritesStore';
import type { Song } from '../../types/song';

export default function FavoritesScreen() {
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const toggleFavorite = useFavoritesStore((s) => s.toggle);
  const navigation = useNavigation<any>();

  const load = useCallback(async () => {
    const data = await getFavoriteSongs();
    setSongs(data);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const currentSong = usePlayerStore((s) => s.currentSong);

  const loadAndPlayFromIndex = async (index: number) => {
    await usePlayerStore.getState().loadQueue(songs, index);
    navigation.navigate('PlayerModal' as never);
  };

  const handleUnfavorite = async (song: Song) => {
    await toggleFavorite(song.id);
    setSongs((prev) => prev.filter((s) => s.id !== song.id));
  };

  const renderItem = ({ item, index }: { item: Song; index: number }) => {
    const isActive = currentSong?.id === item.id;
    return (
    <Pressable style={styles.row} onPress={() => loadAndPlayFromIndex(index)}>
      <View style={styles.artworkWrap}>
        {item.artwork_uri ? (
          <Image
            source={{ uri: item.artwork_uri }}
            style={styles.artwork}
            contentFit="cover"
            transition={150}
          />
        ) : (
          <View style={[styles.artwork, styles.artworkPlaceholder]}>
            <Ionicons name="musical-note" size={22} color="#666" />
          </View>
        )}
        {isActive && (
          <View style={styles.playingBadge}>
            <Ionicons name="play" size={14} color="#fff" />
          </View>
        )}
      </View>
      <View style={styles.info}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, isActive && styles.titleActive]} numberOfLines={1}>{item.title}</Text>
          {item.lyrics && <Ionicons name="document-text-outline" size={14} color="#1db954" style={styles.lyricsIcon} />}
        </View>
        <Text style={styles.subtitle} numberOfLines={1}>
          {item.artist ?? 'Desconocido'}
        </Text>
      </View>
      <TouchableOpacity
        onPress={() => handleUnfavorite(item)}
        hitSlop={10}
        style={styles.heart}
      >
        <Ionicons name="heart" size={22} color="#1db954" />
      </TouchableOpacity>
    </Pressable>
  );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>❤️ Favoritos</Text>
      </View>

      {loading ? (
        <ActivityIndicator color="#1db954" style={{ marginTop: 40 }} />
      ) : songs.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>
            Aún no tienes favoritos. Toca el corazón en una canción para añadirla.
          </Text>
        </View>
      ) : (
        <FlatList
          data={songs}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  headerTitle: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
  },
  artworkWrap: { position: 'relative' },
  artwork: { width: 48, height: 48, borderRadius: 6, backgroundColor: '#222' },
  artworkPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  playingBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#1db954',
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleActive: { color: '#1db954' },
  info: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  lyricsIcon: { marginLeft: 6 },
  title: { color: '#fff', fontSize: 15, fontWeight: '500' },
  subtitle: { color: '#888', fontSize: 13, marginTop: 2 },
  heart: { padding: 6 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  emptyText: { color: '#888', textAlign: 'center' },
});
