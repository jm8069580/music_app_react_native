export type LrcLine = {
  timeMs: number;
  text: string;
};

const LRC_LINE_RE = /^\[(\d{1,3}):(\d{2})(?:\.(\d{2,3}))?\](.*)$/;

export function isLrcFormat(text: string): boolean {
  if (!text) return false;
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return false;
  const scored = lines.filter((l) => LRC_LINE_RE.test(l));
  return scored.length >= lines.length * 0.3;
}

export function parseLrc(text: string): LrcLine[] {
  const lines: LrcLine[] = [];
  for (const raw of text.split('\n')) {
    const m = raw.trim().match(LRC_LINE_RE);
    if (!m) continue;
    const minutes = parseInt(m[1], 10);
    const seconds = parseInt(m[2], 10);
    let millis = 0;
    if (m[3]) {
      millis = m[3].length === 2 ? parseInt(m[3], 10) * 10 : parseInt(m[3], 10);
    }
    const timeMs = minutes * 60000 + seconds * 1000 + millis;
    const lineText = m[4].trim();
    if (lineText) {
      lines.push({ timeMs, text: lineText });
    }
  }
  lines.sort((a, b) => a.timeMs - b.timeMs);
  return lines;
}

export function getCurrentLineIndex(lines: LrcLine[], positionMs: number): number {
  let idx = lines.length - 1;
  for (let i = 0; i < lines.length; i++) {
    if (positionMs < lines[i].timeMs) {
      idx = i - 1;
      break;
    }
  }
  return Math.max(0, idx);
}

export function formatMs(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
