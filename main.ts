// gta6-meme-x-01 — a GTA 6 meme entry for the make.fun bounty.
//
// What this program does:
//   1. Draws the meme picture from scratch with a small software rasterizer
//      (Vice City sunset, the make.fun ghost driving a convertible, a neon
//      "make.fun" billboard, heavy meme captions) and writes it as a PNG
//      with a hand-rolled encoder (node:zlib, standard library only).
//      Three variants are rendered; the winner is also written as memes/meme.png.
//   2. Copies POST.json from the repository root to the output directory,
//      which is what the bounty gate reads.
//
// Deterministic: the same input always produces the same output bytes.
// No network, no external packages, no clock, no randomness.
//
// Run it locally:
//   mkdir -p out && MAKEFUN_BOT_DIR=. MAKEFUN_OUTPUT_DIR=out node main.ts

import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { join } from 'node:path';

// ---------------------------------------------------------------------------
// Small deterministic helpers
// ---------------------------------------------------------------------------

function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// ---------------------------------------------------------------------------
// PNG encoder (hand-rolled, RGBA, filter 0)
// ---------------------------------------------------------------------------

const CRC_TABLE: Uint32Array = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePng(width: number, height: number, rgba: Uint8Array): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + y * stride, stride).copy(raw, y * (stride + 1) + 1);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idat),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------------------
// Canvas: a flat RGBA buffer with simple raster primitives
// ---------------------------------------------------------------------------

type RGB = [number, number, number];
type RGBA = [number, number, number, number];

