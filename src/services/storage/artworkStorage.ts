import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base-64';

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

    // Rechaza slices corruptos: si los primeros bytes no tienen la firma de una
    // imagen válida, mejor no escribir una carátula que rompería la vista.
    if (!looksLikeImage(clean)) {
      console.warn(
        `[artworkStorage] Firma de imagen no reconocida para song ${songId} (mime: ${mimeType}, len: ${clean.length}); se omite`
      );
      return null;
    }

    await FileSystem.writeAsStringAsync(path, clean, {
      encoding: FileSystem.EncodingType.Base64,
    });

    return path;
  } catch (err) {
    console.warn(`[artworkStorage] Error guardando carátula de song ${songId}:`, err);
    return null;
  }
}

// Comprueba las firmas ("magic bytes") más habituales de imagen.
function looksLikeImage(base64: string): boolean {
  try {
    const head = base64.slice(0, 16);
    const bytes = decode(head);
    // PNG
    if (/^\x89PNG\r\n\x1a\n/.test(bytes)) return true;
    // JPEG
    if (bytes.charCodeAt(0) === 0xff && bytes.charCodeAt(1) === 0xd8) return true;
    // GIF
    if (/^GIF8/.test(bytes)) return true;
    // BMP
    if (bytes.charCodeAt(0) === 0x42 && bytes.charCodeAt(1) === 0x4d) return true;
    // TIFF (little/big endian)
    if (bytes.charCodeAt(0) === 0x49 && bytes.charCodeAt(1) === 0x49) return true;
    if (bytes.charCodeAt(0) === 0x4d && bytes.charCodeAt(1) === 0x4d) return true;
    // WEBP (RIFF....WEBP)
    if (/^RIFF/.test(bytes) && bytes.length >= 12 && bytes.slice(8, 12) === 'WEBP') return true;
    return false;
  } catch {
    return false;
  }
}

export async function deleteArtwork(uri: string): Promise<void> {
  try {
    await FileSystem.deleteAsync(uri, { idempotent: true });
  } catch {
    // ignorar
  }
}
