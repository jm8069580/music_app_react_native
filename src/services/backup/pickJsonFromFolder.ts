import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

/**
 * Pide al usuario elegir una carpeta (SAF) y devuelve un archivo .json de ella.
 * Prefiere el que coincida con `keyword` en el nombre; si hay varios, el primero.
 * Devuelve null si no se otorga permiso o no hay .json. Solo aplica en Android.
 */
export async function pickJsonFileFromFolder(keyword: string): Promise<string | null> {
  if (Platform.OS !== 'android') return null;
  try {
    const permissions =
      await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
    if (!permissions.granted || !permissions.directoryUri) return null;

    const files = await FileSystem.StorageAccessFramework.readDirectoryAsync(
      permissions.directoryUri
    );
    const jsonFiles = files.filter((f) => f.toLowerCase().endsWith('.json'));
    if (jsonFiles.length === 0) return null;

    return jsonFiles.find((f) => f.toLowerCase().includes(keyword.toLowerCase())) ?? jsonFiles[0];
  } catch (err) {
    console.warn('[pickJsonFromFolder] Error:', err);
    return null;
  }
}