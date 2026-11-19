// Dev helper: render the muscle map to PNG (all regions lit) for a visual check.
import { Resvg } from "@resvg/resvg-js";
import { writeFileSync } from "node:fs";
import { GUIDES, HEAD, MAP_H, MAP_W, OUTLINE, regionsFor, type MapView } from "../src/core/muscleMap";

const pts = (l: number[][]) => l.map((q) => q.join(",")).join(" ");
const colors: Record<string, string> = { traps: "#ff3fa8", back: "#3d9bff", rearDelts: "#23e2ff", sideDelts: "#ffc53d", frontDelts: "#a6ff4d", chest: "#b14bff", biceps: "#ff7a45", triceps: "#ff7a45", forearms: "#888", quads: "#3d9bff", adductors: "#23e2ff", glutes: "#ffc53d", hamstrings: "#b14bff", calves: "#a6ff4d" };
const view = (v: MapView, x: number) => `<g transform="translate(${x},0)">${regionsFor(v).map(({ group, shape }) => shape.kind === "ellipse"
  ? `<ellipse cx="${shape.cx}" cy="${shape.cy}" rx="${shape.rx}" ry="${shape.ry}" transform="rotate(${shape.rot ?? 0} ${shape.cx} ${shape.cy})" fill="${colors[group]}" opacity=".55"/>`
  : `<polygon points="${pts(shape.points)}" fill="${colors[group]}" opacity=".55"/>`).join("")}
  ${OUTLINE.map((l) => `<polyline points="${pts(l)}" fill="none" stroke="#4fa6ff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`).join("")}
  ${GUIDES[v].map((l) => `<polyline points="${pts(l)}" stroke="#2b5aa6" stroke-width="1"/>`).join("")}
  <circle cx="${HEAD.cx}" cy="${HEAD.cy}" r="${HEAD.r}" fill="none" stroke="#4fa6ff" stroke-width="1.6"/></g>`;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${MAP_W * 2 + 20}" height="${MAP_H}" viewBox="0 0 ${MAP_W * 2 + 20} ${MAP_H}"><rect width="100%" height="100%" fill="#05070d"/>${view("front", 0)}${view("back", MAP_W + 20)}</svg>`;
writeFileSync(process.argv[2] ?? "map.png", new Resvg(svg, { fitTo: { mode: "zoom", value: 3 } }).render().asPng());
