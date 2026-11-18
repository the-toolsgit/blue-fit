// "You lifted an elephant": the workout's volume next to an animal of about that weight (summary).
// Typical adult weights, rounded (encyclopedia figures; animals vary a lot, so it's for fun).
// Pure and framework-free; the drawings live in the UI (ui/components/Animal.tsx).

export type AnimalId = "cat" | "dog" | "panda" | "lion" | "cow" | "hippo" | "elephant" | "humpback" | "blueWhale";
export interface Animal { id: AnimalId; name: string; plural: string; lb: number }

export const ANIMALS: Animal[] = [
  { id: "cat", name: "cat", plural: "cats", lb: 10 },
  { id: "dog", name: "Labrador", plural: "Labradors", lb: 70 },
  { id: "panda", name: "panda", plural: "pandas", lb: 230 },
  { id: "lion", name: "lion", plural: "lions", lb: 420 },
  { id: "cow", name: "cow", plural: "cows", lb: 1500 },
  { id: "hippo", name: "hippo", plural: "hippos", lb: 3300 },
  { id: "elephant", name: "elephant", plural: "elephants", lb: 13000 },
  { id: "humpback", name: "humpback whale", plural: "humpback whales", lb: 66000 },
  { id: "blueWhale", name: "blue whale", plural: "blue whales", lb: 300000 },
];

export interface AnimalMatch { animal: Animal; count: number; label: string }

/**
 * The heaviest animal the volume reaches, with how many of it (one decimal under 10, else whole).
 * Under a cat's weight → null.
 */
export function animalFor(volumeLb: number): AnimalMatch | null {
  const animal = [...ANIMALS].reverse().find((a) => volumeLb >= a.lb);
  if (!animal) return null;
  const raw = volumeLb / animal.lb;
  const count = raw < 10 ? Math.floor(raw * 10) / 10 : Math.floor(raw);
  const one = count === 1;
  const n = Number.isInteger(count) ? String(count) : count.toFixed(1);
  return { animal, count, label: one ? `${/^[aeiou]/i.test(animal.name) ? "an" : "a"} ${animal.name}` : `${n} ${animal.plural}` };
}
