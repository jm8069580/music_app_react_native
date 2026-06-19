import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Pressable,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  getPlaylists,
  createPlaylist,
  deletePlaylist,
} from '../../services/db/playlistsRepository';
import type { PlaylistWithCount } from '../../types/playlist';

export default function PlaylistsScreen() {
  const [playlists, setPlaylists] = useState<PlaylistWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [newName, setNewName] = useState('');
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();

  const load = useCallback(async () => {
    const data = await getPlaylists();
    setPlaylists(data);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    await createPlaylist(name);
    setNewName('');
    setModalVisible(false);
    load();
  };

  const handleDelete = (playlist: PlaylistWithCount) => {
    Alert.alert(
      'Borrar playlist',
      `¿Seguro que quieres borrar "${playlist.name}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Borrar',
          style: 'destructive',
          onPress: async () => {
            await deletePlaylist(playlist.id);
            setPlaylists((prev) => prev.filter((p) => p.id !== playlist.id));
          },
        },
      ]
    );
  };

  const renderItem = ({ item }: { item: PlaylistWithCount }) => (
    <Pressable
      style={styles.row}
      onPress={() =>
        navigation.navigate('PlaylistDetail', {
          playlistId: item.id,
          name: item.name,
        })
      }
      onLongPress={() => handleDelete(item)}
    >
      <View style={styles.cover}>
        <Ionicons name="musical-notes" size={24} color="#1db954" />
      </View>
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.subtitle}>
          {item.song_count} {item.song_count === 1 ? 'canción' : 'canciones'}
        </Text>
      </View>
      <TouchableOpacity onPress={() => handleDelete(item)} hitSlop={10} style={styles.more}>
        <Ionicons name="trash-outline" size={20} color="#666" />
      </TouchableOpacity>
    </Pressable>
  );

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.headerTitle}>📋 Playlists</Text>
        <TouchableOpacity onPress={() => setModalVisible(true)} hitSlop={10}>
          <Ionicons name="add-circle" size={30} color="#1db954" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color="#1db954" style={{ marginTop: 40 }} />
      ) : playlists.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>
            Aún no tienes playlists. Pulsa + para crear la primera.
          </Text>
        </View>
      ) : (
        <FlatList
          data={playlists}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
        />
      )}

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setModalVisible(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>Nueva playlist</Text>
            <TextInput
              style={styles.input}
              placeholder="Nombre"
              placeholderTextColor="#666"
              value={newName}
              onChangeText={setNewName}
              autoFocus
              onSubmitEditing={handleCreate}
              returnKeyType="done"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={() => {
                  setNewName('');
                  setModalVisible(false);
                }}
              >
                <Text style={styles.modalCancel}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleCreate} disabled={!newName.trim()}>
                <Text
                  style={[styles.modalCreate, !newName.trim() && styles.modalCreateDisabled]}
                >
                  Crear
                </Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
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
  cover: {
    width: 48,
    height: 48,
    borderRadius: 6,
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: { flex: 1 },
  title: { color: '#fff', fontSize: 15, fontWeight: '500' },
  subtitle: { color: '#888', fontSize: 13, marginTop: 2 },
  more: { padding: 6 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  emptyText: { color: '#888', textAlign: 'center' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: 32,
  },
  modalCard: { backgroundColor: '#1a1a1a', borderRadius: 12, padding: 20 },
  modalTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 16 },
  input: {
    backgroundColor: '#0a0a0a',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#fff',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 24,
    marginTop: 20,
  },
  modalCancel: { color: '#888', fontSize: 16 },
  modalCreate: { color: '#1db954', fontSize: 16, fontWeight: 'bold' },
  modalCreateDisabled: { color: '#555' },
});
