import { create } from 'zustand';
import { getFavoriteIds, setFavorite } from '../db/songsRepository';

type FavoritesState = {
  ids: Set<number>;
  loaded: boolean;
  /** Carga los IDs favoritos desde la BD (llamar una vez al arrancar). */
  load: () => Promise<void>;
  /** Alterna favorito de forma optimista y persiste en BD. */
  toggle: (songId: number) => Promise<void>;
};

export const useFavoritesStore = create<FavoritesState>((set, get) => ({
  ids: new Set<number>(),
  loaded: false,

  load: async () => {
    const favs = await getFavoriteIds();
    set({ ids: new Set(favs), loaded: true });
  },

  toggle: async (songId) => {
    const ids = new Set(get().ids);
    const willBeFavorite = !ids.has(songId);
    if (willBeFavorite) ids.add(songId);
    else ids.delete(songId);
    set({ ids }); // optimista: la UI reacciona al instante
    try {
      await setFavorite(songId, willBeFavorite);
    } catch {
      // Si falla la persistencia, revertir el estado optimista.
      const reverted = new Set(get().ids);
      if (willBeFavorite) reverted.delete(songId);
      else reverted.add(songId);
      set({ ids: reverted });
    }
  },
}));

/** Selector reactivo: ¿es favorita esta canción? */
export const useIsFavorite = (id?: number | null): boolean =>
  useFavoritesStore((s) => (id != null ? s.ids.has(id) : false));
