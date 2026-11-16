// Dev helper: render brand poses to a PNG contact sheet for a visual check.
import { Resvg } from "@resvg/resvg-js";
import { writeFileSync } from "node:fs";
import { poseFrame } from "../src/core/figure/engine";
import { frameToSvg } from "../src/core/figure/svg";
import { FLEX, LOADING, REST } from "../src/core/figure/poses";
import exercises from "../src/core/seed/exercises.json";
import type { FigureSpec } from "../src/core/types";

const out = process.argv[2] ?? "poses.png";
const which = process.argv[3];
const list: [string, FigureSpec][] = which === "all"
  ? exercises.map((e) => [e.name, e.figure as unknown as FigureSpec])
  : [["FLEX", FLEX], ["REST", REST], ["LOADING", LOADING]];
const cols = which === "all" ? 6 : 3, W = 180;
const rows = Math.ceil(list.length / cols);
let body = "";
list.forEach(([name, spec], i) => {
  const x = (i % cols) * W, y = Math.floor(i / cols) * 140;
  [0, 1].forEach((k, j) => {
    body += `<svg x="${x + j * 80 + 8}" y="${y + 10}" width="80" height="88" viewBox="0 -24 120 131">${frameToSvg(poseFrame(spec, k))}</svg>`;
  });
  body += `<text x="${x + 8}" y="${y + 120}" fill="#8aa" font-size="11" font-family="Helvetica">${name.slice(0, 28)}</text>`;
});
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${cols * W}" height="${rows * 140}"><rect width="100%" height="100%" fill="#05070d"/>
<style>.mn polyline,.mn circle{fill:none;stroke:#4fa6ff;stroke-width:2.6;stroke-linecap:round;stroke-linejoin:round}.lt line,.lt polyline,.lt circle{fill:none;stroke:#2b5aa6;stroke-width:1.6;stroke-linecap:round}.floor{stroke:#2b5aa6;stroke-width:1}</style>${body}</svg>`;
writeFileSync(out, new Resvg(svg, { fitTo: { mode: "zoom", value: 2 } }).render().asPng());
console.log("wrote", out);
