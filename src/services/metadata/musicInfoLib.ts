// Parser de metadatos de MP3 para extraer título/artista/álbum y carátula.
// Soporta ID3v2.2, v2.3 y v2.4 (con des-unsincronización y cabecera extendida),
// con fallback a ID3v1 para el texto. A diferencia del parser anterior (que sólo
// entendía v2.3/v2.4 y descartaba archivos con tags v2.2), este lee el tag ID3
// completo en memoria y recorre los frames según la versión, de modo que las
// carátulas que otros reproductores sí leen también las lee esta app.
//
// Utiliza expo-file-system/legacy porque puede leer archivos externos
// (/storage/emulated/0/...); la nueva API File rechaza open() en esas rutas.

import * as FileSystem from 'expo-file-system/legacy';
import { decode, encode } from 'base-64';

const CHUNK_SIZE = 256 * 1024;
const MAX_TAG_SIZE = 24 * 1024 * 1024;

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

// Lee `length` bytes a partir de `position` en `uri` (base64 NO_WRAP por rango).
async function readRange(uri: string, position: number, length: number): Promise<Uint8Array> {
  const raw = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
    position,
    length,
  });
  const clean = raw.replace(/[^A-Za-z0-9+/=]/g, '');
  const bin = decode(clean);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// Lee `total` bytes a partir de `start`, en pedazos para no agotar memoria.
async function readBytes(uri: string, start: number, total: number): Promise<Uint8Array> {
  const out = new Uint8Array(total);
  let written = 0;
  while (written < total) {
    const len = Math.min(CHUNK_SIZE, total - written);
    const chunk = await readRange(uri, start + written, len);
    if (chunk.length === 0) break; // EOF
    out.set(chunk, written);
    written += chunk.length;
  }
  return out.subarray(0, written);
}

function rawString(bytes: Uint8Array, start: number, len: number): string {
  let s = '';
  const end = Math.min(start + len, bytes.length);
  for (let i = start; i < end; i++) s += String.fromCharCode(bytes[i]);
  return s;
}

function isZeroBlock(bytes: Uint8Array, start: number, len: number): boolean {
  const end = Math.min(start + len, bytes.length);
  for (let i = start; i < end; i++) if (bytes[i] !== 0) return false;
  return true;
}

function syncsafeToInt(bytes: Uint8Array, start: number): number {
  return (
    ((bytes[start] & 0x7f) << 21) |
    ((bytes[start + 1] & 0x7f) << 14) |
    ((bytes[start + 2] & 0x7f) << 7) |
    (bytes[start + 3] & 0x7f)
  );
}

function uint32(bytes: Uint8Array, start: number): number {
  return (
    (bytes[start] << 24) |
    (bytes[start + 1] << 16) |
    (bytes[start + 2] << 8) |
    bytes[start + 3]
  );
}

function uint24(bytes: Uint8Array, start: number): number {
  return (bytes[start] << 16) | (bytes[start + 1] << 8) | bytes[start + 2];
}

// Elimina el padding de desyncronización (0xFF 0x00 -> 0xFF).
function removeUnsync(bytes: Uint8Array): Uint8Array {
  if (bytes.length === 0) return bytes;
  const out = new Uint8Array(bytes.length);
  let j = 0;
  for (let i = 0; i < bytes.length; i++) {
    if (bytes[i] === 0xff && i + 1 < bytes.length && bytes[i + 1] === 0x00) {
      out[j++] = 0xff;
      i++;
    } else {
      out[j++] = bytes[i];
    }
  }
  return out.subarray(0, j);
}

function decodeLatin1(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return s;
}

function decodeUtf16(bytes: Uint8Array, hasBom: boolean): string {
  let i = 0;
  let littleEndian = false;
  if (hasBom && bytes.length >= 2) {
    if (bytes[0] === 0xff && bytes[1] === 0xfe) { littleEndian = true; i = 2; }
    else if (bytes[0] === 0xfe && bytes[1] === 0xff) { littleEndian = false; i = 2; }
    else { littleEndian = true; }
  }
  let s = '';
  for (; i + 1 < bytes.length; i += 2) {
    const code = littleEndian
      ? bytes[i] | (bytes[i + 1] << 8)
      : (bytes[i] << 8) | bytes[i + 1];
    if (code === 0) break;
    s += String.fromCharCode(code);
  }
  return s;
}

