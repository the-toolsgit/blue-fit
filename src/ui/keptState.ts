import { useState } from "react";

// Choices on the tab screens (Plan's day, Progress range and muscle, History month) stay as you left them when you
// switch tabs and come back. Kept in memory only: a fresh launch starts from the defaults.
const kept = new Map<string, unknown>();

export function useKeptState<T>(key: string, init: T): [T, (v: T) => void] {
  const [v, setV] = useState<T>(() => (kept.has(key) ? (kept.get(key) as T) : init));
  return [v, (n: T) => { kept.set(key, n); setV(n); }];
}
