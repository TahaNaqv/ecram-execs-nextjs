/**
 * SEPA credit-transfer (EPC069) payload and a scannable QR symbol for it.
 * Versions 1–10, error correction M. Enough for an invoice reference and amount.
 */

const ECC_PER_BLOCK_M = [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26];
const BLOCKS_M = [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5];
const ALIGN: number[][] = [
  [],
  [],
  [6, 18],
  [6, 22],
  [6, 26],
  [6, 30],
  [6, 34],
  [6, 22, 38],
  [6, 24, 42],
  [6, 26, 46],
  [6, 28, 50],
];
/** 18-bit version information words, versions 7–10. */
const VERSION_INFO = [0, 0, 0, 0, 0, 0, 0, 0x07c94, 0x085bc, 0x09a99, 0x0a4d3];

const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
{
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
}

const mul = (a: number, b: number) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);

function rsGenerator(degree: number): Uint8Array {
  let poly = new Uint8Array([1]);
  for (let i = 0; i < degree; i++) {
    const next = new Uint8Array(poly.length + 1);
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];
      next[j + 1] ^= mul(poly[j], EXP[i]);
    }
    poly = next;
  }
  return poly;
}

function rsRemainder(data: Uint8Array, degree: number): Uint8Array {
  const gen = rsGenerator(degree);
  const buf = new Uint8Array(data.length + degree);
  buf.set(data);
  for (let i = 0; i < data.length; i++) {
    const factor = buf[i];
    if (factor === 0) continue;
    for (let j = 0; j < gen.length; j++) buf[i + j] ^= mul(gen[j], factor);
  }
  return buf.slice(data.length);
}

function rawModules(version: number): number {
  let result = (16 * version + 128) * version + 64;
  if (version >= 2) {
    const numAlign = Math.floor(version / 7) + 2;
    result -= (25 * numAlign - 10) * numAlign - 55;
    if (version >= 7) result -= 36;
  }
  return result;
}

function dataCapacity(version: number): number {
  const codewords = Math.floor(rawModules(version) / 8);
  return codewords - ECC_PER_BLOCK_M[version] * BLOCKS_M[version];
}

function encodeBytes(bytes: Uint8Array, version: number, capacity: number): Uint8Array {
  const bits: number[] = [];
  const push = (value: number, length: number) => {
    for (let i = length - 1; i >= 0; i--) bits.push((value >>> i) & 1);
  };
  push(0b0100, 4);
  push(bytes.length, version < 10 ? 8 : 16);
  for (const byte of bytes) push(byte, 8);
  const room = capacity * 8 - bits.length;
  if (room < 0) return new Uint8Array();
  push(0, Math.min(4, room));
  while (bits.length % 8 !== 0) bits.push(0);
  const out = new Uint8Array(capacity);
  let i = 0;
  for (; i < bits.length / 8; i++) {
    let byte = 0;
    for (let b = 0; b < 8; b++) byte = (byte << 1) | bits[i * 8 + b];
    out[i] = byte;
  }
  for (let pad = 0; i < capacity; i++, pad++) out[i] = pad % 2 === 0 ? 0xec : 0x11;
  return out;
}

function interleave(data: Uint8Array, version: number): Uint8Array {
  const ecLen = ECC_PER_BLOCK_M[version];
  const numBlocks = BLOCKS_M[version];
  const raw = Math.floor(rawModules(version) / 8);
  const numShort = numBlocks - (raw % numBlocks);
  const shortData = Math.floor(raw / numBlocks) - ecLen;
  const blocks: Uint8Array[] = [];
  const ecs: Uint8Array[] = [];
  let offset = 0;
  for (let b = 0; b < numBlocks; b++) {
    const len = shortData + (b < numShort ? 0 : 1);
    const block = data.slice(offset, offset + len);
    offset += len;
    blocks.push(block);
    ecs.push(rsRemainder(block, ecLen));
  }
  const out: number[] = [];
  const max = Math.max(...blocks.map((block) => block.length));
  for (let i = 0; i < max; i++) for (const block of blocks) if (i < block.length) out.push(block[i]);
  for (let i = 0; i < ecLen; i++) for (const ec of ecs) out.push(ec[i]);
  return Uint8Array.from(out);
}

