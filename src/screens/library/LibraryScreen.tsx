import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Pressable,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';

import { getAllSongs, searchSongs, type SortField } from '../../services/db/songsRepository';
import { metadataService } from '../../services/metadata/metadataBackgroundService';
import { usePlayerStore } from '../../services/player/playerStore';
import { useFavoritesStore } from '../../services/player/favoritesStore';
import { AddToPlaylistSheet } from '../../components/AddToPlaylistSheet';
import type { Song } from '../../types/song';

function HeartButton({ songId }: { songId: number }) {
  const isFavorite = useFavoritesStore((s) => s.ids.has(songId));
  const toggle = useFavoritesStore((s) => s.toggle);
  return (
    <TouchableOpacity onPress={() => toggle(songId)} hitSlop={10} style={styles.heart}>
      <Ionicons
        name={isFavorite ? 'heart' : 'heart-outline'}
        size={22}
        color={isFavorite ? '#1db954' : '#666'}
      />
    </TouchableOpacity>
  );
}

const SORT_OPTIONS: { key: SortField; label: string }[] = [
  { key: 'title', label: 'Título' },
  { key: 'artist', label: 'Artista' },
  { key: 'album', label: 'Álbum' },
  { key: 'duration_ms', label: 'Duración' },
  { key: 'added_at', label: 'Fecha' },
];

export default function LibraryScreen() {
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [metaProgress, setMetaProgress] = useState({ current: 0, total: 0 });
  const [sheetSongId, setSheetSongId] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortField>('title');

  const load = useCallback(async () => {
    const data = await getAllSongs(sort);
    setSongs(data);
    setLoading(false);
  }, [sort]);

  const filtered = useMemo(() => {
    if (!search.trim()) return songs;
    const q = search.toLowerCase();
    return songs.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        (s.artist && s.artist.toLowerCase().includes(q)) ||
        (s.album && s.album.toLowerCase().includes(q))
    );
  }, [songs, search]);

  // Cargar al montar y al volver al tab
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // Suscribirse al progreso del background → refrescar lista cuando avance.
  // Releer toda la BD en cada canción es caro; refrescamos al terminar o,
  // como mucho, cada ~800 ms mientras procesa.
  useEffect(() => {
    let lastLoad = 0;
    const unsubscribe = metadataService.subscribe((current, total) => {
      setMetaProgress({ current, total });
      if (total <= 0) return;
      const done = current >= total;
      const now = Date.now();
      if (done || now - lastLoad > 800) {
        lastLoad = now;
        load();
      }
    });
    return unsubscribe;
  }, [load]);

  const navigation = useNavigation<any>();

  const loadAndPlayFromIndex = async (index: number) => {
    await usePlayerStore.getState().loadQueue(filtered, index);
    navigation.navigate('PlayerModal' as never);
  };

  const isProcessingMeta = metaProgress.total > 0 && metaProgress.current < metaProgress.total;
  const currentSong = usePlayerStore((s) => s.currentSong);

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
        <Text style={[styles.title, isActive && styles.titleActive]} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {item.artist ?? 'Desconocido'}
        </Text>
      </View>
      <HeartButton songId={item.id} />
      <TouchableOpacity
        onPress={() => setSheetSongId(item.id)}
        hitSlop={10}
        style={styles.more}
      >
        <Ionicons name="ellipsis-vertical" size={20} color="#666" />
      </TouchableOpacity>
    </Pressable>
  );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>📚 Biblioteca</Text>
        {isProcessingMeta && (
          <View style={styles.spinnerWrap}>
            <ActivityIndicator size="small" color="#1db954" />
            <Text style={styles.spinnerText}>
              {metaProgress.current}/{metaProgress.total}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.searchRow}>
        <Ionicons name="search" size={18} color="#888" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar canciones..."
          placeholderTextColor="#666"
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')} hitSlop={10}>
            <Ionicons name="close-circle" size={18} color="#888" />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.sortRow}>
        {SORT_OPTIONS.map((o) => (
          <TouchableOpacity
            key={o.key}
            onPress={() => setSort(o.key)}
            style={[styles.sortChip, sort === o.key && styles.sortChipActive]}
          >
            <Text style={[styles.sortChipText, sort === o.key && styles.sortChipTextActive]}>
              {o.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color="#1db954" style={{ marginTop: 40 }} />
      ) : filtered.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>
            {search ? 'Sin resultados' : 'No hay canciones. Ve a Ajustes → Escanear biblioteca.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          removeClippedSubviews
          windowSize={7}
          maxToRenderPerBatch={15}
          initialNumToRender={12}
          refreshControl={
            <RefreshControl
              refreshing={false}
              onRefresh={load}
              tintColor="#1db954"
            />
          }
        />
      )}

      <AddToPlaylistSheet
        visible={sheetSongId != null}
        songId={sheetSongId}
        onClose={() => setSheetSongId(null)}
      />
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
  spinnerWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  spinnerText: { color: '#1db954', fontSize: 12 },
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
  heart: { padding: 6 },
  more: { padding: 6 },
  title: { color: '#fff', fontSize: 15, fontWeight: '500' },
  subtitle: { color: '#888', fontSize: 13, marginTop: 2 },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 38,
  },
  searchIcon: { marginRight: 6 },
  searchInput: { flex: 1, color: '#fff', fontSize: 14 },
  sortRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 4,
    gap: 6,
  },
  sortChip: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: '#1a1a1a',
  },
  sortChipActive: { backgroundColor: '#1db954' },
  sortChipText: { color: '#888', fontSize: 12 },
  sortChipTextActive: { color: '#000', fontWeight: '600' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  emptyText: { color: '#888', textAlign: 'center' },
});