class Canvas {
  readonly w: number;
  readonly h: number;
  readonly buf: Uint8Array;

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.buf = new Uint8Array(w * h * 4);
  }

  set(x: number, y: number, c: RGBA): void {
    const xi = Math.round(x);
    const yi = Math.round(y);
    if (xi < 0 || yi < 0 || xi >= this.w || yi >= this.h) return;
    const i = (yi * this.w + xi) * 4;
    const a = c[3] / 255;
    if (a >= 1) {
      this.buf[i] = c[0];
      this.buf[i + 1] = c[1];
      this.buf[i + 2] = c[2];
      this.buf[i + 3] = 255;
    } else if (a > 0) {
      this.buf[i] = Math.round(this.buf[i] * (1 - a) + c[0] * a);
      this.buf[i + 1] = Math.round(this.buf[i + 1] * (1 - a) + c[1] * a);
      this.buf[i + 2] = Math.round(this.buf[i + 2] * (1 - a) + c[2] * a);
      this.buf[i + 3] = 255;
    }
  }

  rect(x0: number, y0: number, x1: number, y1: number, c: RGBA): void {
    const xa = clamp(Math.floor(Math.min(x0, x1)), 0, this.w - 1);
    const xb = clamp(Math.ceil(Math.max(x0, x1)), 0, this.w - 1);
    const ya = clamp(Math.floor(Math.min(y0, y1)), 0, this.h - 1);
    const yb = clamp(Math.ceil(Math.max(y0, y1)), 0, this.h - 1);
    for (let y = ya; y <= yb; y++) {
      for (let x = xa; x <= xb; x++) this.set(x, y, c);
    }
  }

  disc(cx: number, cy: number, r: number, c: RGBA): void {
    const xa = clamp(Math.floor(cx - r), 0, this.w - 1);
    const xb = clamp(Math.ceil(cx + r), 0, this.w - 1);
    const ya = clamp(Math.floor(cy - r), 0, this.h - 1);
    const yb = clamp(Math.ceil(cy + r), 0, this.h - 1);
    for (let y = ya; y <= yb; y++) {
      for (let x = xa; x <= xb; x++) {
        const dx = x - cx;
        const dy = y - cy;
        if (dx * dx + dy * dy <= r * r) this.set(x, y, c);
      }
    }
  }

  ellipse(cx: number, cy: number, rx: number, ry: number, c: RGBA): void {
    const xa = clamp(Math.floor(cx - rx), 0, this.w - 1);
    const xb = clamp(Math.ceil(cx + rx), 0, this.w - 1);
    const ya = clamp(Math.floor(cy - ry), 0, this.h - 1);
    const yb = clamp(Math.ceil(cy + ry), 0, this.h - 1);
    for (let y = ya; y <= yb; y++) {
      for (let x = xa; x <= xb; x++) {
        const dx = (x - cx) / rx;
        const dy = (y - cy) / ry;
        if (dx * dx + dy * dy <= 1) this.set(x, y, c);
      }
    }
  }

  // Distance from point to segment, for thick lines.
  private segDist(px: number, py: number, x0: number, y0: number, x1: number, y1: number): number {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len2 = dx * dx + dy * dy;
    let t = len2 === 0 ? 0 : ((px - x0) * dx + (py - y0) * dy) / len2;
    t = clamp(t, 0, 1);
    const qx = x0 + t * dx;
    const qy = y0 + t * dy;
    return Math.hypot(px - qx, py - qy);
  }

  thickLine(x0: number, y0: number, x1: number, y1: number, width: number, c: RGBA): void {
    const r = width / 2;
    const xa = clamp(Math.floor(Math.min(x0, x1) - r), 0, this.w - 1);
    const xb = clamp(Math.ceil(Math.max(x0, x1) + r), 0, this.w - 1);
    const ya = clamp(Math.floor(Math.min(y0, y1) - r), 0, this.h - 1);
    const yb = clamp(Math.ceil(Math.max(y0, y1) + r), 0, this.h - 1);
    for (let y = ya; y <= yb; y++) {
      for (let x = xa; x <= xb; x++) {
        if (this.segDist(x, y, x0, y0, x1, y1) <= r) this.set(x, y, c);
      }
    }
  }

  poly(points: Array<[number, number]>, c: RGBA): void {
    if (points.length < 3) return;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const [, y] of points) {
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    const ya = clamp(Math.floor(minY), 0, this.h - 1);
    const yb = clamp(Math.ceil(maxY), 0, this.h - 1);
    for (let y = ya; y <= yb; y++) {
      const xs: number[] = [];
      for (let i = 0; i < points.length; i++) {
        const [x0, y0] = points[i];
        const [x1, y1] = points[(i + 1) % points.length];
        if ((y0 <= y && y1 > y) || (y1 <= y && y0 > y)) {
          xs.push(x0 + ((y - y0) * (x1 - x0)) / (y1 - y0));
        }
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const xa = clamp(Math.floor(xs[k]), 0, this.w - 1);
        const xb = clamp(Math.ceil(xs[k + 1]), 0, this.w - 1);
        for (let x = xa; x <= xb; x++) this.set(x, y, c);
      }
    }
  }

  roundedRect(x: number, y: number, w: number, h: number, r: number, c: RGBA): void {
    this.rect(x + r, y, x + w - r, y + h, c);
    this.rect(x, y + r, x + w, y + h - r, c);
    this.disc(x + r, y + r, r, c);
    this.disc(x + w - r, y + r, r, c);
    this.disc(x + r, y + h - r, r, c);
    this.disc(x + w - r, y + h - r, r, c);
  }

  // A 4-point sparkle star (the make.fun ghost's eyes).
  star4(cx: number, cy: number, r: number, c: RGBA): void {
    const inner = r * 0.26;
    const pts: Array<[number, number]> = [];
    for (let k = 0; k < 8; k++) {
      const ang = (Math.PI / 4) * k - Math.PI / 2;
      const rad = k % 2 === 0 ? r : inner;
      pts.push([cx + rad * Math.cos(ang), cy + rad * Math.sin(ang)]);
    }
    this.poly(pts, c);
  }

  // A 5-point star (the white star on the magenta coin).
  star5(cx: number, cy: number, rOuter: number, rInner: number, c: RGBA): void {
    const pts: Array<[number, number]> = [];
    for (let k = 0; k < 10; k++) {
      const ang = (Math.PI / 5) * k - Math.PI / 2;
      const rad = k % 2 === 0 ? rOuter : rInner;
      pts.push([cx + rad * Math.cos(ang), cy + rad * Math.sin(ang)]);
    }
    this.poly(pts, c);
  }

  toPng(): Buffer {
    return encodePng(this.w, this.h, this.buf);
  }
}

// ---------------------------------------------------------------------------
// Bitmap font: 5x7 glyphs, drawn blocky and heavy like Impact.
// ---------------------------------------------------------------------------

