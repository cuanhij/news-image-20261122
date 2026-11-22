// The World in One Day — Sunday 22 November 2026.
// A newspaper front page drawn entirely in code: own PNG encoder,
// own 5x7 bitmap font, own geometric icons, fixed layout.
// Standard library only (node:fs, node:path, node:zlib).
// Deterministic: no clock, no randomness, fixed compression.
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { deflateSync } from "node:zlib";

const W = 1024;
const H = 1024;

// ---- palette ----
const PAPER: RGB = [246, 241, 227];
const INK: RGB = [24, 24, 28];
const RED: RGB = [178, 34, 28];
const NAVY: RGB = [27, 42, 74];
const GOLD: RGB = [212, 160, 40];
const ORANGE: RGB = [230, 110, 30];
const TEAL: RGB = [24, 120, 110];
const WHITE: RGB = [255, 255, 255];
const GREY: RGB = [120, 118, 110];
const LIGHT: RGB = [232, 226, 205];

type RGB = [number, number, number];

// ---- pixel buffer ----
const px = new Uint8Array(W * H * 3);
function fill(c: RGB): void {
  for (let i = 0; i < W * H; i++) {
    px[i * 3] = c[0]; px[i * 3 + 1] = c[1]; px[i * 3 + 2] = c[2];
  }
}
function setPix(x: number, y: number, c: RGB): void {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2];
}
function rect(x: number, y: number, w: number, h: number, c: RGB): void {
  for (let yy = y; yy < y + h; yy++)
    for (let xx = x; xx < x + w; xx++) setPix(xx, yy, c);
}
function hline(x: number, y: number, w: number, c: RGB, t = 1): void {
  rect(x, y, w, t, c);
}
function vline(x: number, y: number, h: number, c: RGB, t = 1): void {
  rect(x, y, t, h, c);
}
function border(x: number, y: number, w: number, h: number, c: RGB, t = 3): void {
  rect(x, y, w, t, c); rect(x, y + h - t, w, t, c);
  rect(x, y, t, h, c); rect(x + w - t, y, t, h, c);
}
function line(x0: number, y0: number, x1: number, y1: number, c: RGB): void {
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy, x = x0, y = y0;
  for (let n = 0; n < 4000; n++) {
    setPix(x, y, c);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x += sx; }
    if (e2 <= dx) { err += dx; y += sy; }
  }
}
function circle(cx: number, cy: number, r: number, c: RGB): void {
  for (let y = -r; y <= r; y++)
    for (let x = -r; x <= r; x++)
      if (x * x + y * y <= r * r) setPix(cx + x, cy + y, c);
}
function ring(cx: number, cy: number, r: number, c: RGB, t = 3): void {
  for (let a = 0; a < 360; a += 1) {
    const rad = (a * Math.PI) / 180;
    for (let k = 0; k < t; k++)
      setPix(Math.round(cx + (r - k) * Math.cos(rad)), Math.round(cy + (r - k) * Math.sin(rad)), c);
  }
}
function tri(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, c: RGB): void {
  const minX = Math.min(x0, x1, x2), maxX = Math.max(x0, x1, x2);
  const minY = Math.min(y0, y1, y2), maxY = Math.max(y0, y1, y2);
  const d = (y1 - y2) * (x0 - x2) + (x2 - x1) * (y0 - y2);
  if (d === 0) return;
  for (let y = minY; y <= maxY; y++)
    for (let x = minX; x <= maxX; x++) {
      const a = ((y1 - y2) * (x - x2) + (x2 - x1) * (y - y2)) / d;
      const b = ((y2 - y0) * (x - x2) + (x0 - x2) * (y - y2)) / d;
      const cc = 1 - a - b;
      if (a >= 0 && b >= 0 && cc >= 0) setPix(x, y, c);
    }
}
function star(cx: number, cy: number, r: number, c: RGB): void {
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4;
    const x2 = Math.round(cx + r * Math.cos(a));
    const y2 = Math.round(cy + r * Math.sin(a));
    tri(cx, cy, x2, y2, Math.round(cx + (r * 0.35) * Math.cos(a + 0.4)), Math.round(cy + (r * 0.35) * Math.sin(a + 0.4)), c);
    tri(cx, cy, x2, y2, Math.round(cx + (r * 0.35) * Math.cos(a - 0.4)), Math.round(cy + (r * 0.35) * Math.sin(a - 0.4)), c);
  }
  circle(cx, cy, Math.max(3, Math.round(r * 0.3)), c);
}

