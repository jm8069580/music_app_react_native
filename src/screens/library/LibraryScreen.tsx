import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getAllSongs } from '../../services/db/songsRepository';
import type { Song } from '../../types/song';

export default function LibraryScreen() {
  const [songs, setSongs] = useState<Song[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadSongs = useCallback(async () => {
    const data = await getAllSongs();
    setSongs(data);
  }, []);

  // Recarga cada vez que entras a esta tab
  useFocusEffect(
    useCallback(() => {
      loadSongs();
    }, [loadSongs])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadSongs();
    setRefreshing(false);
  };

  if (songs.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyEmoji}>🎵</Text>
        <Text style={styles.emptyTitle}>Tu biblioteca está vacía</Text>
        <Text style={styles.emptyHint}>Ve a Ajustes y pulsa "Escanear biblioteca"</Text>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.list}
      data={songs}
      keyExtractor={(item) => item.id.toString()}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1db954" />}
      ListHeaderComponent={
        <Text style={styles.counter}>{songs.length} canciones</Text>
      }
      renderItem={({ item }) => (
        <View style={styles.item}>
          <Text style={styles.songTitle} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.songMeta} numberOfLines={1}>
            {item.folder ?? 'Sin carpeta'} • {formatDuration(item.duration_ms)}
          </Text>
        </View>
      )}
    />
  );
}

function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: '#0a0a0a' },
  counter: { color: '#888', padding: 16, fontSize: 14 },
  item: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  songTitle: { color: '#fff', fontSize: 16, fontWeight: '500' },
  songMeta: { color: '#888', fontSize: 13, marginTop: 4 },
  empty: { flex: 1, backgroundColor: '#0a0a0a', justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyEmoji: { fontSize: 64, marginBottom: 16 },
  emptyTitle: { color: '#fff', fontSize: 18, fontWeight: '600', marginBottom: 8 },
  emptyHint: { color: '#888', fontSize: 14, textAlign: 'center' },
});