const MASKS: ((row: number, col: number) => boolean)[] = [
  (r, c) => (r + c) % 2 === 0,
  (r) => r % 2 === 0,
  (_r, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
];

function formatBits(mask: number): number {
  const data = mask & 7;
  let rem = data << 10;
  for (let i = 14; i >= 10; i--) if (((rem >>> i) & 1) !== 0) rem ^= 0x537 << (i - 10);
  return ((data << 10) | rem) ^ 0x5412;
}

type Grid = { dark: boolean[][]; fun: boolean[][]; size: number };

function emptyGrid(version: number): Grid {
  const size = 17 + 4 * version;
  const dark = Array.from({ length: size }, () => Array<boolean>(size).fill(false));
  const fun = Array.from({ length: size }, () => Array<boolean>(size).fill(false));
  return { dark, fun, size };
}

function setFunction(grid: Grid, x: number, y: number, dark: boolean) {
  if (x < 0 || y < 0 || x >= grid.size || y >= grid.size) return;
  grid.dark[y][x] = dark;
  grid.fun[y][x] = true;
}

function drawFinder(grid: Grid, ox: number, oy: number) {
  for (let dy = -1; dy <= 7; dy++) {
    for (let dx = -1; dx <= 7; dx++) {
      const on =
        dx >= 0 &&
        dx <= 6 &&
        dy >= 0 &&
        dy <= 6 &&
        (dx === 0 || dx === 6 || dy === 0 || dy === 6 || (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4));
      setFunction(grid, ox + dx, oy + dy, on);
    }
  }
}

function drawAlignment(grid: Grid, version: number) {
  const positions = ALIGN[version] ?? [];
  const last = positions[positions.length - 1];
  for (const row of positions) {
    for (const col of positions) {
      if ((row === 6 && (col === 6 || col === last)) || (col === 6 && row === last)) continue;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          setFunction(grid, col + dx, row + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
        }
      }
    }
  }
}

function drawPatterns(grid: Grid, version: number) {
  const { size } = grid;
  drawFinder(grid, 0, 0);
  drawFinder(grid, size - 7, 0);
  drawFinder(grid, 0, size - 7);
  for (let i = 0; i < size; i++) {
    if (!grid.fun[6][i]) setFunction(grid, i, 6, i % 2 === 0);
    if (!grid.fun[i][6]) setFunction(grid, 6, i, i % 2 === 0);
  }
  drawAlignment(grid, version);
  reserveFormat(grid);
  if (version >= 7) reserveVersion(grid);
  setFunction(grid, 8, size - 8, true);
}

function reserveFormat(grid: Grid) {
  const { size } = grid;
  for (let i = 0; i <= 8; i++) {
    if (i !== 6) {
      setFunction(grid, 8, i, false);
      setFunction(grid, i, 8, false);
    }
  }
  for (let i = 0; i < 8; i++) {
    setFunction(grid, size - 1 - i, 8, false);
    setFunction(grid, 8, size - 1 - i, false);
  }
}

function reserveVersion(grid: Grid) {
  const { size } = grid;
  for (let i = 0; i < 18; i++) {
    setFunction(grid, size - 11 + (i % 3), Math.floor(i / 3), false);
    setFunction(grid, Math.floor(i / 3), size - 11 + (i % 3), false);
  }
}

function drawFormat(grid: Grid, mask: number) {
  const bits = formatBits(mask);
  const { size } = grid;
  const bit = (i: number) => ((bits >>> i) & 1) === 1;
  for (let i = 0; i <= 5; i++) grid.dark[i][8] = bit(i);
  grid.dark[7][8] = bit(6);
  grid.dark[8][8] = bit(7);
  grid.dark[8][7] = bit(8);
  for (let i = 9; i < 15; i++) grid.dark[8][14 - i] = bit(i);
  for (let i = 0; i < 8; i++) grid.dark[8][size - 1 - i] = bit(i);
  for (let i = 8; i < 15; i++) grid.dark[size - 15 + i][8] = bit(i);
  grid.dark[size - 8][8] = true;
  grid.fun[8][8] = true;
}

function drawVersion(grid: Grid, version: number) {
  if (version < 7) return;
  const bits = VERSION_INFO[version] ?? 0;
  const { size } = grid;
  for (let i = 0; i < 18; i++) {
    const on = ((bits >>> i) & 1) === 1;
    const a = size - 11 + (i % 3);
    const b = Math.floor(i / 3);
    grid.dark[b][a] = on;
    grid.dark[a][b] = on;
  }
}

function placeData(grid: Grid, codewords: Uint8Array) {
  const { size } = grid;
  let bitIndex = 0;
  const total = codewords.length * 8;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        // Column pairs move up, then down, from the right. Left of the timing column the direction flips.
        let upward = (right & 2) === 0;
        if (x < 6) upward = !upward;
        const y = upward ? size - 1 - vert : vert;
        if (grid.fun[y][x]) continue;
        const on = bitIndex < total && ((codewords[bitIndex >>> 3] >>> (7 - (bitIndex & 7))) & 1) === 1;
        grid.dark[y][x] = on;
        bitIndex++;
      }
    }
  }
}