function decodeUtf8(bytes: Uint8Array): string {
  let s = '';
  let i = 0;
  while (i < bytes.length) {
    const b = bytes[i];
    if (b === 0) break;
    if (b < 0x80) { s += String.fromCharCode(b); i += 1; }
    else if (b >= 0xc0 && b < 0xe0) {
      const cp = ((b & 0x1f) << 6) | (bytes[i + 1] & 0x3f);
      s += String.fromCharCode(cp);
      i += 2;
    } else if (b >= 0xe0 && b < 0xf0) {
      const cp = ((b & 0x0f) << 12) | ((bytes[i + 1] & 0x3f) << 6) | (bytes[i + 2] & 0x3f);
      s += String.fromCharCode(cp);
      i += 3;
    } else if (b >= 0xf0) {
      const cp =
        ((b & 0x07) << 18) |
        ((bytes[i + 1] & 0x3f) << 12) |
        ((bytes[i + 2] & 0x3f) << 6) |
        (bytes[i + 3] & 0x3f);
      s += String.fromCharCode(0xd800 + ((cp - 0x10000) >> 10), 0xdc00 + ((cp - 0x10000) & 0x3ff));
      i += 4;
    } else {
      i += 1;
    }
  }
  return s;
}

function decodeText(bytes: Uint8Array, encoding: number): string {
  let s: string;
  switch (encoding) {
    case 1: s = decodeUtf16(bytes, true); break;
    case 2: s = decodeUtf16(bytes, false); break;
    case 3: s = decodeUtf8(bytes); break;
    case 0:
    default: s = decodeLatin1(bytes); break;
  }
  // Si viene una cadena de varios campos (separados por nulo), nos quedamos
  // con el primero.
  const first = s.split('\u0000')[0];
  return (first ?? s).replace(/\u0000+$/, '').trim();
}

function bytesToBase64(bytes: Uint8Array): string {
  let s = '';
  const CHUNK = 8192;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    s += String.fromCharCode(...bytes.subarray(i, Math.min(i + CHUNK, bytes.length)));
  }
  return encode(s);
}

// Índice del terminador de la descripción según el encoding del frame.
function descriptionEnd(bytes: Uint8Array, start: number, encoding: number): number {
  const isUtf16 = encoding === 1 || encoding === 2;
  let i = start;
  if (isUtf16) {
    while (i + 1 < bytes.length) {
      if (bytes[i] === 0 && bytes[i + 1] === 0) return i;
      i += 2;
    }
    return bytes.length;
  }
  while (i < bytes.length) {
    if (bytes[i] === 0) return i;
    i++;
  }
  return bytes.length;
}

function formatToMime(fmt: string): string {
  const f = fmt.trim().toUpperCase();
  if (f === 'PNG') return 'image/png';
  if (f === 'JPG' || f === 'JPEG' || f === 'JPE' || f === 'JPS') return 'image/jpeg';
  if (f === 'GIF') return 'image/gif';
  if (f === 'BMP') return 'image/bmp';
  if (f === 'WEBP') return 'image/webp';
  if (f === 'TIFF') return 'image/tiff';
  return 'image/' + f.toLowerCase();
}

function parseTextFrame(data: Uint8Array): string | undefined {
  if (data.length < 1) return undefined;
  const encoding = data[0];
  return decodeText(data.subarray(1), encoding) || undefined;
}

function parsePictureFrame(data: Uint8Array, isV22: boolean): Picture | undefined {
  if (data.length < 5) return undefined;
  const encoding = data[0];

  let mime: string;
  let i: number;
  if (isV22) {
    // PIC: encoding(1) + formato(3:"JPG"/"PNG"/"GIF") + tipo(1)
    mime = formatToMime(rawString(data, 1, 3));
    i = 4;
  } else {
    // APIC: encoding(1) + MIME(nulo-terminado) + tipo(1)
    const end = data.indexOf(0, 1);
    if (end === -1) return undefined;
    mime = rawString(data, 1, end - 1) || 'image/jpeg';
    i = end + 1;
  }
  if (!mime) mime = 'image/jpeg';

  i++; // tipo de imagen (1 byte)
  if (i >= data.length) return undefined;

  const descEnd = descriptionEnd(data, i, encoding);
  const description = decodeText(data.subarray(i, descEnd), encoding);
  // Saltar el terminador de la descripción (2 bytes si UTF-16, 1 en el resto).
  i = descEnd + (encoding === 1 || encoding === 2 ? 2 : 1);

  const picBytes = data.subarray(i);
  if (picBytes.length < 24) return undefined;

  return { description, pictureData: 'data:' + mime + ';base64,' + bytesToBase64(picBytes) };
}

