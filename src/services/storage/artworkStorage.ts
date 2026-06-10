import * as FileSystem from 'expo-file-system/legacy';

const ARTWORK_DIR = FileSystem.documentDirectory + 'artwork/';

async function ensureDir() {
  const info = await FileSystem.getInfoAsync(ARTWORK_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(ARTWORK_DIR, { intermediates: true });
  }
}

/**
 * Limpia y normaliza un string base64:
 * - quita prefijo data:
 * - elimina whitespace
 * - filtra caracteres no permitidos
 * - ajusta padding
 */
function sanitizeBase64(input: string): string {
  let s = input.replace(/^data:image\/\w+;base64,/, '');
  // Quitar todo lo que no sea válido base64
  s = s.replace(/[^A-Za-z0-9+/=]/g, '');
  // Ajustar padding a múltiplo de 4
  const mod = s.length % 4;
  if (mod === 2) s += '==';
  else if (mod === 3) s += '=';
  else if (mod === 1) s = s.slice(0, -1); // descarta byte huérfano
  return s;
}

export async function saveArtwork(
  songId: number,
  base64: string,
  mimeType: string = 'image/jpeg'
): Promise<string | null> {
  try {
    await ensureDir();
    const ext = mimeType.includes('png') ? 'png' : 'jpg';
    const path = `${ARTWORK_DIR}${songId}.${ext}`;

    const clean = sanitizeBase64(base64);
    if (clean.length < 100) {
      // Muy pequeño para ser una imagen real
      return null;
    }

    await FileSystem.writeAsStringAsync(path, clean, {
      encoding: FileSystem.EncodingType.Base64,
    });

    return path;
  } catch (err) {
    //console.warn(`[artworkStorage] No se pudo guardar artwork de song ${songId}:`, err);
    return null;
  }
}

export async function deleteArtwork(uri: string): Promise<void> {
  try {
    await FileSystem.deleteAsync(uri, { idempotent: true });
  } catch {
    // ignorar
  }
}
