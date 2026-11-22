// Run the plan builder in a Web Worker (src/ui/planWorker.ts); same result as calling generatePlan directly.
// Falls back to the main thread where workers aren't available or the worker fails.
import { generatePlan, type GenInput } from "../core/generator";
import type { RoutineDay } from "../core/types";

let worker: Worker | null | undefined;
let nextId = 0;
const waiting = new Map<number, { ok: (p: RoutineDay[]) => void; input: GenInput }>();

function getWorker(): Worker | null {
  if (worker !== undefined) return worker;
  try {
    worker = typeof Worker === "function" ? new Worker(new URL("./planWorker.ts", import.meta.url), { type: "module" }) : null;
  } catch { worker = null; }
  if (worker) {
    worker.onmessage = (e: MessageEvent<{ id: number; plan?: RoutineDay[]; error?: string }>) => {
      const w = waiting.get(e.data.id);
      if (!w) return;
      waiting.delete(e.data.id);
      w.ok(e.data.plan ?? generatePlan(w.input));
    };
    worker.onerror = () => {
      // Worker broken (e.g. a stale chunk after an update): finish what's waiting here and stop using it
      worker = null;
      waiting.forEach((w) => w.ok(generatePlan(w.input)));
      waiting.clear();
    };
  }
  return worker;
}

export function generatePlanAsync(input: GenInput): Promise<RoutineDay[]> {
  const w = getWorker();
  if (!w) return new Promise((ok) => setTimeout(() => ok(generatePlan(input)), 0));
  const id = ++nextId;
  return new Promise((ok) => { waiting.set(id, { ok, input }); w.postMessage({ id, input }); });
}
