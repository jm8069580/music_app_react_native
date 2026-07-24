import * as MediaLibrary from 'expo-media-library/legacy';
import { getAllSongsTitleUri, updateVideoUri } from '../db/songsRepository';

const VIDEO_EXTENSIONS = ['.mp4', '.mkv', '.webm', '.mov'];

export type VideoScanResult = {
  totalVideos: number;
  matched: number;
};

type VideoAsset = {
  id: string;
  filename: string;
  uri: string;
};

/**
 * Escanea videos del dispositivo y los vincula con canciones por nombre de archivo.
 * Matching: el nombre base del video (sin extensión) se compara con el title de la canción.
 */
export async function scanAndLinkVideos(
  onProgress?: (current: number, total: number) => void
): Promise<VideoScanResult> {
  const { status } = await MediaLibrary.requestPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('Permiso denegado para acceder a archivos de video.');
  }

  let allAssets: VideoAsset[] = [];
  let hasNextPage = true;
  let after: string | undefined;
  const pageSize = 100;

  while (hasNextPage) {
    const page = (await MediaLibrary.getAssetsAsync({
      mediaType: MediaLibrary.MediaType.video,
      first: pageSize,
      after,
    })) as unknown as {
      assets: VideoAsset[];
      hasNextPage: boolean;
      endCursor: string | undefined;
    };

    allAssets = allAssets.concat(page.assets);
    hasNextPage = page.hasNextPage;
    after = page.endCursor;
  }

  const videoAssets = allAssets.filter((a) => {
    const ext = a.filename.substring(a.filename.lastIndexOf('.')).toLowerCase();
    return VIDEO_EXTENSIONS.includes(ext);
  });

  const songs = await getAllSongsTitleUri();

  const titleToSong = new Map<string, { id: number; title: string }>();
  for (const song of songs) {
    titleToSong.set(song.title.toLowerCase(), { id: song.id, title: song.title });
  }

  let matched = 0;
  for (let i = 0; i < videoAssets.length; i++) {
    const asset = videoAssets[i];
    const baseName = getBaseName(asset.filename);
    const song = titleToSong.get(baseName);

    if (song) {
      await updateVideoUri(song.id, asset.uri);
      matched++;
    }

    onProgress?.(i + 1, videoAssets.length);
  }

  return { totalVideos: videoAssets.length, matched };
}

function getBaseName(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  return lastDot > 0 ? filename.substring(0, lastDot).toLowerCase() : filename.toLowerCase();
}