const FONT: Record<string, string[]> = {
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  C: ['01110', '10001', '10000', '10000', '10000', '10001', '01110'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  G: ['01110', '10001', '10000', '10111', '10001', '10001', '01111'],
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  I: ['01110', '00100', '00100', '00100', '00100', '00100', '01110'],
  J: ['00111', '00010', '00010', '00010', '00010', '10010', '01100'],
  K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  Q: ['01110', '10001', '10001', '10001', '10101', '10010', '01101'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  V: ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
  W: ['10001', '10001', '10001', '10101', '10101', '10101', '01010'],
  X: ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
  Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
  Z: ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
  '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '2': ['01110', '10001', '00001', '00110', '01000', '10000', '11111'],
  '3': ['11111', '00010', '00100', '00010', '00001', '10001', '01110'],
  '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  '5': ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  '6': ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
  '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  '9': ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
  a: ['00000', '00000', '01110', '00001', '01111', '10001', '01111'],
  b: ['10000', '10000', '10110', '11001', '10001', '10001', '11110'],
  c: ['00000', '00000', '01110', '10000', '10000', '10001', '01110'],
  d: ['00001', '00001', '01101', '10011', '10001', '10001', '01111'],
  e: ['00000', '00000', '01110', '10001', '11111', '10000', '01110'],
  f: ['00110', '01001', '01000', '11110', '01000', '01000', '01000'],
  g: ['00000', '01111', '10001', '10001', '01111', '00001', '01110'],
  h: ['10000', '10000', '10110', '11001', '10001', '10001', '10001'],
  i: ['00100', '00000', '01100', '00100', '00100', '00100', '01110'],
  j: ['00010', '00000', '00110', '00010', '00010', '10010', '01100'],
  k: ['10000', '10000', '10010', '10100', '11000', '10100', '10010'],
  l: ['01100', '00100', '00100', '00100', '00100', '00100', '01110'],
  m: ['00000', '00000', '11010', '10101', '10101', '10101', '10101'],
  n: ['00000', '00000', '10110', '11001', '10001', '10001', '10001'],
  o: ['00000', '00000', '01110', '10001', '10001', '10001', '01110'],
  p: ['00000', '00000', '10110', '11001', '10001', '11110', '10000'],
  q: ['00000', '00000', '01101', '10011', '10001', '01111', '00001'],
  r: ['00000', '00000', '10110', '11001', '10000', '10000', '10000'],
  s: ['00000', '00000', '01111', '10000', '01110', '00001', '11110'],
  t: ['01000', '01000', '11100', '01000', '01000', '01000', '00110'],
  u: ['00000', '00000', '10001', '10001', '10001', '10011', '01101'],
  v: ['00000', '00000', '10001', '10001', '10001', '01010', '00100'],
  w: ['00000', '00000', '10001', '10101', '10101', '10101', '01010'],
  x: ['00000', '00000', '10001', '01010', '00100', '01010', '10001'],
  y: ['00000', '00000', '10001', '10001', '01111', '00001', '01110'],
  z: ['00000', '00000', '11111', '00010', '00100', '01000', '11111'],
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
  '.': ['00000', '00000', '00000', '00000', '00000', '01100', '01100'],
  ',': ['00000', '00000', '00000', '00000', '01100', '00100', '01000'],
  '!': ['00100', '00100', '00100', '00100', '00100', '00000', '00100'],
  '?': ['01110', '10001', '00001', '00110', '00100', '00000', '00100'],
  "'": ['00100', '00100', '01000', '00000', '00000', '00000', '00000'],
  ':': ['00000', '01100', '01100', '00000', '01100', '01100', '00000'],
  $: ['00100', '01111', '10100', '01110', '00101', '11110', '00100'],
  '%': ['11001', '11010', '00010', '00100', '01000', '01011', '10011'],
  '&': ['01100', '10010', '10100', '01000', '10101', '10010', '01101'],
  '-': ['00000', '00000', '00000', '01110', '00000', '00000', '00000'],
  '/': ['00001', '00010', '00010', '00100', '01000', '01000', '10000'],
  '(': ['00010', '00100', '01000', '01000', '01000', '00100', '00010'],
  ')': ['01000', '00100', '00010', '00010', '00010', '00100', '01000'],
  '+': ['00000', '00100', '00100', '01110', '00100', '00100', '00000'],
  '=': ['00000', '00000', '11111', '00000', '11111', '00000', '00000'],
  '"': ['01010', '01010', '00000', '00000', '00000', '00000', '00000'],
  '#': ['01010', '01010', '11111', '01010', '11111', '01010', '01010'],
};

function textWidth(text: string, scale: number): number {
  return text.length * 6 * scale - scale;
}

function drawGlyphs(cv: Canvas, text: string, x: number, y: number, scale: number, c: RGBA): void {
  for (let i = 0; i < text.length; i++) {
    const glyph = FONT[text[i]] ?? FONT[' '];
    const gx = x + i * 6 * scale;
    for (let r = 0; r < 7; r++) {
      const row = glyph[r];
      for (let col = 0; col < 5; col++) {
        if (row[col] === '1') cv.rect(gx + col * scale, y + r * scale, gx + (col + 1) * scale - 1, y + (r + 1) * scale - 1, c);
      }
    }
  }
}

// Centred text with a heavy outline so it reads at 300 px wide.
function drawText(cv: Canvas, text: string, cx: number, y: number, scale: number, fill: RGBA, outline: RGBA): void {
  const w = textWidth(text, scale);
  const x = Math.round(cx - w / 2);
  const ow = Math.max(3, Math.round(scale * 0.4));
  const offsets: Array<[number, number]> = [
    [-ow, 0], [ow, 0], [0, -ow], [0, ow],
    [-ow, -ow], [ow, -ow], [-ow, ow], [ow, ow],
  ];
  for (const [dx, dy] of offsets) drawGlyphs(cv, text, x + dx, y + dy, scale, outline);
  drawGlyphs(cv, text, x, y, scale, fill);
}

function fitScale(lines: string[], maxWidth: number, maxScale: number): number {
  let scale = maxScale;
  for (const line of lines) {
    const s = Math.floor(maxWidth / (line.length * 6));
    if (s < scale) scale = s;
  }
  return Math.max(4, scale);
}

// ---------------------------------------------------------------------------
// Colours
// ---------------------------------------------------------------------------

const WHITE: RGBA = [255, 255, 255, 255];
const BLACK: RGBA = [10, 8, 16, 255];
const INK: RGBA = [16, 10, 30, 255];
const MAGENTA: RGBA = [255, 46, 196, 255];
const NEON_PINK: RGBA = [255, 92, 225, 255];
const SUN_YELLOW: RGBA = [255, 243, 176, 255];
const CAPTION_YELLOW: RGBA = [255, 233, 77, 255];

function skyColor(t: number): RGB {
  const stops: Array<[number, RGB]> = [
    [0.0, [38, 8, 74]],
    [0.32, [140, 22, 112]],
    [0.58, [255, 62, 118]],
    [0.8, [255, 122, 58]],
    [1.0, [255, 186, 92]],
  ];
  for (let i = 0; i + 1 < stops.length; i++) {
    const [t0, c0] = stops[i];
    const [t1, c1] = stops[i + 1];
    if (t >= t0 && t <= t1) {
      const f = (t - t0) / (t1 - t0);
      return [Math.round(lerp(c0[0], c1[0], f)), Math.round(lerp(c0[1], c1[1], f)), Math.round(lerp(c0[2], c1[2], f))];
    }
  }
  return stops[stops.length - 1][1];
}

// ---------------------------------------------------------------------------
// Scene pieces
// ---------------------------------------------------------------------------

function drawSun(cv: Canvas, cx: number, cy: number, r: number): void {
  // Warm glow, then the disc, then retro slits across its lower half.
  for (let k = 5; k >= 1; k--) {
    cv.disc(cx, cy, r + k * 14, [255, 140, 60, 26]);
  }
  cv.disc(cx, cy, r, SUN_YELLOW);
  cv.disc(cx, cy, r - 14, [255, 250, 200, 255]);
  for (let i = 0; i < 5; i++) {
    const y = cy + 12 + i * 24;
    const half = Math.sqrt(Math.max(0, r * r - (y - cy) * (y - cy)));
    if (half <= 0) continue;
    const sc = skyColor(clamp(y / 760, 0, 1));
    const h = 7 + i * 2;
    cv.rect(cx - half, y, cx + half, y + h, [sc[0], sc[1], sc[2], 255]);
  }
}

function drawPalm(cv: Canvas, baseX: number, baseY: number, height: number, lean: number, c: RGBA): void {
  const topX = baseX + lean;
  const topY = baseY - height;
  // Trunk: a gentle curve made of short thick segments.
  const steps = 10;
  let px = baseX;
  let py = baseY;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const nx = baseX + lean * t * t;
    const ny = baseY - height * t;
    cv.thickLine(px, py, nx, ny, 24 - t * 8, c);
    px = nx;
    py = ny;
  }
  // Fronds: drooping curved blades radiating from the crown.
  const fronds: Array<[number, number, number]> = [
    [-150, -30, 60], [-110, -70, 30], [-55, -95, 5], [0, -100, -5],
    [55, -95, -30], [110, -70, -60], [150, -30, -95],
  ];
  for (const [dx, dy, droop] of fronds) {
    const tipX = topX + dx;
    const tipY = topY + dy + Math.abs(dx) * 0.35 + droop * 0.4;
    const midX = topX + dx * 0.55;
    const midY = topY + dy * 0.55 - 18;
    cv.thickLine(topX, topY, midX, midY, 15, c);
    cv.thickLine(midX, midY, tipX, tipY, 11, c);
  }
  // Coconuts.
  cv.disc(topX - 12, topY + 14, 11, c);
  cv.disc(topX + 12, topY + 16, 11, c);
}

function drawSkyline(cv: Canvas, seed: number): void {
  const rnd = lcg(seed);
  const horizon = 760;
  let x = -20;
  while (x < 1200) {
    const w = 60 + Math.floor(rnd() * 80);
    const h = 90 + Math.floor(rnd() * 120);
    const top = horizon - h;
    const shade = 22 + Math.floor(rnd() * 14);
    cv.rect(x, top, x + w, horizon, [shade, 9, 46, 255]);
    // Rooftop antenna on some towers.
    if (rnd() < 0.35) {
      cv.rect(x + w / 2 - 2, top - 34, x + w / 2 + 2, top, [shade, 9, 46, 255]);
      cv.disc(x + w / 2, top - 38, 5, [255, 60, 80, 255]);
    }
    // Lit windows.
    const cols = Math.floor(w / 18);
    const rows = Math.floor(h / 26);
    for (let r = 0; r < rows; r++) {
      for (let col = 0; col < cols; col++) {
        if (rnd() < 0.28) {
          const wx = x + 8 + col * 18;
          const wy = top + 12 + r * 26;
          const lit: RGBA = rnd() < 0.6 ? [255, 209, 102, 255] : [125, 249, 255, 255];
          cv.rect(wx, wy, wx + 8, wy + 12, lit);
        }
      }
    }
    x += w + 4 + Math.floor(rnd() * 14);
  }
}

function drawBillboard(cv: Canvas, x0: number, y0: number, x1: number, y1: number): void {
  // Poles down to the street.
  cv.rect(x0 + 30, y1, x0 + 44, 838, [20, 10, 38, 255]);
  cv.rect(x1 - 44, y1, x1 - 30, 838, [20, 10, 38, 255]);
  // Glow halo, then the board.
  cv.roundedRect(x0 - 8, y0 - 8, x1 - x0 + 16, y1 - y0 + 16, 18, [255, 46, 196, 60]);
  cv.roundedRect(x0, y0, x1 - x0, y1 - y0, 14, [18, 8, 46, 255]);
  // Neon frame.
  cv.rect(x0 + 4, y0 + 4, x1 - 4, y0 + 10, MAGENTA);
  cv.rect(x0 + 4, y1 - 10, x1 - 4, y1 - 4, MAGENTA);
  cv.rect(x0 + 4, y0 + 4, x0 + 10, y1 - 4, MAGENTA);
  cv.rect(x1 - 10, y0 + 4, x1 - 4, y1 - 4, MAGENTA);
  // The name, pink glow under white core.
  const label = 'make.fun';
  const scale = 7;
  const w = textWidth(label, scale);
  const tx = Math.round((x0 + x1) / 2 - w / 2);
  const ty = y0 + 42;
  drawGlyphs(cv, label, tx + 3, ty + 3, scale, [255, 46, 196, 255]);
  drawGlyphs(cv, label, tx, ty, scale, WHITE);
  // The pitch under it.
  const sub = 'AGENTS EARN HERE';
  const subScale = 3;
  const sw = textWidth(sub, subScale);
  drawGlyphs(cv, sub, Math.round((x0 + x1) / 2 - sw / 2), y1 - 52, subScale, [255, 209, 102, 255]);
}

function drawConvertible(cv: Canvas): void {
  // Ground shadow.
  cv.ellipse(500, 962, 290, 22, [0, 0, 0, 90]);
  // Windshield (behind the ghost).
  cv.poly([[332, 832], [372, 766], [628, 766], [668, 832]], [191, 232, 255, 235]);
  cv.thickLine(332, 832, 372, 766, 7, INK);
  cv.thickLine(628, 766, 668, 832, 7, INK);
  cv.thickLine(372, 766, 628, 766, 7, INK);
  // Body.
  cv.roundedRect(248, 822, 504, 104, 34, [255, 46, 136, 255]);
  cv.roundedRect(248, 888, 504, 38, 16, [214, 18, 104, 255]);
  // Door seam + handle.
  cv.rect(392, 836, 396, 916, [214, 18, 104, 255]);
  cv.roundedRect(560, 854, 52, 12, 6, [255, 209, 102, 255]);
  // Headlight and taillight.
  cv.ellipse(736, 864, 18, 12, [255, 224, 138, 255]);
  cv.ellipse(262, 864, 12, 10, [255, 60, 60, 255]);
  // Chrome bumper.
  cv.rect(248, 916, 752, 924, [220, 224, 232, 255]);
  // Wheels.
  for (const wx of [362, 640]) {
    cv.disc(wx, 922, 54, BLACK);
    cv.disc(wx, 922, 26, [207, 210, 214, 255]);
    cv.disc(wx, 922, 10, [60, 60, 70, 255]);
  }
}

function drawGhost(cv: Canvas, cx: number, topY: number, bottomY: number, item: 'coin' | 'bag' | 'phone'): void {
  const r = 172; // half-width of the body
  const cyTop = topY + r;
  // Body outline as a polygon: dome, straight sides, wavy bottom.
  const pts: Array<[number, number]> = [];
  for (let a = 180; a >= 0; a -= 6) {
    const rad = (a * Math.PI) / 180;
    pts.push([cx + r * Math.cos(rad), cyTop - r * Math.sin(rad)]);
  }
  const waves = 3;
  const amp = 20;
  const steps = 48;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = cx + r - 2 * r * t;
    const y = bottomY + amp * Math.sin(t * waves * Math.PI * 2);
    pts.push([x, y]);
  }
  // Thick black outline: stamp the silhouette in black, shifted around.
  const outline = 11;
  for (let dy = -outline; dy <= outline; dy += 5) {
    for (let dx = -outline; dx <= outline; dx += 5) {
      if (dx * dx + dy * dy > outline * outline) continue;
      cv.poly(pts.map(([x, y]): [number, number] => [x + dx, y + dy]), BLACK);
    }
  }
  cv.poly(pts, WHITE);

  // Sparkle eyes.
  const eyeY = topY + 205;
  cv.star4(cx - 62, eyeY, 30, BLACK);
  cv.star4(cx + 62, eyeY, 30, BLACK);
  // Little smile.
  cv.thickLine(cx - 34, eyeY + 72, cx - 12, eyeY + 84, 7, BLACK);
  cv.thickLine(cx - 12, eyeY + 84, cx + 12, eyeY + 84, 7, BLACK);
  cv.thickLine(cx + 12, eyeY + 84, cx + 34, eyeY + 72, 7, BLACK);

  // Sunglasses pushed up on the forehead.
  const sgY = topY + 118;
  cv.thickLine(cx - 108, sgY + 8, cx + 108, sgY + 8, 6, BLACK);
  cv.roundedRect(cx - 118, sgY - 16, 92, 52, 14, BLACK);
  cv.roundedRect(cx + 26, sgY - 16, 92, 52, 14, BLACK);
  cv.disc(cx - 72, sgY + 10, 8, [255, 255, 255, 220]);
  cv.disc(cx + 72, sgY + 10, 8, [255, 255, 255, 220]);

  // Left arm, bent, down to a steering wheel held in front of the ghost.
  const elbowX = cx - 62;
  const elbowY = topY + 372;
  const wheelX = cx + 66;
  const wheelY = topY + 336;
  cv.thickLine(cx - 150, topY + 300, elbowX, elbowY, 30, BLACK);
  cv.thickLine(cx - 150, topY + 300, elbowX, elbowY, 20, WHITE);
  cv.thickLine(elbowX, elbowY, wheelX, wheelY, 30, BLACK);
  cv.thickLine(elbowX, elbowY, wheelX, wheelY, 20, WHITE);
  cv.disc(wheelX, wheelY, 33, INK);
  cv.disc(wheelX, wheelY, 26, [52, 44, 66, 255]);
  cv.thickLine(wheelX - 22, wheelY, wheelX + 22, wheelY, 6, [255, 209, 102, 255]);
  cv.thickLine(wheelX, wheelY - 22, wheelX, wheelY + 22, 6, [255, 209, 102, 255]);
  cv.disc(wheelX, wheelY, 8, INK);

  // Right arm raised, holding the prize.
  const handX = cx + 268;
  const handY = topY + 34;
  cv.thickLine(cx + 150, topY + 300, handX - 8, handY + 8, 30, BLACK);
  cv.thickLine(cx + 150, topY + 300, handX - 8, handY + 8, 20, WHITE);
  cv.disc(handX, handY, 24, WHITE);
  cv.disc(handX, handY, 24, BLACK);
  cv.disc(handX, handY, 18, WHITE);

  if (item === 'coin') {
    // The make.fun logo: a magenta coin with a white star.
    cv.disc(handX + 6, handY - 66, 58, BLACK);
    cv.disc(handX + 6, handY - 66, 52, MAGENTA);
    cv.star5(handX + 6, handY - 66, 36, 15, WHITE);
  } else if (item === 'bag') {
    // A money bag held up by its tie: a plump sack above the hand.
    const bx = handX + 6;
    const top = handY - 122;
    cv.poly(
      [
        [bx - 10, top], [bx + 10, top], [bx + 28, top + 28], [bx + 48, top + 62],
        [bx + 42, top + 100], [bx + 20, top + 112], [bx - 20, top + 112],
        [bx - 42, top + 100], [bx - 48, top + 62], [bx - 28, top + 28],
      ],
      BLACK,
    );
    cv.poly(
      [
        [bx - 5, top + 6], [bx + 5, top + 6], [bx + 22, top + 32], [bx + 40, top + 62],
        [bx + 35, top + 96], [bx + 17, top + 105], [bx - 17, top + 105],
        [bx - 35, top + 96], [bx - 40, top + 62], [bx - 22, top + 32],
      ],
      [46, 160, 90, 255],
    );
    drawGlyphs(cv, '$', bx - 15, top + 50, 6, WHITE);
    // The tied knot, gripped by the hand below.
    cv.disc(bx, top - 4, 9, BLACK);
    cv.poly([[bx - 14, top - 10], [bx - 2, top - 2], [bx - 10, top + 6]], BLACK);
    cv.poly([[bx + 14, top - 10], [bx + 2, top - 2], [bx + 10, top + 6]], BLACK);
  } else {
    // A phone flashing the bounty.
    cv.roundedRect(handX - 26, handY - 132, 64, 112, 12, BLACK);
    cv.roundedRect(handX - 20, handY - 126, 52, 100, 8, [20, 20, 40, 255]);
    drawGlyphs(cv, '$', handX - 8, handY - 112, 4, [255, 209, 102, 255]);
  }
}

