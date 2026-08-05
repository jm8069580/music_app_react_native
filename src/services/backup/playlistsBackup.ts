import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import {
  getPlaylists,
  getPlaylistSongs,
  createPlaylist,
  getPlaylistByName,
  addSongToPlaylist,
} from '../db/playlistsRepository';
import { getSongByUri } from '../db/songsRepository';

const BACKUP_FILE = FileSystem.documentDirectory + 'melodix-playlists-backup.json';

export type PlaylistBackupSong = { uri: string; title: string };
export type PlaylistBackupItem = {
  name: string;
  created_at: number;
  songs: PlaylistBackupSong[];
};
export type PlaylistsBackup = {
  version: number;
  exportedAt: number;
  playlists: PlaylistBackupItem[];
};

function backupFileName(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `melodix-playlists-backup-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(
    d.getDate()
  )}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}.json`;
}

async function saveBackupFile(name: string, content: string): Promise<string> {
  if (Platform.OS === 'android') {
    const permissions =
      await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
    if (permissions.granted && permissions.directoryUri) {
      const newUri = await FileSystem.StorageAccessFramework.createFileAsync(
        permissions.directoryUri,
        name.replace(/\.json$/, ''),
        'application/json'
      );
      await FileSystem.StorageAccessFramework.writeAsStringAsync(newUri, content, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      return newUri;
    }
  }
  await FileSystem.writeAsStringAsync(BACKUP_FILE, content, {
    encoding: FileSystem.EncodingType.UTF8,
  });
  return BACKUP_FILE;
}

export async function exportPlaylistsBackup(): Promise<string | null> {
  try {
    const playlists = await getPlaylists();
    if (playlists.length === 0) return null;

    const items: PlaylistBackupItem[] = [];
    for (const p of playlists) {
      const songs = await getPlaylistSongs(p.id);
      items.push({
        name: p.name,
        created_at: p.created_at,
        songs: songs.map((s) => ({ uri: s.uri, title: s.title })),
      });
    }

    const backup: PlaylistsBackup = {
      version: 1,
      exportedAt: Date.now(),
      playlists: items,
    };

    return saveBackupFile(backupFileName(), JSON.stringify(backup, null, 2));
  } catch (err) {
    console.warn('[playlistsBackup] Error exporting:', err);
    return null;
  }
}

export type PlaylistsImportResult = {
  restored: number;
  omittedSongs: number;
  omittedPlaylists: number;
  errors: number;
};

export async function importPlaylistsBackup(fileUri?: string): Promise<PlaylistsImportResult | null> {
  try {
    const uri = fileUri ?? BACKUP_FILE;
    const info = await FileSystem.getInfoAsync(uri);
    if (!info.exists) return null;

    const raw = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    const backup: PlaylistsBackup = JSON.parse(raw);

    if (!backup?.playlists || !Array.isArray(backup.playlists)) {
      console.warn('[playlistsBackup] Invalid backup format');
      return null;
    }

    let restored = 0;
    let omittedSongs = 0;
    let omittedPlaylists = 0;
    let errors = 0;

    for (const item of backup.playlists) {
      try {
        if (!item.name || !Array.isArray(item.songs)) {
          omittedPlaylists++;
          continue;
        }

        let existing = await getPlaylistByName(item.name);
        if (!existing) {
          const id = await createPlaylist(item.name);
          existing = id ? { id, name: item.name, created_at: Date.now() } : null;
        }
        if (!existing) {
          omittedPlaylists++;
          continue;
        }

        for (const s of item.songs) {
          if (!s || !s.uri) { omittedSongs++; continue; }
          const song = await getSongByUri(s.uri);
          if (!song) { omittedSongs++; continue; }
          await addSongToPlaylist(existing.id, song.id);
          restored++;
        }
      } catch {
        errors++;
      }
    }

    return { restored, omittedSongs, omittedPlaylists, errors };
  } catch (err) {
    console.warn('[playlistsBackup] Error importing:', err);
    return null;
  }
}