function penalty(grid: Grid): number {
  const { size, dark } = grid;
  let score = 0;
  const run = (get: (i: number) => boolean) => {
    let count = 1;
    let prev = get(0);
    for (let i = 1; i < size; i++) {
      const on = get(i);
      if (on === prev) count++;
      else {
        if (count >= 5) score += 3 + (count - 5);
        count = 1;
        prev = on;
      }
    }
    if (count >= 5) score += 3 + (count - 5);
  };
  for (let y = 0; y < size; y++) run((x) => dark[y][x]);
  for (let x = 0; x < size; x++) run((y) => dark[y][x]);
  for (let y = 0; y < size - 1; y++) {
    for (let x = 0; x < size - 1; x++) {
      const on = dark[y][x];
      if (on === dark[y][x + 1] && on === dark[y + 1][x] && on === dark[y + 1][x + 1]) score += 3;
    }
  }
  const finder = (line: boolean[], i: number) => {
    const bits = [1, 0, 1, 1, 1, 0, 1];
    if (i + 6 >= line.length) return false;
    for (let k = 0; k < 7; k++) if (line[i + k] !== (bits[k] === 1)) return false;
    return true;
  };
  const n3 = (line: boolean[]) => {
    for (let i = 0; i < line.length; i++) {
      if (!finder(line, i)) continue;
      let light = 0;
      for (let k = i - 1; k >= 0 && !line[k] && light < 4; k--) light++;
      if (light >= 4) score += 40;
      light = 0;
      for (let k = i + 7; k < line.length && !line[k] && light < 4; k++) light++;
      if (light >= 4) score += 40;
    }
  };
  for (let y = 0; y < size; y++) n3(dark[y]);
  for (let x = 0; x < size; x++) n3(dark.map((row) => row[x]));
  let darkCount = 0;
  for (const row of dark) for (const on of row) if (on) darkCount++;
  const percent = (darkCount * 100) / (size * size);
  score += 10 * Math.floor(Math.abs(percent - 50) / 5);
  return score;
}

function applyMask(grid: Grid, mask: number) {
  const fn = MASKS[mask];
  for (let y = 0; y < grid.size; y++) {
    for (let x = 0; x < grid.size; x++) {
      if (!grid.fun[y][x] && fn(y, x)) grid.dark[y][x] = !grid.dark[y][x];
    }
  }
}

function buildMatrix(bytes: Uint8Array): boolean[][] | null {
  let version = 0;
  for (let v = 1; v <= 10; v++) {
    const capacity = dataCapacity(v);
    const countBits = v < 10 ? 8 : 16;
    const header = Math.ceil((4 + countBits + bytes.length * 8) / 8);
    if (header <= capacity && bytes.length < (v < 10 ? 256 : 65536)) {
      version = v;
      break;
    }
  }
  if (version === 0) return null;
  const capacity = dataCapacity(version);
  const data = encodeBytes(bytes, version, capacity);
  if (data.length === 0) return null;
  const codewords = interleave(data, version);
  const base = emptyGrid(version);
  drawPatterns(base, version);
  placeData(base, codewords);
  let best: boolean[][] | null = null;
  let bestScore = Infinity;
  for (let mask = 0; mask < 8; mask++) {
    const grid: Grid = {
      size: base.size,
      fun: base.fun,
      dark: base.dark.map((row) => row.slice()),
    };
    applyMask(grid, mask);
    drawFormat(grid, mask);
    drawVersion(grid, version);
    const score = penalty(grid);
    if (score < bestScore) {
      bestScore = score;
      best = grid.dark;
    }
  }
  return best;
}

function matrixToSvg(modules: boolean[][]): string {
  const size = modules.length;
  const quiet = 4;
  const cells: string[] = [];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (modules[y][x]) cells.push(`M${x} ${y}h1v1h-1z`);
    }
  }
  const span = size + quiet * 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-quiet} ${-quiet} ${span} ${span}" shape-rendering="crispEdges" role="img" aria-label="SEPA payment QR code"><rect x="${-quiet}" y="${-quiet}" width="${span}" height="${span}" fill="#ffffff"/><path fill="#0f172a" d="${cells.join("")}"/></svg>`;
}

export type SepaQrInput = {
  name: string;
  iban: string;
  bic?: string;
  amountCents: number;
  reference: string;
};

/** EPC069-12 payload, or null when the amount or reference is not ready to pay. */
export function sepaEpcPayload(input: SepaQrInput): string | null {
  const reference = input.reference.replace(/[\r\n]+/g, " ").trim();
  const iban = input.iban.replace(/\s+/g, "").toUpperCase();
  const name = input.name.replace(/[\r\n]+/g, " ").trim().slice(0, 70);
  if (!reference || !name || !/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return null;
  if (!Number.isFinite(input.amountCents) || input.amountCents <= 0) return null;
  const bic = (input.bic ?? "").replace(/\s+/g, "").toUpperCase();
  if (bic && !/^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(bic)) return null;
  const amount = (input.amountCents / 100).toFixed(2);
  return ["BCD", "002", "1", "SCT", bic, name, iban, `EUR${amount}`, "", "", reference.slice(0, 140)].join("\n");
}

/** SVG markup for the payload, or null when it cannot be encoded. */
export function sepaQrSvg(payload: string | null): string | null {
  if (!payload) return null;
  try {
    const modules = buildMatrix(new TextEncoder().encode(payload));
    return modules ? matrixToSvg(modules) : null;
  } catch (error) {
    console.error("[sepa-qr] could not build the payment QR code", error);
    return null;
  }
}
