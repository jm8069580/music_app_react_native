// Fork de expo-music-info-2@2.0.0 adaptado a expo-file-system/legacy (SDK 54+)
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
    this.buffer.setData(Uint8Array.from(decode(data), (c) => c.charCodeAt(0)));
    this.filePosition += BUFFER_SIZE;
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
    await this.skip(1);
    const chunk = await this.read(frameSize - 1);
    this.frames[frameID] = this.bytesToString(chunk);
  }

  private async processPictureFrame(frameSize: number) {
    await this.skip(1);
    let remaining = frameSize - 1;
    let chunk = await this.readUntilEnd();
    remaining -= chunk.length;
    const mimeType = this.bytesToString(chunk);
    await this.skip(1);
    remaining -= 1;
    chunk = await this.readUntilEnd();
    remaining -= chunk.length;
    const description = this.bytesToString(chunk);
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
    let s = '';
    for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
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