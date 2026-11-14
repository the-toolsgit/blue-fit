// Thin SVG serializer for a FigureFrame (string only, no DOM). Matches the plan page's markup.
import type { FigureFrame, Pt } from "./engine";

const pts = (a: Pt[]) => a.map((q) => q[0].toFixed(1) + "," + q[1].toFixed(1)).join(" ");

export function frameToSvg(fr: FigureFrame): string {
  let light = "";
  for (const s of fr.light) {
    if (s.kind === "line") light += `<line x1="${s.x1}" y1="${s.y1}" x2="${s.x2}" y2="${s.y2}"${s.width ? ` stroke-width="${s.width}"` : ""}/>`;
    else if (s.kind === "cable") light += `<polyline points="${pts(s.points)}" stroke-dasharray="2 2"/><circle cx="${s.anchor[0]}" cy="${s.anchor[1]}" r="2.2"/>`;
    else light += `<circle cx="${s.cx.toFixed(1)}" cy="${s.cy.toFixed(1)}" r="${s.r}"/>`;
  }
  const f = fr.floor;
  return `<line class="floor" x1="${f.x1}" y1="${f.y1}" x2="${f.x2}" y2="${f.y2}"/><g class="lt">${light}</g><g class="mn">${fr.main
    .map((l) => `<polyline points="${pts(l)}"/>`)
    .join("")}<circle cx="${fr.head.cx.toFixed(1)}" cy="${fr.head.cy.toFixed(1)}" r="${fr.head.r}"/></g>`;
}
