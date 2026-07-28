import * as FileSystem from 'expo-file-system/legacy';

const ARTWORK_DIR = FileSystem.documentDirectory + 'artwork/';

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/bmp': 'bmp',
  'image/gif': 'gif',
  'image/tiff': 'tiff',
  'image/x-tiff': 'tiff',
};

function mimeToExt(mime: string): string {
  return MIME_TO_EXT[mime.toLowerCase()] ?? 'jpg';
}

async function ensureDir() {
  const info = await FileSystem.getInfoAsync(ARTWORK_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(ARTWORK_DIR, { intermediates: true });
  }
}

function sanitizeBase64(input: string): string | null {
  let s = input.replace(/^data:image\/\w+;base64,/, '');
  s = s.replace(/[^A-Za-z0-9+/=]/g, '');
  if (s.length === 0) return null;
  const mod = s.length % 4;
  if (mod === 2) s += '==';
  else if (mod === 3) s += '=';
  else if (mod === 1) {
    console.warn('[artworkStorage] base64 inválido (longitud mod 1), se omite carátula');
    return null;
  }
  return s;
}

export async function saveArtwork(
  songId: number,
  base64: string,
  mimeType: string = 'image/jpeg'
): Promise<string | null> {
  try {
    await ensureDir();
    const ext = mimeToExt(mimeType);
    const path = `${ARTWORK_DIR}${songId}.${ext}`;

    const clean = sanitizeBase64(base64);
    if (!clean || clean.length < 100) return null;

    await FileSystem.writeAsStringAsync(path, clean, {
      encoding: FileSystem.EncodingType.Base64,
    });

    return path;
  } catch (err) {
    console.warn(`[artworkStorage] Error guardando carátula de song ${songId}:`, err);
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
