// Bundled into docs/exercises.html by scripts/exercise-doc.ts: the app's own figure engine, so the page's figures
// move exactly like the app's (same poses, same tempo timing).
import { figureCenterDx, phase, poseFrame } from "../src/core/figure/engine";
import { frameToSvg } from "../src/core/figure/svg";

declare const window: any;
window.BF = { figureCenterDx, phase, poseFrame, frameToSvg };
