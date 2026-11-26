// Run the plan builder in a Web Worker (src/ui/planWorker.ts); same result as calling generatePlan directly.
// Falls back to the main thread where workers aren't available or the worker fails.
import { generatePlan, type GenInput } from "../core/generator";
import type { RoutineDay } from "../core/types";

let worker: Worker | null | undefined;
let nextId = 0;
const waiting = new Map<number, { ok: (p: RoutineDay[]) => void; fail: (e: unknown) => void; input: GenInput }>();
// Build on the main thread; an error rejects instead of leaving the wizard waiting forever
const finish = (w: { ok: (p: RoutineDay[]) => void; fail: (e: unknown) => void; input: GenInput }, plan?: RoutineDay[]) => {
  try { w.ok(plan ?? generatePlan(w.input)); } catch (e) { w.fail(e); }
};

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
      finish(w, e.data.plan);
    };
    worker.onerror = () => {
      // Worker broken (e.g. a stale chunk after an update): finish what's waiting here and stop using it
      worker = null;
      waiting.forEach((w) => finish(w));
      waiting.clear();
    };
  }
  return worker;
}

export function generatePlanAsync(input: GenInput): Promise<RoutineDay[]> {
  const w = getWorker();
  if (!w) return new Promise((ok, fail) => setTimeout(() => finish({ ok, fail, input }), 0));
  const id = ++nextId;
  return new Promise((ok, fail) => { waiting.set(id, { ok, fail, input }); w.postMessage({ id, input }); });
}
