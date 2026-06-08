export type Song = {
  id: number;
  uri: string;
  title: string;
  artist: string | null;
  album: string | null;
  duration_ms: number;
  artwork_uri: string | null;
  folder: string | null;
  added_at: number;
  metadata_extracted: number; // 0 | 1
};

export type NewSong = Omit<Song, 'id' | 'metadata_extracted'>;

export type SongMetadataUpdate = {
  title?: string;
  artist?: string | null;
  album?: string | null;
  duration_ms?: number;
  artwork_uri?: string | null;
};