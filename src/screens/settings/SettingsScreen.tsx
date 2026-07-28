import { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import * as MediaLibrary from 'expo-media-library/legacy';
import * as FileSystem from 'expo-file-system/legacy';
import { scanAudioLibrary } from '../../services/scanner/audioScanner';
import { scanAndLinkVideos } from '../../services/scanner/videoScanner';
import {
  countSongs,
  countSongsWithoutArtwork,
  resetMissingArtwork,
  resetAllMetadata,
} from '../../services/db/songsRepository';
import { metadataService } from '../../services/metadata/metadataBackgroundService';
import { exportLyricsBackup, importLyricsBackup } from '../../services/backup/lyricsBackup';

export default function SettingsScreen() {
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [pendingArtwork, setPendingArtwork] = useState(0);
  const [refreshingArtwork, setRefreshingArtwork] = useState(false);
  const [artworkProgress, setArtworkProgress] = useState<{ current: number; total: number } | null>(null);
  const [reExtracting, setReExtracting] = useState(false);
  const [scanningVideos, setScanningVideos] = useState(false);
  const [videoProgress, setVideoProgress] = useState<{ current: number; total: number } | null>(null);
  const [exportingLyrics, setExportingLyrics] = useState(false);
  const [importingLyrics, setImportingLyrics] = useState(false);

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
          setReExtracting(false);
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

  const handleReExtractAll = async () => {
    Alert.alert(
      'Re-extraer todas',
      'Se volverán a descargar todas las carátulas. Esto puede tardar varios minutos.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Continuar',
          onPress: async () => {
            const count = await resetAllMetadata();
            if (count === 0) {
              Alert.alert('Sin canciones', 'No hay canciones en la biblioteca.');
              return;
            }
            setReExtracting(true);
            setPendingArtwork(count);
            metadataService.start();
          },
        },
      ]
    );
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

  const handleScanVideos = async () => {
    try {
      setScanningVideos(true);
      setVideoProgress(null);
      const result = await scanAndLinkVideos((current, total) => {
        setVideoProgress({ current, total });
      });
      const sampleVideos = result.videoNames.slice(0, 5).join(', ');
      const sampleTitles = result.songTitles.slice(0, 5).join(', ');
      const sampleAudioFiles = result.songFileNames.slice(0, 5).join(', ');
      Alert.alert(
        '✅ Escaneo de videos completado',
        `Videos encontrados: ${result.totalVideos}\nVinculados: ${result.matched}\n\n` +
        `Videos (muestra): ${sampleVideos || 'ninguno'}\n` +
        `Títulos BD (muestra): ${sampleTitles || 'ninguno'}\n` +
        `Archivos audio (muestra): ${sampleAudioFiles || 'ninguno'}`
      );
    } catch (err: any) {
      Alert.alert('❌ Error', err.message ?? 'Error desconocido al escanear videos');
    } finally {
      setScanningVideos(false);
      setVideoProgress(null);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
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

      <TouchableOpacity
        style={[styles.button, styles.reExtractButton, (refreshingArtwork || reExtracting) && styles.buttonDisabled]}
        onPress={handleReExtractAll}
        disabled={refreshingArtwork || reExtracting}
      >
        {reExtracting ? (
          <View style={styles.scanningContent}>
            <ActivityIndicator color="#fff" />
            <Text style={styles.buttonText}>
              {artworkProgress
                ? `Re-extrayendo ${artworkProgress.current}/${artworkProgress.total}`
                : 'Re-extrayendo...'}
            </Text>
          </View>
        ) : (
          <Text style={styles.buttonText}>🔄 Re-extraer todas las carátulas</Text>
        )}
      </TouchableOpacity>

      <Text style={styles.hint}>
        Fuerza la re-extracción de carátulas de TODAS las canciones. Útil si cambiaste la carátula de un archivo externamente.
      </Text>

      <TouchableOpacity
        style={[styles.button, styles.videoButton, scanningVideos && styles.buttonDisabled]}
        onPress={handleScanVideos}
        disabled={scanningVideos}
      >
        {scanningVideos ? (
          <View style={styles.scanningContent}>
            <ActivityIndicator color="#fff" />
            <Text style={styles.buttonText}>
              {videoProgress
                ? `Escaneando ${videoProgress.current}/${videoProgress.total}`
                : 'Escaneando videos...'}
            </Text>
          </View>
        ) : (
          <Text style={styles.buttonText}>🎬 Escanear y vincular videos</Text>
        )}
      </TouchableOpacity>

      <Text style={styles.hint}>
        Busca archivos de video (.mp4, .mkv, .webm) en tu dispositivo y los vincula a las canciones por nombre de archivo.
      </Text>

      <View style={styles.sectionDivider} />
      <Text style={styles.sectionTitle}>📝 Letras</Text>

      <TouchableOpacity
        style={[styles.button, styles.lyricsExportButton, exportingLyrics && styles.buttonDisabled]}
        onPress={async () => {
          setExportingLyrics(true);
          const path = await exportLyricsBackup();
          setExportingLyrics(false);
          if (path) {
            Alert.alert('✅ Exportado', `Backup guardado en:\n${path}\n\nPara descargarlo:\nadb exec-out run-as com.juanquiroz.melodix cat files/melodix-lyrics-backup.json > backup.json`);
          } else {
            Alert.alert('Sin letras', 'No hay canciones con letras para exportar.');
          }
        }}
        disabled={exportingLyrics}
      >
        <View style={styles.scanningContent}>
          {exportingLyrics && <ActivityIndicator color="#fff" />}
          <Text style={styles.buttonText}>
            {exportingLyrics ? 'Exportando...' : '📤 Exportar letras'}
          </Text>
        </View>
      </TouchableOpacity>

      <Text style={styles.hint}>
        Guarda todas las letras en un archivo JSON. Para importarlo después, copia el archivo al dispositivo y usa "Importar letras".
      </Text>

      <TouchableOpacity
        style={[styles.button, styles.lyricsImportButton, importingLyrics && styles.buttonDisabled]}
        onPress={async () => {
          setImportingLyrics(true);
          const result = await importLyricsBackup();
          setImportingLyrics(false);
          if (!result) {
            Alert.alert('No encontrado', 'No se encontró el archivo de backup. Copia melodix-lyrics-backup.json al dispositivo.');
            return;
          }
          Alert.alert(
            '✅ Importación completada',
            `Restauradas: ${result.restored}\nOmitidas: ${result.skipped}\nErrores: ${result.errors}`
          );
        }}
        disabled={importingLyrics}
      >
        <View style={styles.scanningContent}>
          {importingLyrics && <ActivityIndicator color="#fff" />}
          <Text style={styles.buttonText}>
            {importingLyrics ? 'Importando...' : '📥 Importar letras'}
          </Text>
        </View>
      </TouchableOpacity>

      <Text style={styles.hint}>
        Restaura letras desde un backup. Para copiar el archivo al dispositivo: adb push backup.json /sdcard/Download/ y muévelo a la carpeta de datos de la app con adb.
      </Text>
    </ScrollView>
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
  reExtractButton: { backgroundColor: '#2a5a3a', marginTop: 24 },
  videoButton: { backgroundColor: '#3a2a5a', marginTop: 24 },
  scanningContent: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  hint: { color: '#888', fontSize: 14, marginTop: 16, lineHeight: 20 },
  sectionDivider: { height: 1, backgroundColor: '#222', marginVertical: 28 },
  sectionTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 16 },
  lyricsExportButton: { backgroundColor: '#1a5a3a', marginTop: 4 },
  lyricsImportButton: { backgroundColor: '#3a3a5a', marginTop: 24 },
});