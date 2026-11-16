// Dev helper: render the splash flex (k = 0, 0.5, 1) with bicep bumps.
import { Resvg } from "@resvg/resvg-js";
import { writeFileSync } from "node:fs";
import { poseFrame } from "../src/core/figure/engine";
import { frameToSvg } from "../src/core/figure/svg";
import { SPLASH_FLEX } from "../src/core/figure/poses";
import { bicepBumps, bumpsToSvg } from "../src/core/figure/flex";
const ks = [0, 0.5, 1];
const body = ks.map((k, i) => { const f = poseFrame(SPLASH_FLEX, k); return `<svg x="${i * 200}" y="0" width="200" height="218" viewBox="0 -24 120 131">${frameToSvg(f)}${bumpsToSvg(bicepBumps(f, k))}</svg>`; }).join("");
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="218"><rect width="100%" height="100%" fill="#05070d"/><style>.mn polyline,.mn circle,.bump path{fill:none;stroke:#4fa6ff;stroke-width:2.6;stroke-linecap:round;stroke-linejoin:round}.floor{display:none}</style>${body}</svg>`;
writeFileSync(process.argv[2], new Resvg(svg, { fitTo: { mode: "zoom", value: 2 } }).render().asPng());