// Devuelve un mapa id->string para frames de texto y maneja APIC/PIC.
function processFrame(
  id: string,
  data: Uint8Array,
  isV22: boolean,
  opt: MusicInfoOptions,
  out: Partial<MusicInfoResult>,
  pictureSet: { value: boolean }
): void {
  const apply = (key: 'title' | 'artist' | 'album' | 'genre', value: string | undefined) => {
    if (value && opt[key] && out[key] === undefined) out[key] = value;
  };

  if (data === undefined) return;
  if (isV22) {
    switch (id) {
      case 'TT2': if (opt.title) apply('title', parseTextFrame(data)); break;
      case 'TP1': if (opt.artist) apply('artist', parseTextFrame(data)); break;
      case 'TAL': if (opt.album) apply('album', parseTextFrame(data)); break;
      case 'TCO': if (opt.genre) apply('genre', parseTextFrame(data)); break;
      case 'PIC': if (opt.picture && !pictureSet.value) {
        const p = parsePictureFrame(data, true);
        if (p) { out.picture = p; pictureSet.value = true; }
      } break;
    }
    return;
  }
  switch (id) {
    case 'TIT2': if (opt.title) apply('title', parseTextFrame(data)); break;
    case 'TPE1': if (opt.artist) apply('artist', parseTextFrame(data)); break;
    case 'TALB': if (opt.album) apply('album', parseTextFrame(data)); break;
    case 'TCON': if (opt.genre) apply('genre', parseTextFrame(data)); break;
    case 'APIC': if (opt.picture && !pictureSet.value) {
      const p = parsePictureFrame(data, false);
      if (p) { out.picture = p; pictureSet.value = true; }
    } break;
  }
}

// --- Parseo de contenedor MP4/M4A (atom 'covr' para la carátula) ---
// Algunos archivos con extensión .mp3 son en realidad M4A/MP4. Otros
// reproductores leen su carátula del atom 'covr'; aquí la extraemos igual.

const M4A_HEAD_SCAN = 12 * 1024 * 1024; // cabeza y cola a inspeccionar
const M4A_TEXT_MAP: Record<string, 'title' | 'artist' | 'album'> = {
  '\xa9nam': 'title',
  '\xa9ART': 'artist',
  '\xa9alb': 'album',
};

function be32(bytes: Uint8Array, pos: number): number {
  return (
    (bytes[pos] << 24) |
    (bytes[pos + 1] << 16) |
    (bytes[pos + 2] << 8) |
    bytes[pos + 3]
  );
}

function be64ToNum(bytes: Uint8Array, pos: number): number {
  const hi =
    bytes[pos] * 0x1000000 + bytes[pos + 1] * 0x10000 + bytes[pos + 2] * 0x100 + bytes[pos + 3];
  const lo =
    bytes[pos + 4] * 0x1000000 + bytes[pos + 5] * 0x10000 + bytes[pos + 6] * 0x100 + bytes[pos + 7];
  return hi * 4294967296 + lo;
}

function findMarker(bytes: Uint8Array, marker: string): number[] {
  const res: number[] = [];
  const c0 = marker.charCodeAt(0);
  for (let i = 0; i + 4 <= bytes.length; i++) {
    if (bytes[i] === c0 && rawString(bytes, i, 4) === marker) res.push(i);
  }
  return res;
}