// ---- 5x7 bitmap font (own design, uppercase + digits + punctuation) ----
const FONT: Record<string, string[]> = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01110", "10001", "10000", "10111", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["01110", "00100", "00100", "00100", "00100", "00100", "01110"],
  J: ["00111", "00010", "00010", "00010", "00010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "11011", "10001"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00110", "01000", "10000", "11111"],
  "3": ["11111", "00010", "00100", "00010", "00001", "10001", "01110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  "6": ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
  ".": ["00000", "00000", "00000", "00000", "00000", "00000", "01100"],
  ",": ["00000", "00000", "00000", "00000", "00100", "00100", "01000"],
  ":": ["00000", "00100", "00000", "00000", "00000", "00100", "00000"],
  ";": ["00000", "00100", "00000", "00000", "00100", "00100", "01000"],
  "'": ["00100", "00100", "00000", "00000", "00000", "00000", "00000"],
  "-": ["00000", "00000", "00000", "11111", "00000", "00000", "00000"],
  "!": ["00100", "00100", "00100", "00100", "00100", "00000", "00100"],
  "?": ["01110", "10001", "00001", "00110", "00100", "00000", "00100"],
  "&": ["01100", "10010", "10100", "01000", "10101", "10010", "01101"],
  "/": ["00001", "00010", "00010", "00100", "01000", "01000", "10000"],
  "(": ["00010", "00100", "01000", "01000", "01000", "00100", "00010"],
  ")": ["01000", "00100", "00010", "00010", "00010", "00100", "01000"],
  "%": ["11001", "11010", "00010", "00100", "01000", "01011", "10011"],
  "+": ["00000", "00100", "00100", "11111", "00100", "00100", "00000"],
  "=": ["00000", "00000", "11111", "00000", "11111", "00000", "00000"],
  '"': ["01010", "01010", "00000", "00000", "00000", "00000", "00000"],
  "*": ["00000", "10101", "01110", "11111", "01110", "10101", "00000"],
};
function textWidth(s: string, scale: number): number {
  return s.length * 6 * scale - scale;
}
function drawChar(ch: string, x: number, y: number, scale: number, c: RGB): void {
  const g = FONT[ch] ?? FONT["?"];
  for (let r = 0; r < 7; r++)
    for (let col = 0; col < 5; col++)
      if (g[r][col] === "1") rect(x + col * scale, y + r * scale, scale, scale, c);
}
function drawText(s: string, x: number, y: number, scale: number, c: RGB): void {
  for (let i = 0; i < s.length; i++) drawChar(s[i], x + i * 6 * scale, y, scale, c);
}
function drawCentered(s: string, cx: number, y: number, scale: number, c: RGB): void {
  drawText(s, cx - Math.floor(textWidth(s, scale) / 2), y, scale, c);
}
// Wrap text into lines that fit maxW; returns lines drawn, next y after them.
function drawWrapped(s: string, x: number, y: number, maxW: number, scale: number, c: RGB): number {
  const words = s.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const t = cur ? cur + " " + w : w;
    if (textWidth(t, scale) <= maxW || !cur) cur = t;
    else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  const lh = 9 * scale;
  lines.forEach((ln, i) => drawText(ln, x, y + i * lh, scale, c));
  return y + lines.length * lh;
}

