import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getSongById, updateLyrics } from '../../services/db/songsRepository';

export default function LyricsScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const { songId, title } = route.params as { songId: number; title: string };

  const [lyrics, setLyrics] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const song = await getSongById(songId);
    setLyrics(song?.lyrics ?? null);
    setLoading(false);
  }, [songId]);

  useEffect(() => {
    load();
  }, [load]);

  const startEdit = () => {
    setDraft(lyrics ?? '');
    setEditing(true);
  };

  const handleSave = async () => {
    setSaving(true);
    const value = draft.trim().length > 0 ? draft : null;
    await updateLyrics(songId, value);
    setLyrics(value);
    setEditing(false);
    setSaving(false);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10}>
          <Ionicons name="chevron-down" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
        {editing ? (
          <TouchableOpacity onPress={handleSave} hitSlop={10} disabled={saving}>
            <Text style={styles.save}>{saving ? '...' : 'Guardar'}</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={startEdit} hitSlop={10}>
            <Ionicons name="create-outline" size={24} color="#1db954" />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <ActivityIndicator color="#1db954" style={{ marginTop: 40 }} />
      ) : editing ? (
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder="Pega o escribe aquí la letra..."
          placeholderTextColor="#666"
          multiline
          autoFocus
          textAlignVertical="top"
        />
      ) : lyrics ? (
        <ScrollView contentContainerStyle={styles.lyricsWrap}>
          <Text style={styles.lyrics}>{lyrics}</Text>
        </ScrollView>
      ) : (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>
            Esta canción no tiene letra todavía.
          </Text>
          <TouchableOpacity style={styles.addBtn} onPress={startEdit}>
            <Ionicons name="add" size={20} color="#000" />
            <Text style={styles.addBtnText}>Añadir letra</Text>
          </TouchableOpacity>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b0b0b' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 12,
  },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', flex: 1, textAlign: 'center' },
  save: { color: '#1db954', fontSize: 16, fontWeight: 'bold' },
  lyricsWrap: { padding: 20 },
  lyrics: { color: '#eee', fontSize: 16, lineHeight: 26 },
  input: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    lineHeight: 24,
    padding: 20,
  },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 16 },
  emptyText: { color: '#888', textAlign: 'center', fontSize: 15 },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1db954',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 24,
  },
  addBtnText: { color: '#000', fontSize: 15, fontWeight: 'bold' },
});