// ---------------------------------------------------------------------------
// Variants
// ---------------------------------------------------------------------------

interface Variant {
  id: string;
  file: string;
  top: string[];
  bottom: string[];
  bottomColor: RGBA;
  item: 'coin' | 'bag' | 'phone';
  sunX: number;
  sunY: number;
  seed: number;
}

const VARIANTS: Variant[] = [
  {
    id: 'a',
    file: 'variant-a.png',
    top: ['WAITED 13 YEARS', 'FOR GTA 6'],
    bottom: ['MY AGENT ALREADY', 'GOT PAID'],
    bottomColor: WHITE,
    item: 'coin',
    sunX: 330,
    sunY: 430,
    seed: 11,
  },
  {
    id: 'b',
    file: 'variant-b.png',
    top: ['ROCKSTAR DELAYED', 'THE GAME'],
    bottom: ['NOT THE PAYCHECK'],
    bottomColor: CAPTION_YELLOW,
    item: 'bag',
    sunX: 300,
    sunY: 400,
    seed: 29,
  },
  {
    id: 'c',
    file: 'variant-c.png',
    top: ['DOWNLOADING GTA 6', '97%...'],
    bottom: ['MY GHOST ALREADY', 'DID THE HEIST'],
    bottomColor: WHITE,
    item: 'phone',
    sunX: 360,
    sunY: 450,
    seed: 47,
  },
];

