// Fork de expo-music-info-2@2.0.0 adaptado a expo-file-system/legacy (SDK 54+)
// La API legacy es necesaria porque puede leer archivos externos
// (/storage/emulated/0/...); la nueva API File rechaza open() en esas rutas.
// Original: https://github.com/dmitrijkiltau/expo-music-info-2 (MIT)

import * as FileSystem from 'expo-file-system/legacy';
import { decode, encode } from 'base-64';

const BUFFER_SIZE = 256 * 1024;
const EMPTY = '';
const ID3_TOKEN = 'ID3';
const TITLE_TOKEN = 'TIT2';
const ARTIST_TOKEN = 'TPE1';
const ALBUM_TOKEN = 'TALB';
const GENRE_TOKEN = 'TCON';
const PICTURE_TOKEN = 'APIC';

export type MusicInfoOptions = {
  title?: boolean;
  artist?: boolean;
  album?: boolean;
  genre?: boolean;
  picture?: boolean;
};

export type Picture = { description: string; pictureData: string };

export type MusicInfoResult = {
  title?: string;
  artist?: string;
  album?: string;
  genre?: string;
  picture?: Picture;
};

class InvalidFileException extends Error {
  constructor() {
    super('Invalid file format.');
    this.name = 'InvalidFileException';
  }
}

class ByteBuffer {
  private data: Uint8Array = new Uint8Array(0);
  private position = 0;
  setData(d: Uint8Array) { this.data = d; this.position = 0; }
  finished() { return this.position >= this.data.length; }
  getByte() { return this.data[this.position++]; }
  move(n: number) {
    const remaining = this.data.length - this.position;
    const move = Math.min(n, remaining);
    this.position += move;
    return move;
  }
}

class Loader {
  private buffer = new ByteBuffer();
  private filePosition = 0;
  private dataSize = 0;
  private frames: Record<string, any> = {};
  private version = 0;
  private finished = false;
  private expectedFramesNumber = 0;
  private options: Required<MusicInfoOptions>;

  constructor(private fileUri: string, options?: MusicInfoOptions) {
    this.options = {
      title: options?.title ?? true,
      artist: options?.artist ?? true,
      album: options?.album ?? true,
      genre: options?.genre ?? false,
      picture: options?.picture ?? false,
    };
    Object.values(this.options).forEach((v) => v && this.expectedFramesNumber++);
  }

  async loadInfo(): Promise<MusicInfoResult | null> {
    const info = await FileSystem.getInfoAsync(this.fileUri);
    if (!info.exists) return null;
    this.dataSize = (info as any).size ?? 0;

    try {
      await this.process();
      const result: MusicInfoResult = {};
      if (this.options.title && this.frames[TITLE_TOKEN]) result.title = this.frames[TITLE_TOKEN];
      if (this.options.artist && this.frames[ARTIST_TOKEN]) result.artist = this.frames[ARTIST_TOKEN];
      if (this.options.album && this.frames[ALBUM_TOKEN]) result.album = this.frames[ALBUM_TOKEN];
      if (this.options.genre && this.frames[GENRE_TOKEN]) result.genre = this.frames[GENRE_TOKEN];
      if (this.options.picture && this.frames[PICTURE_TOKEN]) result.picture = this.frames[PICTURE_TOKEN];
      return result;
    } catch (e) {
      if (e instanceof InvalidFileException) return null;
      throw e;
    }
  }

  private async loadFileToBuffer() {
    const data = await FileSystem.readAsStringAsync(this.fileUri, {
      encoding: FileSystem.EncodingType.Base64,
      position: this.filePosition,
      length: BUFFER_SIZE,
    });
    // Algunos backends devuelven el base64 con saltos de línea; quitarlos
    // evita que el decode desalinee los bytes.
    const clean = data.replace(/[^A-Za-z0-9+/=]/g, '');
    const bytes = Uint8Array.from(decode(clean), (c) => c.charCodeAt(0));
    this.buffer.setData(bytes);
    // Avanzar por los bytes realmente leídos, no por BUFFER_SIZE: si el
    // backend devuelve menos bytes, esto evita desalinear lecturas grandes.
    this.filePosition += bytes.length;
  }

  private async process() {
    await this.processHeader();
    while (!this.finished) await this.processFrame();
  }

  private async skip(length: number) {
    let remaining = length;
    while (remaining > 0) {
      if (this.buffer.finished()) {
        if (this.filePosition >= this.dataSize) { this.finished = true; break; }
        this.filePosition += remaining;
        await this.loadFileToBuffer();
        remaining = 0;
      } else remaining -= this.buffer.move(remaining);
    }
  }

