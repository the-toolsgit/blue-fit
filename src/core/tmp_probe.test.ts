import { it } from "vitest";
import { buildSeed } from "./seed";
import { mergeCatalog } from "./catalog";
import { catalog } from "./seed/exercise-db/index";
import { poseFrame, figureCenterDx } from "./figure/engine";
import { frameToSvg } from "./figure/svg";
it("probe", () => {
  const c0 = mergeCatalog(buildSeed().exercises, catalog());
  const bad: string[] = [];
  for (const e of c0.exercises) {
    if (!e.figure) { bad.push(e.id + ":nofig"); continue; }
    try { const dx = figureCenterDx(e.figure, 1); const s = frameToSvg(poseFrame(e.figure, 1), dx); if (/NaN|Infinity/.test(s) || !isFinite(dx)) bad.push(e.id + ":nan dx=" + dx); }
    catch (x) { bad.push(e.id + ":throw " + (x as Error).message); }
  }
  throw new Error("LOG " + bad.length + " " + bad.slice(0, 40).join(" | "));
});
