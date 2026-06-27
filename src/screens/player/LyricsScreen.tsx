import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
  LayoutChangeEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useProgress, useIsPlaying } from '@rntp/player';
import Slider from '@react-native-community/slider';

import { usePlayerStore } from '../../services/player/playerStore';
import { getSongById, updateLyrics } from '../../services/db/songsRepository';
import { isLrcFormat, parseLrc, getCurrentLineIndex, type LrcLine } from '../../utils/lrcParser';

export default function LyricsScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();

  const currentSong = usePlayerStore((s) => s.currentSong);
  const { position, duration } = useProgress();
  const positionMs = position * 1000;

  const isPlaying = useIsPlaying();
  const play = usePlayerStore((s) => s.play);
  const pause = usePlayerStore((s) => s.pause);
  const seekTo = usePlayerStore((s) => s.seekTo);
  const progress = duration > 0 ? Math.min(1, position / duration) : 0;

  const [lyrics, setLyrics] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const scrollRef = useRef<ScrollView>(null);
  const lineOffsets = useRef<number[]>([]);

  const lrcLines = useMemo(() => {
    if (!lyrics || !isLrcFormat(lyrics)) return null;
    return parseLrc(lyrics);
  }, [lyrics]);

  const currentIdx = useMemo(() => {
    if (!lrcLines) return -1;
    return getCurrentLineIndex(lrcLines, positionMs);
  }, [lrcLines, positionMs]);

  const load = useCallback(async (songId: number) => {
    setLoading(true);
    setEditing(false);
    setDraft('');
    const song = await getSongById(songId);
    setLyrics(song?.lyrics ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!currentSong) {
      navigation.goBack();
      return;
    }
    load(currentSong.id);
  }, [currentSong?.id, load, navigation]);

  useEffect(() => {
    if (!lrcLines || editing || currentIdx < 0) return;
    const offset = lineOffsets.current[currentIdx];
    if (offset === undefined) return;
    scrollRef.current?.scrollTo({ y: Math.max(0, offset - 200), animated: true });
  }, [currentIdx, lrcLines, editing]);

  const handleLineLayout = (idx: number, e: LayoutChangeEvent) => {
    lineOffsets.current[idx] = e.nativeEvent.layout.y;
  };

  const startEdit = () => {
    if (!currentSong) return;
    setDraft(lyrics ?? '');
    setEditing(true);
  };

  const handleSave = async () => {
    if (!currentSong) return;
    setSaving(true);
    const value = draft.trim().length > 0 ? draft : null;
    await updateLyrics(currentSong.id, value);
    setLyrics(value);
    setEditing(false);
    setSaving(false);
  };

  const isLrc = lrcLines !== null;

  const renderLrcLine = (line: LrcLine, idx: number) => {
    const isCurrent = idx === currentIdx;
    const isPast = idx < currentIdx;
    return (
      <View
        key={idx}
        onLayout={(e) => handleLineLayout(idx, e)}
        style={[styles.lrcLine, isCurrent && styles.lrcLineCurrent]}
      >
        <Text style={[styles.lrcTimestamp, isCurrent && styles.lrcTimestampCurrent]}>
          {formatTimestamp(line.timeMs)}
        </Text>
        <Text
          style={[
            styles.lrcText,
            isCurrent && styles.lrcTextCurrent,
            isPast && !isCurrent && styles.lrcTextPast,
          ]}
        >
          {line.text}
        </Text>
      </View>
    );
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
        <Text style={styles.headerTitle} numberOfLines={1}>{currentSong?.title ?? ''}</Text>
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
          style={[styles.input, { paddingBottom: insets.bottom + 24 }]}
          value={draft}
          onChangeText={setDraft}
          placeholder="Pega o escribe aquí la letra..."
          placeholderTextColor="#666"
          multiline
          autoFocus
          textAlignVertical="top"
        />
      ) : lyrics && isLrc ? (
        <ScrollView ref={scrollRef} contentContainerStyle={[styles.lrcWrap, { paddingBottom: insets.bottom + 80 }]}>
          {lrcLines.map((line, idx) => renderLrcLine(line, idx))}
        </ScrollView>
      ) : lyrics ? (
        <ScrollView contentContainerStyle={[styles.lyricsWrap, { paddingBottom: insets.bottom + 80 }]}>
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

      {!editing && !loading && (
        <View style={[styles.bar, { paddingBottom: insets.bottom + 8 }]}>
          <Slider
            style={{ width: '100%', height: 20 }}
            value={position}
            minimumValue={0}
            maximumValue={Math.max(duration, 1)}
            minimumTrackTintColor="#1DB954"
            maximumTrackTintColor="#444"
            onSlidingComplete={(val) => seekTo(Math.round(val * 1000))}
          />
          <View style={styles.barRow}>
            <Text style={styles.barTime}>{formatTime(position)}</Text>
            <Text style={styles.barTitle} numberOfLines={1}>{currentSong?.title ?? ''}</Text>
            <TouchableOpacity
              onPress={() => (isPlaying ? pause() : play())}
              hitSlop={12}
              style={styles.barControl}
            >
              <Ionicons name={isPlaying ? 'pause' : 'play'} size={24} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

function formatTimestamp(ms: number): string {
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatTime(seconds: number): string {
  const total = Math.floor(seconds || 0);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
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
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
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

  lrcWrap: { paddingVertical: 24, paddingHorizontal: 20 },
  lrcLine: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 6,
    gap: 12,
  },
  lrcLineCurrent: {},
  lrcTimestamp: {
    color: '#555',
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    lineHeight: 22,
    minWidth: 36,
    textAlign: 'right',
  },
  lrcTimestampCurrent: {
    color: '#1db954',
  },
  lrcText: {
    color: '#aaa',
    fontSize: 17,
    lineHeight: 24,
    flex: 1,
  },
  lrcTextCurrent: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 18,
  },
  lrcTextPast: {
    color: '#666',
  },

  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(11,11,11,0.85)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    paddingTop: 0,
    paddingHorizontal: 8,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    gap: 12,
  },
  barTime: { color: '#888', fontSize: 12, minWidth: 36 },
  barTitle: { color: '#bbb', fontSize: 13, flex: 1, textAlign: 'center' },
  barControl: { padding: 4 },
});
