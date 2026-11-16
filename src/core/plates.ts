// Plates to load for a weight, assuming a standard gym: 45, 35, 25, 10, 5 and 2.5 lb plates, as many as needed.
export const STANDARD_PLATES = [45, 35, 25, 10, 5, 2.5] as const;

export interface PlateResult { plates: number[]; loaded: number; remainder: number }

/** Plates for ONE sleeve (one side of a bar, or the single sleeve of a T-bar). Heaviest first. */
export function platesFor(weight: number): PlateResult {
  const plates: number[] = [];
  let left = Math.max(0, weight);
  for (const p of STANDARD_PLATES) while (left + 1e-9 >= p) { plates.push(p); left -= p; }
  left = Math.round(left * 100) / 100;
  return { plates, loaded: Math.round((weight - left) * 100) / 100, remainder: left };
}

/** The plates grouped: [{ weight: 45, count: 2 }, …] */
export const groupPlates = (plates: number[]) =>
  plates.reduce<{ weight: number; count: number }[]>((a, p) => { const g = a.find((x) => x.weight === p); if (g) g.count++; else a.push({ weight: p, count: 1 }); return a; }, []);