// Recorre los boxes de MP4 a partir de `start` hasta `end` y va extrayendo
// texto/carátula. Los boxes 'moov/udta/ilst' se recorren recursivamente; los
// items de texto/carátula ('©nam', '©ART', '©alb', 'covr') contienen box 'data'.
function walkMP4Boxes(
  buf: Uint8Array,
  start: number,
  end: number,
  opt: MusicInfoOptions,
  out: Partial<MusicInfoResult>,
  pictureSet: { value: boolean }
): void {
  let pos = start;
  while (pos + 8 <= end) {
    let size = be32(buf, pos);
    const type = rawString(buf, pos + 4, 4);
    let hdr = 8;
    if (size === 1) {
      if (pos + 16 > end) return;
      size = be64ToNum(buf, pos + 8);
      hdr = 16;
    } else if (size === 0) {
      size = end - pos;
    }
    if (size < hdr) return;
    const boxStart = pos + hdr;
    const boxEnd = Math.min(pos + size, end);
    const childStart = type === 'meta' ? boxStart + 4 : boxStart; // 'meta' es full-box
    const container = size > hdr && boxEnd > childStart;

    if (type === 'moov' || type === 'udta' || type === 'ilst' || type === 'meta') {
      if (container) walkMP4Boxes(buf, childStart, boxEnd, opt, out, pictureSet);
    } else if (type === 'covr' && opt.picture && !pictureSet.value) {
      // 'covr' contiene uno o varios box 'data' con la imagen cruda.
      const img = findDataPayload(buf, boxStart, boxEnd);
      if (img) {
        const p = pictureFromBytes(img);
        if (p) { out.picture = p; pictureSet.value = true; }
      }
    } else if (type in M4A_TEXT_MAP) {
      const key = M4A_TEXT_MAP[type];
      if (opt[key] && out[key] === undefined) {
        const payload = findDataPayload(buf, boxStart, boxEnd);
        if (payload) {
          let b = payload;
          if (b.length > 0 && b[0] === 0) b = b.subarray(1); // algunos writers ponen NUL inicial
          const v = decodeText(b, 3).trim();
          if (v) out[key] = v;
        }
      }
    }
    pos = boxEnd;
  }
}

// Devuelve el payload del primer box 'data' del item, o null.
function findDataPayload(buf: Uint8Array, start: number, end: number): Uint8Array | null {
  let pos = start;
  while (pos + 8 <= end) {
    let size = be32(buf, pos);
    const type = rawString(buf, pos + 4, 4);
    if (size === 1) {
      if (pos + 16 > end) break;
      size = be64ToNum(buf, pos + 8);
      pos += 8;
    } else if (size === 0) {
      size = end - pos;
    }
    if (size < 8) break;
    const boxStart = pos + 8;
    const boxEnd = Math.min(pos + size, end);
    if (type === 'data' && boxEnd - boxStart > 8) {
      // layout iTunes: flags(4) + tipo(4) antes del payload (sin campo 'locale').
      return buf.subarray(boxStart + 8, boxEnd);
    }
    pos = boxEnd;
  }
  return null;
}

function pictureFromBytes(bytes: Uint8Array): Picture | undefined {
  let mime = 'image/jpeg';
  if (bytes.length >= 4) {
    if (bytes[0] === 0x89 && bytes[1] === 0x50) mime = 'image/png';
    else if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) mime = 'image/gif';
    else if (bytes.length >= 12 && rawString(bytes, 0, 4) === 'RIFF' && rawString(bytes, 8, 4) === 'WEBP') mime = 'image/webp';
  }
  return { description: '', pictureData: 'data:' + mime + ';base64,' + bytesToBase64(bytes) };
}

async function parseMP4(
  fileUri: string,
  fileSize: number,
  opt: MusicInfoOptions,
  out: Partial<MusicInfoResult>
): Promise<void> {
  const pictureSet = { value: false };
  const regions: { buf: Uint8Array; base: number }[] = [];

  // Cabeza (moov-first) y cola (moov al final, lo habitual en M4A).
  const headLen = Math.min(M4A_HEAD_SCAN, fileSize);
  const head = await readBytes(fileUri, 0, headLen);
  if (head.length > 0) regions.push({ buf: head, base: 0 });

  if (fileSize > headLen) {
    const tailLen = Math.min(M4A_HEAD_SCAN, fileSize);
    const tailStart = fileSize - tailLen;
    const tail = await readBytes(fileUri, tailStart, tailLen);
    if (tail.length > 0) regions.push({ buf: tail, base: tailStart });
  }

  for (const { buf, base } of regions) {
    const markers = findMarker(buf, 'moov');
    for (const m of markers) {
      if (m < 4) continue;
      // 'moov' es el *tipo* del box; su campo 'size' está 4 bytes antes.
      let size = be32(buf, m - 4);
      if (size === 1) {
        if (m - 4 + 16 > buf.length) continue;
        size = be64ToNum(buf, m - 4 + 8);
      } else if (size === 0) {
        size = buf.length - (m - 4);
      }
      if (size < 8) continue;
      const startPos = base === 0 ? 0 : m - 4; // en la cola partimos del propio box del moov
      walkMP4Boxes(buf, startPos, Math.min(m - 4 + size, buf.length), opt, out, pictureSet);
      if (pictureSet.value && (out.title !== undefined || out.album !== undefined)) return;
    }
  }
}

