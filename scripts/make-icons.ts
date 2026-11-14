// Generates the app icon, maskable icon, apple-touch-icon and favicon from the FLEX pose,
// drawn by the same figure engine as the app. Usage: npm run icons
import { Resvg } from "@resvg/resvg-js";
import { mkdirSync, writeFileSync } from "node:fs";
import { poseFrame } from "../src/core/figure/engine";
import { frameToSvg } from "../src/core/figure/svg";
import { FLEX } from "../src/core/figure/poses";

const fig = frameToSvg(poseFrame(FLEX, 1)).replace(/<line class="floor"[^>]*\/>/, "");
const STYLE = `.mn polyline,.mn circle{fill:none;stroke:#6cc0ff;stroke-width:3.2;stroke-linecap:round;stroke-linejoin:round}`;

/** pad = fraction of the canvas the figure's box occupies (smaller for maskable safe zone). */
function icon(size: number, pad: number, rounded: boolean) {
  const box = size * pad, off = (size - box) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <radialGradient id="bg" cx="50%" cy="38%" r="75%"><stop offset="0" stop-color="#0f2350"/><stop offset=".55" stop-color="#070d1d"/><stop offset="1" stop-color="#03050b"/></radialGradient>
    <radialGradient id="halo"><stop offset="0" stop-color="#2a7bff" stop-opacity=".32"/><stop offset="1" stop-color="#2a7bff" stop-opacity="0"/></radialGradient>
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs>
  <rect width="${size}" height="${size}" rx="${rounded ? size * 0.22 : 0}" fill="url(#bg)"/>
  <circle cx="${size / 2}" cy="${size * 0.48}" r="${size * 0.42}" fill="url(#halo)"/>
  <svg x="${off}" y="${off}" width="${box}" height="${box}" viewBox="10 -14 100 124" filter="url(#glow)"><style>${STYLE}</style>${fig}</svg>
</svg>`;
}
const png = (svg: string) => new Resvg(svg).render().asPng();

mkdirSync("public/icons", { recursive: true });
writeFileSync("public/icons/icon-192.png", png(icon(192, 0.86, false)));
writeFileSync("public/icons/icon-512.png", png(icon(512, 0.86, false)));
writeFileSync("public/icons/icon-maskable-512.png", png(icon(512, 0.62, false)));
writeFileSync("public/icons/apple-touch-icon.png", png(icon(180, 0.84, false)));
writeFileSync("public/favicon.svg", icon(64, 0.92, true));
writeFileSync("docs/logo.png", png(icon(512, 0.86, true)));
console.log("icons written");
