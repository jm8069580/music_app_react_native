import { useEffect } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import TrackPlayer from '@rntp/player';
import RootNavigator from './src/navigation/RootNavigator';
import { metadataService } from './src/services/metadata/metadataBackgroundService';
import { usePlayerStore } from './src/services/player/playerStore';
import { useFavoritesStore } from './src/services/player/favoritesStore';

export default function App() {
  useEffect(() => {
    // Inicializa el player nativo (RNTP) y, una vez listo, restaura la cola
    // persistida (en pausa) para retomar donde se dejó.
    usePlayerStore
      .getState()
      .init()
      .then(() => usePlayerStore.getState().restore())
      .catch(() => {});
    // Carga los IDs favoritos para que el corazón refleje el estado al instante.
    useFavoritesStore.getState().load();
    // Retomar metadatos pendientes si los hay
    metadataService.start();
  }, []);

  useEffect(() => {
    const handleAppState = async (next: AppStateStatus) => {
      if (next !== 'active') return;
      const st = usePlayerStore.getState();
      if (!st.ready || st.queue.length === 0) return;
      try {
        const nativeIndex = TrackPlayer.getActiveMediaItemIndex();
        if (nativeIndex != null && nativeIndex !== st.currentIndex && st.queue[nativeIndex]) {
          usePlayerStore.setState({
            currentIndex: nativeIndex,
            currentSong: st.queue[nativeIndex],
          });
        }
        const playbackState = await TrackPlayer.getPlaybackState();
        usePlayerStore.setState({ isPlaying: playbackState.isPlaying });
      } catch {
        // player no listo aún
      }
    };
    const sub = AppState.addEventListener('change', handleAppState);
    return () => sub.remove();
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <RootNavigator />
    </SafeAreaProvider>
  );
}