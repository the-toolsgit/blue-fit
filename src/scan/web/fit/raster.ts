// Masks for the scan fit: rasterize a projected mesh, find a mask's outline, and a
// Euclidean distance transform to that outline (Felzenszwalb–Huttenlocher, exact).

export interface Mask { w: number; h: number; data: Uint8Array }

/** Fill every projected triangle (pixel centers) into a w×h mask. */
export function rasterize(uv: Float64Array, faces: ArrayLike<number>, w: number, h: number): Mask {
  const data = new Uint8Array(w * h);
  for (let f = 0; f < faces.length; f += 3) {
    const a = faces[f] * 2, b = faces[f + 1] * 2, c = faces[f + 2] * 2;
    const x0 = uv[a], y0 = uv[a + 1], x1 = uv[b], y1 = uv[b + 1], x2 = uv[c], y2 = uv[c + 1];
    const area = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
    if (Math.abs(area) < 1e-9) continue;
    const minX = Math.max(0, Math.floor(Math.min(x0, x1, x2))), maxX = Math.min(w - 1, Math.ceil(Math.max(x0, x1, x2)));
    const minY = Math.max(0, Math.floor(Math.min(y0, y1, y2))), maxY = Math.min(h - 1, Math.ceil(Math.max(y0, y1, y2)));
    for (let y = minY; y <= maxY; y++) {
      const py = y + 0.5;
      for (let x = minX; x <= maxX; x++) {
        const px = x + 0.5;
        const w0 = ((x1 - px) * (y2 - py) - (x2 - px) * (y1 - py)) / area;
        const w1 = ((x2 - px) * (y0 - py) - (x0 - px) * (y2 - py)) / area;
        if (w0 >= 0 && w1 >= 0 && w0 + w1 <= 1) data[y * w + x] = 1;
      }
    }
  }
  return { w, h, data };
}

/** Outline pixels: inside pixels with an outside 4-neighbour (or on the image edge). */
export function outline(m: Mask): Uint8Array {
  const { w, h, data } = m;
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!data[i]) continue;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1 || !data[i - 1] || !data[i + 1] || !data[i - w] || !data[i + w]) out[i] = 1;
    }
  return out;
}

const INF = 1e20;
function dt1(f: Float64Array, n: number, d: Float64Array, v: Int32Array, z: Float64Array) {
  let k = 0;
  v[0] = 0; z[0] = -INF; z[1] = INF;
  for (let q = 1; q < n; q++) {
    let s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    while (s <= z[k]) { k--; s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); }
    k++; v[k] = q; z[k] = s; z[k + 1] = INF;
  }
  k = 0;
  for (let q = 0; q < n; q++) { while (z[k + 1] < q) k++; d[q] = (q - v[k]) * (q - v[k]) + f[v[k]]; }
}

/** Distance (px) from every pixel center to the nearest set pixel of `seeds`. */
export function distanceTransform(seeds: Uint8Array, w: number, h: number): Float32Array {
  const g = new Float64Array(w * h);
  for (let i = 0; i < w * h; i++) g[i] = seeds[i] ? 0 : INF;
  const n = Math.max(w, h);
  const f = new Float64Array(n), d = new Float64Array(n), v = new Int32Array(n), z = new Float64Array(n + 1);
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) f[y] = g[y * w + x];
    dt1(f, h, d, v, z);
    for (let y = 0; y < h; y++) g[y * w + x] = d[y];
  }
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) f[x] = g[y * w + x];
    dt1(f, w, d, v, z);
    for (let x = 0; x < w; x++) out[y * w + x] = Math.sqrt(d[x]);
  }
  return out;
}

/** Bilinear lookup in a distance field at a sub-pixel point (pixel centers at +0.5). */
export function sample(field: Float32Array, w: number, h: number, u: number, v: number): number {
  const x = Math.min(w - 1.001, Math.max(0, u - 0.5)), y = Math.min(h - 1.001, Math.max(0, v - 0.5));
  const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
  const i = y0 * w + x0;
  const a = field[i], b = field[i + 1], c = field[i + w], d = field[i + w + 1];
  // outside the image counts as far away
  const pad = (u < 0 || v < 0 || u > w || v > h) ? Math.hypot(Math.min(0, u) + Math.max(0, u - w), Math.min(0, v) + Math.max(0, v - h)) : 0;
  return a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + c * (1 - fx) * fy + d * fx * fy + pad;
}

/** Intersection over union of two masks of the same size. */
export function iou(a: Mask, b: Mask): number {
  let i = 0, u = 0;
  for (let k = 0; k < a.data.length; k++) { const x = a.data[k], y = b.data[k]; if (x && y) i++; if (x || y) u++; }
  return u ? i / u : 0;
}

