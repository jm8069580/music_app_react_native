import * as MediaLibrary from 'expo-media-library/legacy';
import { getAllSongsTitleUri, updateVideoUri } from '../db/songsRepository';

const VIDEO_EXTENSIONS = ['.mp4', '.mkv', '.webm', '.mov'];

export type VideoScanResult = {
  totalVideos: number;
  matched: number;
  videoNames: string[];
  songTitles: string[];
  songFileNames: string[];
};

type VideoAsset = {
  id: string;
  filename: string;
  uri: string;
};

/**
 * Escanea videos del dispositivo y los vincula con canciones por nombre de archivo.
 * Intenta dos estrategias de matching:
 * 1. Nombre del video vs title de la canción (post-ID3)
 * 2. Nombre del video vs nombre original del archivo de audio (desde la URI)
 */
export async function scanAndLinkVideos(
  onProgress?: (current: number, total: number) => void
): Promise<VideoScanResult> {
  const { status } = await MediaLibrary.requestPermissionsAsync(false, ['video']);
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

  // Indexar por título (post-ID3)
  const titleToSong = new Map<string, number>();
  for (const song of songs) {
    titleToSong.set(song.title.toLowerCase(), song.id);
  }

  // Indexar por nombre original del archivo de audio (desde la URI)
  const audioFilenameToSong = new Map<string, number>();
  for (const song of songs) {
    const audioName = getBaseName(extractFilenameFromUri(song.uri));
    if (audioName) {
      audioFilenameToSong.set(audioName, song.id);
    }
  }

  let matched = 0;
  for (let i = 0; i < videoAssets.length; i++) {
    const asset = videoAssets[i];
    const videoName = getBaseName(asset.filename);

    // Estrategia 1: matchear por título de canción
    let songId = titleToSong.get(videoName);

    // Estrategia 2: matchear por nombre original del archivo de audio
    if (!songId) {
      songId = audioFilenameToSong.get(videoName);
    }

    if (songId) {
      await updateVideoUri(songId, asset.uri);
      matched++;
    }

    onProgress?.(i + 1, videoAssets.length);
  }

  return {
    totalVideos: videoAssets.length,
    matched,
    videoNames: videoAssets.map((a) => getBaseName(a.filename)),
    songTitles: songs.map((s) => s.title.toLowerCase()),
    songFileNames: songs.map((s) => getBaseName(extractFilenameFromUri(s.uri))),
  };
}

function getBaseName(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  return lastDot > 0 ? filename.substring(0, lastDot).toLowerCase() : filename.toLowerCase();
}

function extractFilenameFromUri(uri: string): string {
  const decoded = decodeURIComponent(uri);
  const lastSlash = decoded.lastIndexOf('/');
  return lastSlash >= 0 ? decoded.substring(lastSlash + 1) : decoded;
}