// ---- geometric icons (drawn inside a square panel) ----
function iconBorder(x: number, y: number, s: number): void {
  rect(x, y, s, s, NAVY);
  border(x, y, s, s, GOLD, 3);
}
// Estonia: closed border gate — barred fence with a red cross.
function iconEstonia(x: number, y: number, s: number): void {
  iconBorder(x, y, s);
  const m = 10;
  for (let i = 0; i < 5; i++) vline(x + m + i * 16, y + 14, s - 28, WHITE, 5);
  hline(x + 8, y + 16, s - 16, GOLD, 5);
  hline(x + 8, y + s - 20, s - 16, GOLD, 5);
  line(x + 14, y + 14, x + s - 14, y + s - 14, RED);
  line(x + s - 14, y + 14, x + 14, y + s - 14, RED);
}
// Ukraine: night blast star over rooftops.
function iconUkraine(x: number, y: number, s: number): void {
  iconBorder(x, y, s);
  rect(x + 12, y + s - 34, 22, 22, [90, 90, 100]);
  tri(x + 12, y + s - 34, x + 34, y + s - 34, x + 23, y + s - 48, [90, 90, 100]);
  rect(x + 52, y + s - 28, 26, 16, [90, 90, 100]);
  star(x + s / 2, y + 34, 26, GOLD);
  star(x + s / 2, y + 34, 14, ORANGE);
}
// Basra: power plant towers with a lightning bolt and smoke.
function iconBasra(x: number, y: number, s: number): void {
  iconBorder(x, y, s);
  rect(x + 16, y + 30, 14, s - 42, [200, 200, 205]);
  rect(x + 38, y + 22, 14, s - 34, [200, 200, 205]);
  rect(x + 60, y + 36, 14, s - 48, [200, 200, 205]);
  circle(x + 24, y + 20, 8, GREY);
  circle(x + 46, y + 14, 9, GREY);
  tri(x + 52, y + 40, x + 66, y + 40, x + 56, y + 58, GOLD);
  tri(x + 62, y + 56, x + 48, y + 56, x + 58, y + 76, GOLD);
}
// Peru: cracked Andes mountains.
function iconPeru(x: number, y: number, s: number): void {
  iconBorder(x, y, s);
  tri(x + 6, y + s - 14, x + 34, y + s - 14, x + 20, y + 26, [150, 110, 70]);
  tri(x + 30, y + s - 14, x + 66, y + s - 14, x + 48, y + 18, [120, 85, 55]);
  tri(x + 62, y + s - 14, x + s - 8, y + s - 14, x + s - 24, y + 34, [150, 110, 70]);
  tri(x + 14, y + 36, x + 26, y + 36, x + 20, y + 26, WHITE);
  tri(x + 42, y + 28, x + 54, y + 28, x + 48, y + 18, WHITE);
  line(x + 20, y + s - 14, x + 34, y + s - 34, RED);
  line(x + 34, y + s - 34, x + 28, y + s - 52, RED);
  line(x + 28, y + s - 52, x + 44, y + s - 66, RED);
}
// COP31: globe with clock hands running late.
function iconCop(x: number, y: number, s: number): void {
  iconBorder(x, y, s);
  circle(x + s / 2, y + s / 2, 30, [60, 140, 180]);
  tri(x + s / 2 - 22, y + s / 2 - 8, x + s / 2 - 2, y + s / 2 - 8, x + s / 2 - 12, y + s / 2 + 12, [40, 160, 80]);
  tri(x + s / 2 + 4, y + s / 2 + 2, x + s / 2 + 22, y + s / 2 + 2, x + s / 2 + 12, y + s / 2 + 18, [40, 160, 80]);
  ring(x + s / 2, y + s / 2, 30, WHITE, 3);
  line(x + s / 2, y + s / 2, x + s / 2, y + s / 2 - 20, WHITE);
  line(x + s / 2, y + s / 2, x + s / 2 + 16, y + s / 2 + 6, WHITE);
  circle(x + s / 2, y + s / 2, 4, WHITE);
}

// ---- lead visual: burning tanker at sea under a dark sky ----
function leadVisual(x: number, y: number, w: number, h: number): void {
  rect(x, y, w, h, NAVY);
  circle(x + w - 52, y + 46, 26, GOLD); // low sun / fire glow
  circle(x + w - 52, y + 46, 18, ORANGE);
  // flames
  tri(x + 60, y + 130, x + 110, y + 130, x + 85, y + 76, ORANGE);
  tri(x + 100, y + 130, x + 150, y + 130, x + 125, y + 62, RED);
  tri(x + 145, y + 130, x + 190, y + 130, x + 168, y + 84, ORANGE);
  star(x + 125, y + 94, 22, GOLD);
  // tanker hull
  rect(x + 30, y + 130, 240, 34, [12, 12, 16]);
  rect(x + 230, y + 102, 40, 28, [12, 12, 16]);
  rect(x + 40, y + 112, 26, 18, [60, 60, 70]);
  rect(x + 80, y + 112, 26, 18, [60, 60, 70]);
  // sea
  rect(x, y + 164, w, h - 164, [16, 70, 110]);
  for (let i = 0; i < 3; i++) hline(x + 14 + i * 22, y + 176 + i * 12, 120 - i * 12, WHITE, 3);
  hline(x, y + h - 34, w, GOLD, 3);
  drawText("TANKERS HIT OFF OMAN", x + 16, y + h - 26, 2, WHITE);
}

// ---- story boxes ----
function storyBox(x: number, y: number, w: number, h: number, kicker: string, headline: string, body: string, icon: (x: number, y: number, s: number) => void): void {
  rect(x, y, w, h, WHITE);
  border(x, y, w, h, INK, 2);
  icon(x + 14, y + 14, 88);
  drawText(kicker, x + 116, y + 14, 2, RED);
  const hy = drawWrapped(headline, x + 116, y + 34, w - 132, 3, INK);
  drawWrapped(body, x + 116, hy + 4, w - 132, 2, [60, 60, 64]);
}