/** Signed distance (px) to the mask's true edge (between pixel centers): < 0 inside, > 0 outside. */
export function signedDistance(m: Mask): Float32Array {
  const { w, h, data } = m;
  const outsideSet = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) outsideSet[i] = data[i] ? 0 : 1;
  const dIn = distanceTransform(data, w, h), dOut = distanceTransform(outsideSet, w, h);
  const out = new Float32Array(w * h);
  // the edge lies half a pixel from the nearest pixel center of the other side
  for (let i = 0; i < w * h; i++) out[i] = data[i] ? -(dOut[i] - 0.5) : dIn[i] - 0.5;
  return out;
}

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

/** Clean a person mask: keep the biggest blob and any blob at least 5% of its size (a hand separated by a thin
 *  gap), drop small specks, fill holes. */
export function cleanMask(m: Mask): Mask {
  const { w, h, data } = m;
  const lab = new Int32Array(w * h);
  let best = 0, bestN = 0, next = 0;
  const sizes: number[] = [0];
  const stack: number[] = [];
  for (let i = 0; i < w * h; i++) {
    if (!data[i] || lab[i]) continue;
    next++; let n = 0; lab[i] = next; stack.push(i);
    while (stack.length) {
      const j = stack.pop()!; n++;
      const x = j % w, y = (j - x) / w;
      if (x > 0 && data[j - 1] && !lab[j - 1]) { lab[j - 1] = next; stack.push(j - 1); }
      if (x < w - 1 && data[j + 1] && !lab[j + 1]) { lab[j + 1] = next; stack.push(j + 1); }
      if (y > 0 && data[j - w] && !lab[j - w]) { lab[j - w] = next; stack.push(j - w); }
      if (y < h - 1 && data[j + w] && !lab[j + w]) { lab[j + w] = next; stack.push(j + w); }
    }
    sizes[next] = n;
    if (n > bestN) { bestN = n; best = next; }
  }
  const keepLab = (l: number) => l !== 0 && (l === best || sizes[l] >= bestN * 0.05);
  // outside = background reachable from the image border; everything else is the person (holes filled)
  const out = new Uint8Array(w * h).fill(1), seen = new Uint8Array(w * h);
  for (let x = 0; x < w; x++) for (const y of [0, h - 1]) { const i = y * w + x; if (!keepLab(lab[i]) && !seen[i]) { seen[i] = 1; stack.push(i); } }
  for (let y = 0; y < h; y++) for (const x of [0, w - 1]) { const i = y * w + x; if (!keepLab(lab[i]) && !seen[i]) { seen[i] = 1; stack.push(i); } }
  while (stack.length) {
    const j = stack.pop()!; out[j] = 0;
    const x = j % w, y = (j - x) / w;
    for (const k of [x > 0 ? j - 1 : -1, x < w - 1 ? j + 1 : -1, y > 0 ? j - w : -1, y < h - 1 ? j + w : -1])
      if (k >= 0 && !seen[k] && !keepLab(lab[k])) { seen[k] = 1; stack.push(k); }
  }
  // enclosed background: fill only small holes (noise). A big one is real, e.g. the gap between an arm and the
  // body when the hand touches the hip.
  const hole = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    if (!out[i] || keepLab(lab[i]) || hole[i]) continue;
    const region: number[] = [];
    hole[i] = 1; stack.push(i);
    while (stack.length) {
      const j = stack.pop()!; region.push(j);
      const x = j % w, y = (j - x) / w;
      for (const k of [x > 0 ? j - 1 : -1, x < w - 1 ? j + 1 : -1, y > 0 ? j - w : -1, y < h - 1 ? j + w : -1])
        if (k >= 0 && out[k] && !keepLab(lab[k]) && !hole[k]) { hole[k] = 1; stack.push(k); }
    }
    if (region.length > bestN * 0.005) for (const j of region) out[j] = 0;
  }
  return { w, h, data: out };
}

/** Points on the mask's true edge: the middle of every side shared by an inside and an outside pixel
 *  (not along the image border: a body cut by the frame edge has no real edge there). */
export function edgePoints(m: Mask, every = 1): [number, number][] {
  const { w, h, data } = m;
  const pts: [number, number][] = [];
  let k = 0;
  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && data[y * w + x] === 1;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (!data[y * w + x]) continue;
      for (const [dx, dy] of DIRS) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h || inside(nx, ny)) continue;
        if (k++ % every === 0) pts.push([x + 0.5 + dx / 2, y + 0.5 + dy / 2]);
      }
    }
  return pts;
}
