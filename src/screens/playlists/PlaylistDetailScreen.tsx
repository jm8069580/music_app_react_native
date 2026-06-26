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
import {
  useFocusEffect,
  useNavigation,
  useRoute,
} from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  getPlaylistSongs,
  removeSongFromPlaylist,
} from '../../services/db/playlistsRepository';
import { usePlayerStore } from '../../services/player/playerStore';
import type { Song } from '../../types/song';

const MINI_PLAYER_COMPACT_HEIGHT = 56;

export default function PlaylistDetailScreen() {
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const { playlistId, name } = route.params as { playlistId: number; name: string };

  const load = useCallback(async () => {
    const data = await getPlaylistSongs(playlistId);
    setSongs(data);
    setLoading(false);
  }, [playlistId]);

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

  const handleRemove = async (song: Song) => {
    await removeSongFromPlaylist(playlistId, song.id);
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
      <TouchableOpacity onPress={() => handleRemove(item)} hitSlop={10} style={styles.remove}>
        <Ionicons name="remove-circle-outline" size={22} color="#666" />
      </TouchableOpacity>
    </Pressable>
  );
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10}>
          <Ionicons name="chevron-back" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{name}</Text>
        <View style={{ width: 26 }} />
      </View>

      {loading ? (
        <ActivityIndicator color="#1db954" style={{ marginTop: 40 }} />
      ) : songs.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>
            Esta playlist está vacía. Añade canciones desde la biblioteca.
          </Text>
        </View>
      ) : (
        <FlatList
          data={songs}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={{
            paddingBottom: currentSong ? MINI_PLAYER_COMPACT_HEIGHT + 12 : 0,
          }}
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
    gap: 12,
  },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold', flex: 1, textAlign: 'center' },
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
  remove: { padding: 6 },
  title: { color: '#fff', fontSize: 15, fontWeight: '500' },
  subtitle: { color: '#888', fontSize: 13, marginTop: 2 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  emptyText: { color: '#888', textAlign: 'center' },
});