// The winner, chosen after visually scoring all three variants against the
// judge's criteria in order (make.fun in picture, funny, about GTA 6, sells
// make.fun, short/readable, original, clean): variant A wins — its raised hand
// holds the magenta make.fun coin itself, its joke is the 13-year wait, and
// its bottom line ("MY AGENT ALREADY GOT PAID") sells make.fun outright.
// Variant B is the punchiest one-liner and the cleanest layout; variant C has
// the sharpest GTA 6 detail (the 300 GB download) but sells make.fun least.
const WINNER_ID = 'a';

function renderMeme(v: Variant): Canvas {
  const cv = new Canvas(1200, 1200);
  const horizon = 760;

  // Sky gradient.
  for (let y = 0; y < horizon; y++) {
    const sc = skyColor(y / horizon);
    cv.rect(0, y, 1199, y, [sc[0], sc[1], sc[2], 255]);
  }

  // Soft clouds.
  cv.ellipse(210, 285, 130, 26, [255, 180, 200, 70]);
  cv.ellipse(880, 225, 110, 22, [255, 180, 200, 60]);
  cv.ellipse(1060, 330, 90, 20, [255, 200, 210, 50]);

  drawSun(cv, v.sunX, v.sunY, 132);
  drawPalm(cv, 92, 762, 330, -38, [26, 10, 44, 255]);
  drawPalm(cv, 1118, 762, 300, 42, [26, 10, 44, 255]);
  drawSkyline(cv, v.seed);
  drawBillboard(cv, 826, 296, 1176, 474);

  // Ocean with a sun reflection, then beach, then street.
  for (let y = horizon; y < 800; y++) {
    const f = (y - horizon) / 40;
    cv.rect(0, y, 1199, y, [Math.round(lerp(14, 10, f)), Math.round(lerp(125, 90, f)), Math.round(lerp(140, 110, f)), 255]);
  }
  for (let i = 0; i < 6; i++) {
    const y = 766 + i * 5;
    const w = 120 - i * 14;
    cv.rect(v.sunX - w / 2, y, v.sunX + w / 2, y + 3, [255, 209, 102, 150]);
  }
  cv.rect(0, 800, 1199, 834, [242, 201, 138, 255]);
  cv.rect(0, 834, 1199, 1199, [38, 35, 46, 255]);
  cv.rect(0, 834, 1199, 842, [58, 52, 69, 255]);

  drawConvertible(cv);
  drawGhost(cv, 500, 438, 842, v.item);

  // Captions: heavy white text with a black outline, auto-fitted.
  const topScale = fitScale(v.top, 1160, 13);
  let y = 34;
  for (const line of v.top) {
    drawText(cv, line, 600, y, topScale, WHITE, BLACK);
    y += 7 * topScale + 16;
  }
  const bottomScale = fitScale(v.bottom, 1160, 13);
  const blockH = v.bottom.length * 7 * bottomScale + (v.bottom.length - 1) * 16;
  y = 1200 - 26 - blockH;
  for (const line of v.bottom) {
    drawText(cv, line, 600, y, bottomScale, v.bottomColor, BLACK);
    y += 7 * bottomScale + 16;
  }

  return cv;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

const BOT_DIR = process.env.MAKEFUN_BOT_DIR ?? '/bot';
const OUTPUT_DIR = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

const memesDir = join(BOT_DIR, 'memes');
mkdirSync(memesDir, { recursive: true });

const winner = VARIANTS.find((v) => v.id === WINNER_ID) ?? VARIANTS[0];
for (const v of VARIANTS) {
  const png = renderMeme(v).toPng();
  writeFileSync(join(memesDir, v.file), png);
  if (v.id === WINNER_ID) writeFileSync(join(memesDir, 'meme.png'), png);
  console.log(`rendered memes/${v.file} (${png.length} bytes)`);
}
console.log(`winner: memes/meme.png = variant ${winner.id}`);

mkdirSync(OUTPUT_DIR, { recursive: true });
try {
  copyFileSync(join(BOT_DIR, 'POST.json'), join(OUTPUT_DIR, 'POST.json'));
} catch (err) {
  console.error(`POST.json could not be copied from ${BOT_DIR}: ${(err as Error).message}`);
  process.exit(1);
}
console.log(`copied POST.json to ${OUTPUT_DIR}/POST.json`);
