// Plates to load for a weight, assuming a standard gym: 45, 35, 25, 10, 5 and 2.5 lb plates, as many as needed.
// The fewest plates win (quicker to load).
export const STANDARD_PLATES = [45, 35, 25, 10, 5, 2.5] as const;

export interface PlateResult { plates: number[]; loaded: number; remainder: number }

/** Plates for ONE sleeve (one side of a bar, or the single sleeve of a T-bar), heaviest first: the fewest plates that
 *  make the weight (Leo, Nov 23 2026: 60 = 35 + 25, not 45 + 10 + 5); ties go to the heavier plates. A weight the
 *  plates can't make exactly loads the most they can under it. */
export function platesFor(weight: number): PlateResult {
  // In half pounds, so 2.5 lb is a whole number
  const U = (x: number) => Math.round(x * 2), target = Math.max(0, Math.floor(weight * 2 + 1e-9));
  const sizes = STANDARD_PLATES.map(U);
  // best[w]: fewest plates for exactly w (Infinity if none); from[w]: the plate added last
  const best = new Array<number>(target + 1).fill(Infinity), from = new Array<number>(target + 1).fill(0);
  best[0] = 0;
  for (let w = 1; w <= target; w++) for (const p of sizes) if (p <= w && best[w - p] + 1 < best[w]) { best[w] = best[w - p] + 1; from[w] = p; }
  let w = target;
  while (w > 0 && best[w] === Infinity) w--;
  const plates: number[] = [];
  for (let x = w; x > 0; x -= from[x]) plates.push(from[x] / 2);
  plates.sort((a, b) => b - a);
  const loaded = w / 2;
  return { plates, loaded, remainder: Math.round((weight - loaded) * 100) / 100 };
}

/** The plates grouped: [{ weight: 45, count: 2 }, …] */
export const groupPlates = (plates: number[]) =>
  plates.reduce<{ weight: number; count: number }[]>((a, p) => { const g = a.find((x) => x.weight === p); if (g) g.count++; else a.push({ weight: p, count: 1 }); return a; }, []);
