import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import {
  getPlaylists,
  createPlaylist,
  addSongToPlaylist,
} from '../services/db/playlistsRepository';
import type { PlaylistWithCount } from '../types/playlist';

type Props = {
  visible: boolean;
  songId: number | null;
  onClose: () => void;
  /** Callback opcional tras añadir (p. ej. para un toast). */
  onAdded?: (playlistName: string) => void;
};

export function AddToPlaylistSheet({ visible, songId, onClose, onAdded }: Props) {
  const [playlists, setPlaylists] = useState<PlaylistWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setPlaylists(await getPlaylists());
    setLoading(false);
  }, []);

  useEffect(() => {
    if (visible) {
      setCreating(false);
      setNewName('');
      load();
    }
  }, [visible, load]);

  const addTo = async (playlistId: number, playlistName: string) => {
    if (songId == null) return;
    await addSongToPlaylist(playlistId, songId);
    onAdded?.(playlistName);
    onClose();
  };

  const handleCreateAndAdd = async () => {
    const name = newName.trim();
    if (!name || songId == null) return;
    const id = await createPlaylist(name);
    await addSongToPlaylist(id, songId);
    onAdded?.(name);
    onClose();
  };

  const renderItem = ({ item }: { item: PlaylistWithCount }) => (
    <Pressable style={styles.row} onPress={() => addTo(item.id, item.name)}>
      <View style={styles.cover}>
        <Ionicons name="musical-notes" size={20} color="#1db954" />
      </View>
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.subtitle}>
          {item.song_count} {item.song_count === 1 ? 'canción' : 'canciones'}
        </Text>
      </View>
      <Ionicons name="add" size={22} color="#1db954" />
    </Pressable>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.handle} />
          <Text style={styles.heading}>Añadir a playlist</Text>

          {loading ? (
            <ActivityIndicator color="#1db954" style={{ marginVertical: 24 }} />
          ) : (
            <FlatList
              data={playlists}
              keyExtractor={(item) => String(item.id)}
              renderItem={renderItem}
              style={{ maxHeight: 320 }}
              ListEmptyComponent={
                <Text style={styles.empty}>
                  No tienes playlists todavía. Crea una abajo.
                </Text>
              }
            />
          )}

          {creating ? (
            <View style={styles.createRow}>
              <TextInput
                style={styles.input}
                placeholder="Nombre de la playlist"
                placeholderTextColor="#666"
                value={newName}
                onChangeText={setNewName}
                autoFocus
                onSubmitEditing={handleCreateAndAdd}
                returnKeyType="done"
              />
              <TouchableOpacity onPress={handleCreateAndAdd} disabled={!newName.trim()}>
                <Ionicons
                  name="checkmark-circle"
                  size={30}
                  color={newName.trim() ? '#1db954' : '#555'}
                />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.newBtn} onPress={() => setCreating(true)}>
              <Ionicons name="add-circle-outline" size={22} color="#1db954" />
              <Text style={styles.newBtnText}>Nueva playlist</Text>
            </TouchableOpacity>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 28,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#444',
    marginBottom: 12,
  },
  heading: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 12,
  },
  cover: {
    width: 40,
    height: 40,
    borderRadius: 6,
    backgroundColor: '#0a0a0a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: { flex: 1 },
  title: { color: '#fff', fontSize: 15, fontWeight: '500' },
  subtitle: { color: '#888', fontSize: 12, marginTop: 2 },
  empty: { color: '#888', textAlign: 'center', paddingVertical: 24 },
  newBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    marginTop: 4,
  },
  newBtnText: { color: '#1db954', fontSize: 16, fontWeight: '500' },
  createRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  input: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#fff',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
});
