/** Workout time: 45 s per set + 2 min rest between sets + 1 min setup per exercise, rounded to 5 min. */
export function estimateMinutes(totalSets: number, exerciseCount: number): number {
  if (totalSets <= 0) return 0;
  return Math.round((totalSets * 0.75 + (totalSets - 1) * 2 + exerciseCount) / 5) * 5;
}