  private async read(length: number): Promise<number[]> {
    const chunk: number[] = [];
    for (let i = 0; i < length; i++) {
      if (this.buffer.finished()) {
        if (this.filePosition >= this.dataSize) { this.finished = true; break; }
        await this.loadFileToBuffer();
      }
      chunk.push(this.buffer.getByte());
    }
    return chunk;
  }

  private async readUntilEnd(): Promise<number[]> {
    let byte = 0;
    const chunk: number[] = [];
    do {
      if (this.buffer.finished()) {
        if (this.filePosition >= this.dataSize) { this.finished = true; break; }
        await this.loadFileToBuffer();
      }
      byte = this.buffer.getByte();
      chunk.push(byte);
    } while (byte !== 0);
    return chunk;
  }

  // Lee de a 2 bytes hasta el terminador UTF-16 (0x00 0x00).
  private async readUntilDoubleNull(): Promise<number[]> {
    const chunk: number[] = [];
    while (true) {
      if (this.buffer.finished()) {
        if (this.filePosition >= this.dataSize) { this.finished = true; break; }
        await this.loadFileToBuffer();
      }
      const b1 = this.buffer.getByte();
      if (this.buffer.finished()) {
        if (this.filePosition >= this.dataSize) { chunk.push(b1); this.finished = true; break; }
        await this.loadFileToBuffer();
      }
      const b2 = this.buffer.getByte();
      chunk.push(b1, b2);
      if (b1 === 0 && b2 === 0) break;
    }
    return chunk;
  }

  private async processHeader() {
    let chunk = await this.read(3);
    if (this.bytesToString(chunk) !== ID3_TOKEN) throw new InvalidFileException();
    chunk = await this.read(2);
    this.version = this.bytesToInt([chunk[0]]);
    await this.skip(1);
    chunk = await this.read(4);
    let size = 0;
    for (let i = 0; i < chunk.length; i++) size |= chunk[chunk.length - i - 1] << (i * 7);
    this.dataSize = size;
  }

  private async processFrame() {
    let chunk = await this.read(4);
    const frameID = this.bytesToString(chunk);
    if (frameID === EMPTY) { this.finished = true; return; }
    chunk = await this.read(4);
    const frameSize = this.bytesToSize(chunk);
    await this.skip(2);
    switch (frameID) {
      case TITLE_TOKEN: this.options.title ? await this.processTextFrame(frameID, frameSize) : await this.skip(frameSize); break;
      case ARTIST_TOKEN: this.options.artist ? await this.processTextFrame(frameID, frameSize) : await this.skip(frameSize); break;
      case ALBUM_TOKEN: this.options.album ? await this.processTextFrame(frameID, frameSize) : await this.skip(frameSize); break;
      case GENRE_TOKEN: this.options.genre ? await this.processTextFrame(frameID, frameSize) : await this.skip(frameSize); break;
      case PICTURE_TOKEN: this.options.picture ? await this.processPictureFrame(frameSize) : await this.skip(frameSize); break;
      default: await this.skip(frameSize); break;
    }
    if (Object.keys(this.frames).length === this.expectedFramesNumber) this.finished = true;
  }

  private async processTextFrame(frameID: string, frameSize: number) {
    // 1er byte del frame = encoding del texto; el resto son los datos.
    const encChunk = await this.read(1);
    const encoding = encChunk[0];
    const chunk = await this.read(frameSize - 1);
    this.frames[frameID] = this.decodeText(chunk, encoding);
  }

  private async processPictureFrame(frameSize: number) {
    // <encoding $xx> <MIME $00> <picture type $xx> <description (term)> <picture data>
    const encChunk = await this.read(1);
    const encoding = encChunk[0];
    let remaining = frameSize - encChunk.length;

    // MIME: siempre ISO-8859-1, terminado en un único 0x00.
    let chunk = await this.readUntilEnd();
    remaining -= chunk.length;
    const mimeType = this.bytesToString(chunk);

    // Tipo de imagen (1 byte).
    const picType = await this.read(1);
    remaining -= picType.length;

    // Descripción: el terminador depende del encoding del frame.
    //   0 = ISO-8859-1, 3 = UTF-8  -> 0x00
    //   1 = UTF-16 (BOM), 2 = UTF-16BE -> 0x00 0x00
    const isUtf16 = encoding === 1 || encoding === 2;
    chunk = isUtf16 ? await this.readUntilDoubleNull() : await this.readUntilEnd();
    remaining -= chunk.length;
    const description = this.decodeText(chunk, encoding);

    if (remaining < 0) remaining = 0;
    const pictureData = await this.read(remaining);
    this.frames[PICTURE_TOKEN] = {
      description,
      pictureData: 'data:' + mimeType + ';base64,' + this.bytesToBase64(pictureData),
    };
  }