export async function getMusicInfoAsync(
  fileUri: string,
  options?: MusicInfoOptions
): Promise<MusicInfoResult | null> {
  const opt: MusicInfoOptions = {
    title: options?.title ?? true,
    artist: options?.artist ?? true,
    album: options?.album ?? true,
    genre: options?.genre ?? false,
    picture: options?.picture ?? false,
  };

  try {
    const file = await FileSystem.getInfoAsync(fileUri);
    if (!file.exists) return null;
    const fileSize = (file as any).size ?? 0;

    const result: MusicInfoResult = {};

    const header = await readRange(fileUri, 0, 10);
    const isId3v2 = header.length >= 3 && header[0] === 0x49 && header[1] === 0x44 && header[2] === 0x33;

    if (isId3v2) {
      const major = header[3];
      const flags = header[5];
      const tagSize = syncsafeToInt(header, 6);

      if (major >= 2 && major <= 4 && tagSize > 0 && tagSize <= MAX_TAG_SIZE) {
        let body = await readBytes(fileUri, 10, tagSize);
        if ((flags & 0x80) !== 0) body = removeUnsync(body);

        const isV22 = major === 2;
        let pos = 0;
        if (!isV22 && (flags & 0x40) !== 0 && body.length >= 4) {
          // Cabecera extendida
          pos = major === 3
            ? 4 + uint32(body, 0)
            : syncsafeToInt(body, 0);
        }
        if (pos < 0) pos = 0;

        const pictureSet = { value: false };
        while (pos < body.length) {
          if (isV22) {
            if (pos + 6 > body.length) break;
            const id = rawString(body, pos, 3);
            if (isZeroBlock(body, pos, 3)) break;
            const size = uint24(body, pos + 3);
            const frameStart = pos + 6;
            const frameEnd = Math.min(frameStart + size, body.length);
            processFrame(id, body.subarray(frameStart, frameEnd), true, opt, result, pictureSet);
            pos = frameEnd;
            continue;
          }

          if (pos + 10 > body.length) break;
          const id = rawString(body, pos, 4);
          if (isZeroBlock(body, pos, 4)) break;
          const size = major === 3 ? uint32(body, pos + 4) : syncsafeToInt(body, pos + 4);
          const fmtFlags = body[pos + 9];
          const compressed = major === 3 && (fmtFlags & 0xe0) !== 0;
          const frameStart = pos + 10;
          const frameEnd = Math.min(frameStart + size, body.length);
          let frameData = body.subarray(frameStart, frameEnd);
          if (major === 4 && (fmtFlags & 0x02) !== 0) frameData = removeUnsync(frameData);
          if (major === 4 && (fmtFlags & 0x01) !== 0 && frameData.length >= 4) {
            frameData = frameData.subarray(4);
          }
          if (!compressed) {
            processFrame(id, frameData, false, opt, result, pictureSet);
          }
          pos = frameEnd;
        }
      }
    }

    // Si no había ID3v2, o no dio todos los campos, intentar el texto ID3v1.
    if ((opt.title && result.title === undefined) ||
        (opt.artist && result.artist === undefined) ||
        (opt.album && result.album === undefined)) {
      const bytes = await readRange(fileUri, Math.max(0, fileSize - 128), 128);
      if (bytes.length >= 128 && rawString(bytes, 0, 3) === 'TAG') {
        const grab = (s: number, e: number) =>
          decodeLatin1(bytes.subarray(s, e)).replace(/\0+$/, '').trim();
        if (opt.title && result.title === undefined) { const v = grab(3, 33); if (v) result.title = v; }
        if (opt.artist && result.artist === undefined) { const v = grab(33, 63); if (v) result.artist = v; }
        if (opt.album && result.album === undefined) { const v = grab(63, 93); if (v) result.album = v; }
      }
    }

    // Si no es ID3 y el archivo es un contenedor MP4/M4A (p. ej. .mp3 con
    // cabecera M4A), extraer carátula/texto de los átomos 'covr'/'©nam'...
    if (!isId3v2 && fileSize > 8 && rawString(header, 4, 4) === 'ftyp') {
      await parseMP4(fileUri, fileSize, opt, result);
    }

    return result;
  } catch (err) {
    console.warn('[musicInfoLib] error:', err);
    return null;
  }
}