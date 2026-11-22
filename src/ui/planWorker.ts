// Builds a plan off the main thread (Build my plan), so taps and scrolling never freeze while it works.
import { generatePlan, type GenInput } from "../core/generator";

self.onmessage = (e: MessageEvent<{ id: number; input: GenInput }>) => {
  const { id, input } = e.data;
  try { self.postMessage({ id, plan: generatePlan(input) }); }
  catch (err) { self.postMessage({ id, error: String(err) }); }
};
