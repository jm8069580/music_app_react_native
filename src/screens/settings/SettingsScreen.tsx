import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import * as MediaLibrary from 'expo-media-library/legacy';
import { scanAudioLibrary } from '../../services/scanner/audioScanner';
import {
  countSongs,
  countSongsWithoutArtwork,
  resetMissingArtwork,
} from '../../services/db/songsRepository';
import { metadataService } from '../../services/metadata/metadataBackgroundService';

export default function SettingsScreen() {
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [pendingArtwork, setPendingArtwork] = useState(0);
  const [refreshingArtwork, setRefreshingArtwork] = useState(false);
  const [artworkProgress, setArtworkProgress] = useState<{ current: number; total: number } | null>(null);

  useEffect(() => {
    loadPendingArtwork();
  }, []);

  useEffect(() => {
    const unsub = metadataService.subscribe((current, total) => {
      if (total > 0) {
        setArtworkProgress({ current, total });
      } else {
        setArtworkProgress(null);
        if (!metadataService.isRunning()) {
          setRefreshingArtwork(false);
          loadPendingArtwork();
        }
      }
    });
    return unsub;
  }, []);

  const loadPendingArtwork = async () => {
    const n = await countSongsWithoutArtwork();
    setPendingArtwork(n);
  };

  const handleRefreshArtwork = async () => {
    const count = await resetMissingArtwork();
    if (count === 0) {
      Alert.alert('Sin pendientes', 'Todas las canciones ya tienen carátula.');
      return;
    }
    setRefreshingArtwork(true);
    setPendingArtwork(count);
    metadataService.start();
  };

  const handleScan = async () => {
    try {
      // Verificar permisos antes de escanear
      const perm = await MediaLibrary.requestPermissionsAsync();
      if (perm.status !== 'granted') {
        if (!perm.canAskAgain) {
          Alert.alert(
            'Permiso requerido',
            'Activa el permiso de Música y audio desde los ajustes del sistema.',
            [
              { text: 'Cancelar', style: 'cancel' },
              { text: 'Abrir ajustes', onPress: () => Linking.openSettings() },
            ]
          );
        } else {
          Alert.alert('Permiso denegado', 'No se puede escanear sin permiso de audio.');
        }
        return;
      }

      setScanning(true);
      setProgress(null);
      const result = await scanAudioLibrary((current, total) => {
        setProgress({ current, total });
      });
      const totalInDb = await countSongs();
      Alert.alert(
        '✅ Escaneo completado',
        `Encontradas: ${result.totalFound}\nAñadidas: ${result.inserted}\nLimpiadas (huérfanas): ${result.cleaned}\nTotal en BD: ${totalInDb}`
      );
    } catch (err: any) {
      Alert.alert('❌ Error', err.message ?? 'Error desconocido');
    } finally {
      setScanning(false);
      setProgress(null);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>⚙️ Ajustes</Text>

      <TouchableOpacity
        style={[styles.button, scanning && styles.buttonDisabled]}
        onPress={handleScan}
        disabled={scanning}
      >
        {scanning ? (
          <View style={styles.scanningContent}>
            <ActivityIndicator color="#fff" />
            <Text style={styles.buttonText}>
              {progress
                ? `Escaneando ${progress.current}/${progress.total}`
                : 'Preparando...'}
            </Text>
          </View>
        ) : (
          <Text style={styles.buttonText}>🔍 Escanear biblioteca</Text>
        )}
      </TouchableOpacity>

      <Text style={styles.hint}>
        Busca todos los archivos .mp3 en tu dispositivo y los agrega a tu biblioteca.
      </Text>

      <TouchableOpacity
        style={[styles.button, styles.artworkButton, (refreshingArtwork || pendingArtwork === 0) && styles.buttonDisabled]}
        onPress={handleRefreshArtwork}
        disabled={refreshingArtwork || pendingArtwork === 0}
      >
        {refreshingArtwork ? (
          <View style={styles.scanningContent}>
            <ActivityIndicator color="#fff" />
            <Text style={styles.buttonText}>
              {artworkProgress
                ? `Extrayendo ${artworkProgress.current}/${artworkProgress.total}`
                : 'Extrayendo...'}
            </Text>
          </View>
        ) : (
          <Text style={styles.buttonText}>
            Extraer carátulas ({pendingArtwork} pendientes)
          </Text>
        )}
      </TouchableOpacity>

      <Text style={styles.hint}>
        Re-extrae las carátulas de las canciones que no tienen. Se procesan en segundo plano.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a', padding: 20 },
  title: { color: '#fff', fontSize: 24, fontWeight: 'bold', marginBottom: 30, marginTop: 20 },
  button: {
    backgroundColor: '#1db954',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  artworkButton: { backgroundColor: '#555', marginTop: 24 },
  scanningContent: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  hint: { color: '#888', fontSize: 14, marginTop: 16, lineHeight: 20 },
});