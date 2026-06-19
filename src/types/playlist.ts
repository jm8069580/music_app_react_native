export type Playlist = {
  id: number;
  name: string;
  created_at: number;
};

/** Playlist con el número de canciones que contiene (para la lista). */
export type PlaylistWithCount = Playlist & {
  song_count: number;
};
