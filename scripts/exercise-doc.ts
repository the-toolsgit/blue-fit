// Builds docs/exercises.html (the readable exercise database) from src/core/seed/exercise-db/*.json, the muscle
// database and the plan's own exercises (their hand-made figures). Figures animate with the app's engine at each
// exercise's tempo. Run: npx tsx scripts/exercise-doc.ts
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { buildSync } from "esbuild";
import { buildFigure } from "../src/core/figure/templates";
import { tempoTiming } from "../src/core/figure/tempo";
import { failureEligible } from "../src/core/failure";
import { buildSeed } from "../src/core/seed/index";
import { MIGRATIONS } from "../src/core/migrations";
import type { Exercise } from "../src/core/types";

const root = new URL("..", import.meta.url).pathname;
const muscles = JSON.parse(readFileSync(root + "src/core/seed/muscles.json", "utf8")).muscles as any[];
const dir = root + "src/core/seed/exercise-db/";
const entries: any[] = readdirSync(dir).filter((f) => f.endsWith(".json")).flatMap((f) => JSON.parse(readFileSync(dir + f, "utf8")));
// The plan's exercises keep their hand-made figures (after the app's own figure fixes)
let seed: any = buildSeed();
for (const m of MIGRATIONS) seed = m.run(seed, "2026-11-20") ?? seed;
const planFig = new Map<string, any>(seed.exercises.map((e: any) => [e.id, e.figure]));

const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const NAME = new Map(muscles.map((m) => [m.id, m.name]));
const EQUIP: Record<string, string> = { barbell: "Barbell", dumbbell: "Dumbbell", cable: "Cable", machine: "Machine", plateMachine: "Plate machine", smith: "Smith", fixedBar: "Fixed bar", bodyweight: "Bodyweight", other: "Other" };
const runtime = buildSync({ entryPoints: [root + "scripts/exercise-doc-runtime.ts"], bundle: true, write: false, format: "iife", minify: true }).outputFiles[0].text;

const GOAL: Record<string, string> = { growth: "mass gain", strength: "strength", endurance: "endurance", maintain: "maintain" };
const goalNames = (g: string[]) => g.map((x) => GOAL[x] ?? x).join(", ");
const anglesOf = (e: any, g: string): string[] => { const j = e.jobs?.[g]; return Array.isArray(j) ? j : j ? [j] : []; };
const figs: any[] = [];
const card = (e: any) => {
  const main = e.volume.find((v: any) => v.weight === 1)?.group;
  const fig = planFig.get(e.id) ?? buildFigure(e.figureTemplate, e.figureAdjust ?? {});
  const i = figs.push({ spec: fig, timing: tempoTiming(e.tempo, e.id) }) - 1;
  const failOk = failureEligible({ ...e, id: e.unsafeFailure ? "ez-bar-incline-tricep-extension" : e.id } as Exercise);
  const indirect = e.volume.filter((v: any) => v.group !== main);
  const ul = (title: string, cls: string, xs?: string[]) => (xs?.length ? `<div><h4 class="${cls}">${title}</h4><ul>${xs.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>` : "");
  const src = e.source ?? {};
  const links = [src.url, src.url2].filter(Boolean).map((u: string, k: number) => `<a href="${esc(u)}" target="_blank" rel="noopener">${k ? "second source" : "source"}</a>`);
  const srcText = src.plan ? "Leo's plan" : src.db ? `${esc(src.db)}` : "";
  return `<article class="ex" id="ex-${esc(e.id)}" data-eq="${esc(e.equipment)}" data-name="${esc([e.name, ...(e.aliases ?? [])].join(" ").toLowerCase())}">
  <div class="ex-top"><svg class="fig" data-i="${i}" viewBox="0 -24 120 131" aria-hidden="true"></svg>
    <div class="ex-head"><h3>${esc(e.name)}${e.isHeavy ? ` <span class="star" title="Key lift">★</span>` : ""}</h3>
      <div class="tags">${anglesOf(e, main).length > 1 ? `<span class="tag ang-t">${esc(anglesOf(e, main).join(" + "))}</span>` : ""}<span class="tag">${esc(EQUIP[e.equipment] ?? e.equipment)}</span>${e.preferred ? `<span class="tag top">top pick: ${esc(goalNames(e.preferred.goals))}</span>` : ""}${e.isHeavy ? `<span class="tag key">key lift</span>` : ""}<span class="tag ${failOk ? "ok" : "no"}">${failOk ? "failure ok" : "no failure"}</span>${indirect.map((v: any) => `<span class="tag ind">${esc(NAME.get(v.group) ?? v.group)} ${v.weight === 1 ? "" : "½"}</span>`).join("")}</div>
      <p class="why">${esc(e.why)}</p>${e.preferred ? `<p class="pref">Top pick: ${esc(e.preferred.why)}${[e.preferred.source?.url, e.preferred.source?.url2].filter(Boolean).map((u: string, k: number) => ` <a href="${esc(u)}" target="_blank" rel="noopener">${k ? "source 2" : "source"}</a>`).join("")}</p>` : ""}</div></div>
  <div class="cues">${ul("Setup", "", e.setup)}${ul("Form", "", e.form)}${ul("Tips", "h-tip", e.tips)}${ul("Avoid", "h-avoid", e.avoid)}</div>
  <p class="meta"><span>Range: ${esc(e.rangeOfMotion)}</span><span>Tempo: ${esc(e.tempo)}</span><span>rest ${Math.round((e.defaultRestSec ?? 120) / 60 * 10) / 10} min</span><span class="src">${srcText}${srcText && links.length ? " · " : ""}${links.join(" · ")}</span></p>
</article>`;
};

