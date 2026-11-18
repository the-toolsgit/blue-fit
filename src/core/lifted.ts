// "You lifted a car": the workout's volume next to an everyday heavy object of about that weight (summary).
// Typical weights, rounded (manufacturer and reference figures; models vary, so it's for fun).
// Pure and framework-free; the drawings live in the UI (ui/components/Lifted.tsx).

export type LiftedId = "fridge" | "motorcycle" | "piano" | "car" | "pickup" | "bus" | "semi" | "jet" | "tank" | "shuttle";
/** quip: a dry one-liner, shown under the count */
export interface LiftedThing { id: LiftedId; name: string; plural: string; lb: number; quip: string }

export const LIFTED: LiftedThing[] = [
  { id: "fridge", name: "fridge", plural: "fridges", lb: 250, quip: "Full. You earned what's inside." },
  { id: "motorcycle", name: "motorcycle", plural: "motorcycles", lb: 500, quip: "Zero to sixty. You, not it." },
  { id: "piano", name: "grand piano", plural: "grand pianos", lb: 1000, quip: "Movers charge extra for this." },
  { id: "car", name: "car", plural: "cars", lb: 3500, quip: "Parked it on your chest." },
  { id: "pickup", name: "pickup truck", plural: "pickup trucks", lb: 5000, quip: "Your friends will ask you to help them move." },
  { id: "bus", name: "school bus", plural: "school buses", lb: 25000, quip: "Field trip's on you." },
  { id: "semi", name: "semi truck", plural: "semi trucks", lb: 35000, quip: "Empty trailer. Still a semi." },
  { id: "jet", name: "jet airliner", plural: "jet airliners", lb: 90000, quip: "Empty. No passengers. Still." },
  { id: "tank", name: "tank", plural: "tanks", lb: 130000, quip: "Armored, like your excuses used to be." },
  { id: "shuttle", name: "space shuttle", plural: "space shuttles", lb: 165000, quip: "Houston, we have a PR." },
];

export interface LiftedMatch { thing: LiftedThing; count: number; label: string }

/** The heaviest object the volume reaches, with how many of it (one decimal under 10, else whole). Under a fridge → null. */
export function liftedFor(volumeLb: number): LiftedMatch | null {
  const thing = [...LIFTED].reverse().find((a) => volumeLb >= a.lb);
  if (!thing) return null;
  const raw = volumeLb / thing.lb;
  const count = raw < 10 ? Math.floor(raw * 10) / 10 : Math.floor(raw);
  const n = Number.isInteger(count) ? String(count) : count.toFixed(1);
  return { thing, count, label: count === 1 ? `${/^[aeiou]/i.test(thing.name) ? "an" : "a"} ${thing.name}` : `${n} ${thing.plural}` };
}
