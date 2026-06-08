import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import RootNavigator from './src/navigation/RootNavigator';
import { metadataService } from './src/services/metadata/metadataBackgroundService';

export default function App() {
  useEffect(() => {
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