// Group: main muscle → angle (an exercise with two angles shows under the first)
const sections = muscles.map((m) => {
  const mine = entries.filter((e) => e.volume.find((v: any) => v.weight === 1)?.group === m.id);
  if (!mine.length) return "";
  // One angle → that group; two or more → "Several angles" (the card lists them); none → "Whole muscle"
  const angles = [...m.angles.map((a: any) => a.name), "Several angles", "Whole muscle"];
  const angleOf = (e: any) => { const a = anglesOf(e, m.id); return a.length > 1 ? "Several angles" : a[0] ?? "Whole muscle"; };
  const groups = angles.map((a) => {
    const xs = mine.filter((e) => angleOf(e) === a).sort((x, y) => Number(!!y.isHeavy) - Number(!!x.isHeavy) || x.name.localeCompare(y.name));
    return xs.length ? `<h3 class="ang">${esc(a)} <span class="count">${xs.length}</span></h3><div class="grid">${xs.map(card).join("")}</div>` : "";
  }).join("");
  // Top picks per goal (endurance and maintain follow mass gain unless an exercise says otherwise)
  const picks = (goal: string) => mine.filter((e) => e.preferred?.goals?.includes(goal)).map((e) => `<a href="#ex-${e.id}">${esc(e.name)}</a>`);
  const top = [["growth", "Mass gain, endurance, maintain"], ["strength", "Strength"]].map(([g, l]) => (picks(g).length ? `<p><b>${l}:</b> ${picks(g).join(" · ")}</p>` : "")).join("");
  return `<section class="muscle" id="${m.id}"><h2>${esc(m.name)} <span class="count">${mine.length}</span></h2>${top ? `<div class="top"><h4>Top picks</h4>${top}</div>` : ""}${groups}</section>`;
}).join("");

