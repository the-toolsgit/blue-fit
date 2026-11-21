// Contact sheet of every movement template (poses A, middle, B) for checking figures by eye.
// Run: npx tsx scripts/figure-sheet.ts → .figure-sheet.html (not committed)
import { writeFileSync } from "node:fs";
import { buildFigure, TEMPLATES } from "../src/core/figure/templates";
import { poseFrame } from "../src/core/figure/engine";
import { frameToSvg } from "../src/core/figure/svg";
const root = new URL("..", import.meta.url).pathname;
const svg = (spec: any, k: number) => `<svg viewBox="0 -24 120 131" width="110" class="fig">${frameToSvg(poseFrame(spec, k))}</svg>`;
const cells = Object.keys(TEMPLATES).map((id) => { const s = buildFigure(id)!; return `<div class="c"><b>${id}</b><div>${svg(s, 0)}${svg(s, 0.5)}${svg(s, 1)}</div><small>A → B (first move: ${TEMPLATES[id].firstMove.joint} ${TEMPLATES[id].firstMove.dir})</small></div>`; }).join("");
writeFileSync(root + ".figure-sheet.html", `<meta charset="utf-8"><style>body{background:#04060c;color:#eaf2ff;font:13px system-ui;margin:12px}.g{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.c{background:#0b1322;border-radius:10px;padding:8px}.c b{display:block}.fig line,.fig polyline,.fig circle{fill:none;stroke:#4fa6ff;stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round}.fig .lt *{stroke:#2b5aa6;stroke-width:1.6}.fig .floor{stroke:#2b5aa6;stroke-width:1}.fig .muscle{fill:#4fa6ff}small{color:#8494b4}</style><div class="g">${cells}</div>`);
console.log("ok", Object.keys(TEMPLATES).length);
