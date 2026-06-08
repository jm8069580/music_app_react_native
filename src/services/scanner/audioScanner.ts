import * as MediaLibrary from 'expo-media-library/legacy';
import { insertSong } from '../db/songsRepository';

export type ScanResult = {
  totalFound: number;
  inserted: number;
};

type AudioAsset = {
  id: string;
  filename: string;
  uri: string;
  duration?: number | null;
};

/**
 * Solicita permisos y escanea todos los archivos .mp3 del dispositivo.
 */
export async function scanAudioLibrary(
  onProgress?: (current: number, total: number) => void
): Promise<ScanResult> {
  // 1. Permisos
  const { status } = await MediaLibrary.requestPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('Permiso denegado para acceder a archivos de audio.');
  }

  // 2. Paginado de assets de audio
  let allAssets: AudioAsset[] = [];
  let hasNextPage = true;
  let after: string | undefined;
  const pageSize = 100;

  while (hasNextPage) {
    const page = (await MediaLibrary.getAssetsAsync({
      mediaType: MediaLibrary.MediaType.audio,
      first: pageSize,
      after,
    })) as unknown as {
      assets: AudioAsset[];
      hasNextPage: boolean;
      endCursor: string | undefined;
    };

    allAssets = allAssets.concat(page.assets);
    hasNextPage = page.hasNextPage;
    after = page.endCursor;
  }

  // 3. Solo .mp3
  const mp3Assets = allAssets.filter((a) =>
    a.filename.toLowerCase().endsWith('.mp3')
  );

  const now = Date.now();
  let inserted = 0;
  for (let i = 0; i < mp3Assets.length; i++) {
    const asset = mp3Assets[i];
    const folder = extractFolder(asset.uri);
    const durationSec = asset.duration ?? 0;

    await insertSong({
      uri: asset.uri,
      title: asset.filename.replace(/\.mp3$/i, ''),
      artist: null,
      album: null,
      duration_ms: Math.round(durationSec * 1000),
      artwork_uri: null,
      metadata_extracted: 0,
      folder,
      added_at: now,
    });

    inserted++;
    onProgress?.(i + 1, mp3Assets.length);
  }

  import('../metadata/metadataBackgroundService').then(({ metadataService }) => {
  metadataService.start();
});

return { totalFound: mp3Assets.length, inserted };

  return { totalFound: mp3Assets.length, inserted };
}

function extractFolder(uri: string): string | null {
  const decoded = decodeURIComponent(uri);
  const parts = decoded.split('/');
  if (parts.length < 2) return null;
  return parts[parts.length - 2] ?? null;
}