const present = muscles.filter((m) => entries.some((e) => e.volume.find((v: any) => v.weight === 1)?.group === m.id));
const equipments = [...new Set(entries.map((e) => e.equipment))];
const html = `<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Blue Fit Exercises</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@500&display=swap">
<style>
/* Layout: filter bar, then muscle → angle sections of exercise cards (two columns on wide screens). Single dark neon look (the app's own). */
:root { --bg: #04060c; --card: #0b1322; --card-2: #111c33; --line: rgba(110,165,255,.16); --ink: #eaf2ff; --muted: #8b9bbb; --neon: #3d9bff; --neon-2: #23e2ff; --good: #3dffb0; --warn: #ffc53d; --bad: #ff5a5a; --fig: #4fa6ff; --fig2: #2b5aa6;
  --display: "Barlow Condensed", "Arial Narrow", system-ui, sans-serif; --body: "IBM Plex Sans", system-ui, sans-serif; --mono: "IBM Plex Mono", ui-monospace, Menlo, monospace; color-scheme: dark; }
body { background: var(--bg); color: var(--ink); font: 15px/1.5 var(--body); }
body::before { content: ""; position: fixed; inset: 0 0 auto; height: env(safe-area-inset-top, 0px); z-index: 10; background: var(--bg); }
.wrap { max-width: 1080px; margin: 0 auto; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); padding-block: 28px 64px; }
h1 { font: 700 44px/1 var(--display); letter-spacing: .02em; text-transform: uppercase; margin: 0; color: var(--neon); text-shadow: 0 0 22px rgba(61,155,255,.45); }
.lede { color: var(--muted); max-width: 66ch; margin: 10px 0 0; }
.bar { position: sticky; top: env(safe-area-inset-top, 0px); z-index: 5; background: var(--bg); padding: 10px 0; margin-top: 14px; border-bottom: 1px solid var(--line); display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.bar a, .bar button { color: var(--ink); text-decoration: none; font: 500 13px var(--body); padding: 6px 11px; border-radius: 99px; border: 1px solid var(--line); background: var(--card); cursor: pointer; }
.bar button[aria-pressed="true"] { border-color: var(--neon); color: var(--neon); }
.bar input { flex: 1 1 180px; min-width: 0; background: var(--card); border: 1px solid var(--line); color: var(--ink); border-radius: 99px; padding: 7px 12px; font: 14px var(--body); }
.muscle { margin-top: 26px; scroll-margin-top: 120px; }
h2 { font: 700 34px/1 var(--display); text-transform: uppercase; letter-spacing: .03em; margin: 0; }
.ang { font: 600 13px var(--body); text-transform: uppercase; letter-spacing: .1em; color: var(--neon-2); margin: 18px 0 8px; }
.count { font: 500 13px var(--mono); color: var(--neon); letter-spacing: 0; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 480px), 1fr)); gap: 12px; }
.ex { background: var(--card); border: 1px solid var(--line); border-radius: 18px; padding: 14px; min-width: 0; }
.ex-top { display: flex; gap: 12px; align-items: flex-start; }
.fig { width: 92px; height: 100px; flex: none; overflow: visible; filter: drop-shadow(0 0 2px rgba(61,155,255,.55)); }
.fig .mn polyline, .fig .mn circle { fill: none; stroke: var(--fig); stroke-width: 2.6; stroke-linecap: round; stroke-linejoin: round; }
.fig .lt line, .fig .lt polyline, .fig .lt circle { fill: none; stroke: var(--fig2); stroke-width: 1.6; stroke-linecap: round; }
.fig .lt polyline[stroke-dasharray] { stroke-dasharray: 2 2; }
.fig .floor { stroke: var(--fig2); stroke-width: 1; opacity: .7; }
.fig .muscle { fill: var(--fig); stroke: none; }
.ex-head { min-width: 0; }
h3 { font: 600 17px/1.25 var(--body); margin: 0; }
.star { color: var(--warn); }
.tags { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 6px; }
.tag { font: 500 11px var(--mono); padding: 2px 7px; border-radius: 99px; border: 1px solid var(--line); color: var(--muted); }
.tag.key { color: var(--warn); border-color: rgba(255,197,61,.45); } .tag.ok { color: var(--good); border-color: rgba(61,255,176,.35); } .tag.no { color: var(--bad); border-color: rgba(255,90,90,.35); } .tag.ind { color: var(--neon-2); } .tag.top { color: var(--on, #02101f); background: var(--neon-2); border-color: var(--neon-2); }
.top { background: var(--card); border: 1px solid rgba(35,226,255,.35); border-radius: 14px; padding: 10px 14px; margin-top: 10px; font-size: 14px; }
.top p { margin: 4px 0 0; } .top a { color: var(--neon-2); } .top b { font-weight: 600; }
.ex { scroll-margin-top: 130px; } .tag.ang-t { color: var(--ink); border-color: rgba(61,155,255,.45); }
.why { margin: 6px 0 0; font-size: 14px; color: var(--ink); }
.pref { margin: 4px 0 0; font-size: 13px; color: var(--neon-2); } .pref a { color: var(--neon); }
.cues { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 10px 14px; margin-top: 10px; }
h4 { margin: 0 0 2px; font: 600 11.5px var(--body); text-transform: uppercase; letter-spacing: .1em; color: var(--muted); }
.h-tip { color: var(--neon-2); } .h-avoid { color: var(--bad); }
.cues ul { margin: 0; padding-left: 17px; font-size: 13.5px; }
.meta { display: flex; flex-wrap: wrap; gap: 4px 14px; margin: 10px 0 0; padding-top: 8px; border-top: 1px solid var(--line); font: 12.5px var(--mono); color: var(--muted); }
.meta a { color: var(--neon); }
.empty { color: var(--muted); margin-top: 20px; }
@media (max-width: 520px) { h1 { font-size: 36px; } .fig { width: 76px; height: 84px; } }
</style>
<div class="wrap">
  <h1>Blue Fit Exercises</h1>
  <p class="lede">Every exercise the app knows, by muscle and angle. Each one moves at its own tempo. Muscles marked ½ get half a set. "Failure ok": safe to take the last set to failure. Phase 1: back and biceps. More muscles follow. Exercises from free-exercise-db (public domain) and the app's own plan; less common variations link their source. The muscle page explains each muscle and angle.</p>
  <nav class="bar" aria-label="Filters">
    ${present.map((m) => `<a href="#${m.id}">${esc(m.name)}</a>`).join("")}
    ${equipments.map((q) => `<button type="button" data-eqf="${esc(q)}" aria-pressed="false">${esc(EQUIP[q] ?? q)}</button>`).join("")}
    <input id="q" type="search" placeholder="Search exercises" aria-label="Search exercises">
  </nav>
  ${sections}
  <p class="empty" id="none" hidden>No exercise matches.</p>
</div>
<script>${runtime}</script>
<script>
const FIGS = ${JSON.stringify(figs)};
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const els = [...document.querySelectorAll("svg.fig")];
const vis = new Set();
const dx = (i) => (FIGS[i].dx ??= BF.figureCenterDx(FIGS[i].spec));
const draw = (el, k) => { const i = +el.dataset.i; if (!FIGS[i].spec) return; el.innerHTML = BF.frameToSvg(BF.poseFrame(FIGS[i].spec, k), dx(i)); };
els.forEach((el) => draw(el, reduce ? 1 : 0));
if (!reduce) {
  const io = new IntersectionObserver((es) => es.forEach((e) => (e.isIntersecting ? vis.add(e.target) : vis.delete(e.target))), { rootMargin: "100px" });
  els.forEach((el) => io.observe(el));
  const t0 = performance.now(); let last = 0;
  const loop = (ms) => { if (ms - last > 32) { last = ms; vis.forEach((el) => { const f = FIGS[+el.dataset.i]; if (f.spec) el.innerHTML = BF.frameToSvg(BF.poseFrame(f.spec, BF.phase(ms - t0, f.timing)), dx(+el.dataset.i)); }); } requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
}
// Filters: equipment buttons (any of the pressed ones) and search
const q = document.getElementById("q"), btns = [...document.querySelectorAll("[data-eqf]")];
const apply = () => {
  const on = btns.filter((b) => b.getAttribute("aria-pressed") === "true").map((b) => b.dataset.eqf), s = q.value.trim().toLowerCase();
  let n = 0;
  document.querySelectorAll(".ex").forEach((c) => { const show = (!on.length || on.includes(c.dataset.eq)) && (!s || c.dataset.name.includes(s)); c.hidden = !show; if (show) n++; });
  document.querySelectorAll(".grid").forEach((g) => { const any = [...g.children].some((c) => !c.hidden); g.hidden = !any; g.previousElementSibling.hidden = !any; });
  document.querySelectorAll(".muscle").forEach((m) => { m.hidden = ![...m.querySelectorAll(".ex")].some((c) => !c.hidden); });
  document.getElementById("none").hidden = n > 0;
};
btns.forEach((b) => b.addEventListener("click", () => { b.setAttribute("aria-pressed", b.getAttribute("aria-pressed") === "true" ? "false" : "true"); apply(); }));
q.addEventListener("input", apply);
</script>
`;
writeFileSync(root + "docs/exercises.html", html);
console.log("docs/exercises.html", entries.length, "exercises", (html.length / 1024).toFixed(0) + " KB");
