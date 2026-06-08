import { getMusicInfoAsync } from './musicInfoLib';
import { saveArtwork } from '../storage/artworkStorage';
import type { SongMetadataUpdate } from '../../types/song';

export async function extractMetadata(
    songId: number,
    uri: string
): Promise<SongMetadataUpdate> {
    const update: SongMetadataUpdate = {};

    try {
        console.log('[extractMetadata] usando lib LOCAL para:', uri);
        const info = await getMusicInfoAsync(uri, {
            title: true,
            artist: true,
            album: true,
            genre: false,
            picture: true,
        });

        if (!info) return update;

        if (info.title && info.title.trim()) {
            update.title = info.title.trim();
        }
        if (info.artist && info.artist.trim()) {
            update.artist = info.artist.trim();
        }
        if (info.album && info.album.trim()) {
            update.album = info.album.trim();
        }

        if (info.picture?.pictureData) {
            const dataUri = info.picture.pictureData;
            const mimeMatch = dataUri.match(/^data:(image\/\w+);base64,/);
            const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
            const base64 = dataUri.replace(/^data:image\/\w+;base64,/, '');
            if (base64.length > 0) {
                const artworkUri = await saveArtwork(songId, base64, mimeType);
                if (artworkUri) {
                    update.artwork_uri = artworkUri;
                }
            }
        }
    } catch (err) {
        console.warn(`[metadataExtractor] Falló para ${uri}:`, err);
    }

    return update;
}