// ---- PNG encoder: CRC32 + zlib deflate, filter 0 ----
const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c >>> 0;
}
function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  const crcIn = new Uint8Array(4 + data.length);
  crcIn.set(out.subarray(4, 8), 0);
  crcIn.set(data, 4);
  dv.setUint32(8 + data.length, crc32(crcIn));
  return out;
}
function encodePNG(): Uint8Array {
  const raw = new Uint8Array(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0;
    raw.set(px.subarray(y * W * 3, (y + 1) * W * 3), y * (1 + W * 3) + 1);
  }
  const comp = deflateSync(raw, { level: 9 });
  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, W); dv.setUint32(4, H);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const sig = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const parts = [sig, chunk("IHDR", ihdr), chunk("IDAT", comp), chunk("IEND", new Uint8Array(0))];
  const total = parts.reduce((a, p) => a + p.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) { out.set(p, off); off += p.length; }
  return out;
}

// ---- draw the front page ----
function drawPage(): void {
  fill(PAPER);
  border(8, 8, W - 16, H - 16, INK, 4);

  // Masthead
  drawCentered("THE WORLD IN ONE DAY", 512, 40, 5, INK);
  hline(112, 88, 800, INK, 3);
  rect(212, 98, 600, 34, RED);
  drawCentered("SUNDAY 22 NOVEMBER 2026", 512, 104, 3, WHITE);
  drawCentered("SIX STORIES FROM AROUND THE GLOBE", 512, 140, 2, [90, 88, 80]);
  hline(28, 164, 968, INK, 3);
  hline(28, 170, 968, INK, 1);

  // Lead story
  const lx = 28, ly = 180, lw = 968, lh = 280;
  rect(lx, ly, lw, lh, WHITE);
  border(lx, ly, lw, lh, INK, 3);
  drawText("LEAD STORY - THE GULF", lx + 20, ly + 16, 2, RED);
  drawText("GULF IN FLAMES", lx + 20, ly + 42, 5, INK);
  drawText("IRAN STRIKES US BASE IN KUWAIT", lx + 20, ly + 92, 3, NAVY);
  drawWrapped(
    "IRAN HITS A US AIR BASE IN KUWAIT AND TARGETS BAHRAIN. TANKERS ARE HIT OFF THE OMAN COAST AS IRAN-US NAVAL TENSIONS ESCALATE.",
    lx + 20, ly + 132, 540, 2, [50, 50, 54]);
  drawText("MIDDLE EAST - WAR AT SEA", lx + 20, ly + 238, 2, RED);
  leadVisual(lx + 596, ly + 16, 352, 248);

  // Five smaller stories: 2 + 2 + 1 wide
  const bw = 474, bh = 152;
  storyBox(28, 492, bw, bh, "EUROPE", "ESTONIA SHUTS RUSSIAN BORDER",
    "ESTONIA TO CLOSE ITS BORDER WITH RUSSIA. MOSCOW DECRIES A NEW IRON CURTAIN.",
    iconEstonia);
  storyBox(522, 492, bw, bh, "UKRAINE", "STRIKES KILL TWO IN UKRAINE",
    "RUSSIAN OVERNIGHT STRIKES KILL AT LEAST TWO PEOPLE ACROSS UKRAINE.",
    iconUkraine);
  storyBox(28, 660, bw, bh, "IRAQ", "BLAST AT BASRA POWER PLANT",
    "A STRIKE AND FIRE AT A POWER PLANT IN BASRA KILLS FOUR, INJURES ABOUT 35.",
    iconBasra);
  storyBox(522, 660, bw, bh, "PERU", "QUAKE SHAKES PERU",
    "A MAGNITUDE 6.9 QUAKE SHAKES PERU'S ANDES. NO CASUALTIES REPORTED AT FIRST.",
    iconPeru);
  storyBox(28, 828, 968, bh, "CLIMATE", "COP31 IN OVERTIME",
    "COP31 CLIMATE TALKS RUN INTO OVERTIME WITH NO FINAL AGREEMENT ON FOSSIL FUELS YET.",
    iconCop);

  // Footer
  drawCentered("ALL SIX STORIES FIRST REPORTED ON 22 NOVEMBER 2026", 512, 994, 2, [90, 88, 80]);
}

function main(): void {
  drawPage();
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "entry.png"), encodePNG());
}
main();