  private bytesToString(bytes: number[]) {
    let s = '';
    for (let i = 0; i < bytes.length; i++) if (bytes[i] >= 32 && bytes[i] <= 126) s += String.fromCharCode(bytes[i]);
    return s;
  }

  /**
   * Decodifica los bytes de un frame de texto ID3 según su byte de encoding:
   *   0 = ISO-8859-1 (Latin-1)   1 = UTF-16 con BOM
   *   2 = UTF-16BE sin BOM       3 = UTF-8
   * Antes se filtraba a ASCII 32-126, lo que destruía acentos y todo UTF-16/UTF-8.
   */
  private decodeText(bytes: number[], encoding: number): string {
    let s: string;
    switch (encoding) {
      case 1: s = this.decodeUtf16(bytes, true); break;   // BOM detecta el endianness
      case 2: s = this.decodeUtf16(bytes, false); break;  // UTF-16BE sin BOM
      case 3: s = this.decodeUtf8(bytes); break;
      case 0:
      default: s = this.decodeLatin1(bytes); break;
    }
    // Quita el terminador nulo final y espacios sobrantes.
    return s.replace(/ +$/, '').trim();
  }

  private decodeLatin1(bytes: number[]): string {
    let s = '';
    for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return s;
  }

  private decodeUtf16(bytes: number[], hasBom: boolean): string {
    let i = 0;
    let littleEndian = false; // UTF-16BE por defecto (encoding 2)
    if (hasBom && bytes.length >= 2) {
      if (bytes[0] === 0xff && bytes[1] === 0xfe) { littleEndian = true; i = 2; }
      else if (bytes[0] === 0xfe && bytes[1] === 0xff) { littleEndian = false; i = 2; }
      else { littleEndian = true; } // sin BOM válido: asumir LE (lo más común)
    }
    let s = '';
    for (; i + 1 < bytes.length; i += 2) {
      const code = littleEndian
        ? bytes[i] | (bytes[i + 1] << 8)
        : (bytes[i] << 8) | bytes[i + 1];
      if (code === 0) break; // terminador 0x0000
      s += String.fromCharCode(code);
    }
    return s;
  }

  private decodeUtf8(bytes: number[]): string {
    let s = '';
    let i = 0;
    while (i < bytes.length) {
      const b = bytes[i];
      if (b === 0) break; // terminador
      if (b < 0x80) {
        s += String.fromCharCode(b);
        i += 1;
      } else if (b >= 0xc0 && b < 0xe0) {
        const cp = ((b & 0x1f) << 6) | (bytes[i + 1] & 0x3f);
        s += String.fromCharCode(cp);
        i += 2;
      } else if (b >= 0xe0 && b < 0xf0) {
        const cp = ((b & 0x0f) << 12) | ((bytes[i + 1] & 0x3f) << 6) | (bytes[i + 2] & 0x3f);
        s += String.fromCharCode(cp);
        i += 3;
      } else if (b >= 0xf0) {
        let cp =
          ((b & 0x07) << 18) |
          ((bytes[i + 1] & 0x3f) << 12) |
          ((bytes[i + 2] & 0x3f) << 6) |
          (bytes[i + 3] & 0x3f);
        cp -= 0x10000;
        s += String.fromCharCode(0xd800 + (cp >> 10), 0xdc00 + (cp & 0x3ff));
        i += 4;
      } else {
        i += 1; // byte de continuación suelto: ignorar
      }
    }
    return s;
  }
  private bytesToInt(bytes: number[]) {
    let a = 0;
    for (let i = 0; i < bytes.length; i++) a |= bytes[bytes.length - i - 1] << (i * 8);
    return a;
  }
  private bytesToSize(bytes: number[]) {
    if (this.version === 3) return this.bytesToInt(bytes);
    let a = 0;
    for (let i = 0; i < bytes.length; i++) a |= bytes[bytes.length - i - 1] << (i * 7);
    return a;
  }
  private bytesToBase64(bytes: number[]) {
    // Construir el string binario en bloques con fromCharCode.apply evita el
    // coste cuadrático de concatenar byte a byte (las carátulas son grandes).
    let s = '';
    const CHUNK = 8192;
    for (let i = 0; i < bytes.length; i += CHUNK) {
      s += String.fromCharCode.apply(null, bytes.slice(i, i + CHUNK));
    }
    return encode(s);
  }
}

export async function getMusicInfoAsync(
  fileUri: string,
  options?: MusicInfoOptions
): Promise<MusicInfoResult | null> {
  const loader = new Loader(fileUri, options);
  return loader.loadInfo();
}
