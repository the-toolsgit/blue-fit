/** Estimated 1RM, Epley: weight × (1 + reps / 30). */
export const epley = (weight: number, reps: number): number => (reps > 0 ? weight * (1 + reps / 30) : 0);
