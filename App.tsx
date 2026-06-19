import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
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

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <RootNavigator />
    </SafeAreaProvider>
  );
}