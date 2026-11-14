import type { PlateStock } from "./types";

export interface PlateResult { plates: number[]; loaded: number; remainder: number }

/** Plates for ONE side. Input is the per-side weight (how per-side lifts are logged). Greedy, heaviest first, limited by pairs owned. */
export function platesPerSide(perSide: number, stock: PlateStock[]): PlateResult {
  const plates: number[] = [];
  let left = Math.max(0, perSide);
  for (const p of [...stock].sort((a, b) => b.weight - a.weight)) {
    let n = 0;
    while (n < p.pairs && left + 1e-9 >= p.weight) { plates.push(p.weight); left -= p.weight; n++; }
  }
  left = Math.round(left * 100) / 100;
  return { plates, loaded: Math.round((perSide - left) * 100) / 100, remainder: left };
}
