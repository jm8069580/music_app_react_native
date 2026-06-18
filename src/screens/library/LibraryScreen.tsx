import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Pressable,
  TouchableOpacity,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';

import { getAllSongs } from '../../services/db/songsRepository';
import { metadataService } from '../../services/metadata/metadataBackgroundService';
import { usePlayerStore } from '../../services/player/playerStore';
import { useFavoritesStore } from '../../services/player/favoritesStore';
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

export default function LibraryScreen() {
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [metaProgress, setMetaProgress] = useState({ current: 0, total: 0 });

  const load = useCallback(async () => {
    const data = await getAllSongs();
    setSongs(data);
    setLoading(false);
  }, []);

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
    await usePlayerStore.getState().loadQueue(songs, index);
    navigation.navigate('PlayerModal' as never);
  };

  const isProcessingMeta = metaProgress.total > 0 && metaProgress.current < metaProgress.total;

  const renderItem = ({ item, index }: { item: Song; index: number }) => (
    <Pressable style={styles.row} onPress={() => loadAndPlayFromIndex(index)}>
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
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {item.artist ?? 'Desconocido'}
        </Text>
      </View>
      <HeartButton songId={item.id} />
    </Pressable>
  );

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

      {loading ? (
        <ActivityIndicator color="#1db954" style={{ marginTop: 40 }} />
      ) : songs.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>
            No hay canciones. Ve a Ajustes → Escanear biblioteca.
          </Text>
        </View>
      ) : (
        <FlatList
          data={songs}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl
              refreshing={false}
              onRefresh={load}
              tintColor="#1db954"
            />
          }
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
  spinnerWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  spinnerText: { color: '#1db954', fontSize: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
  },
  artwork: { width: 48, height: 48, borderRadius: 6, backgroundColor: '#222' },
  artworkPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1 },
  heart: { padding: 6 },
  title: { color: '#fff', fontSize: 15, fontWeight: '500' },
  subtitle: { color: '#888', fontSize: 13, marginTop: 2 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  emptyText: { color: '#888', textAlign: 'center' },
});