// Builds docs/muscles.html (the readable muscle database) from docs/data/muscles.json and the exercise library.
// Run: npx tsx scripts/muscle-doc.ts
import { readFileSync, writeFileSync } from "node:fs";
import { failureEligible } from "../src/core/failure";
import type { Exercise } from "../src/core/types";

const root = new URL("..", import.meta.url).pathname;
const data = JSON.parse(readFileSync(root + "docs/data/muscles.json", "utf8"));
const lib = JSON.parse(readFileSync(root + "src/core/seed/library.json", "utf8"));
// Every exercise the app knows: the plan's built-ins first, then the library (same id once)
const seedEx = [...JSON.parse(readFileSync(root + "src/core/seed/exercises.json", "utf8")), ...JSON.parse(readFileSync(root + "src/core/seed/extra-exercises.json", "utf8"))] as Exercise[];
const library: Exercise[] = [...seedEx, ...((lib.exercises ?? lib) as Exercise[]).filter((e) => !seedEx.some((x) => x.id === e.id))];

const esc = (s: string) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const EV: Record<string, [string, string]> = { R: ["research", "ev-r"], C: ["coaching", "ev-c"], J: ["our call", "ev-j"] };
const ev = (k?: string) => (k && EV[k] ? `<span class="ev ${EV[k][1]}" title="${EV[k][0]}">${EV[k][0]}</span>` : "");
const GOALS: [string, string][] = [["growth", "Mass gain"], ["strength", "Strength"], ["endurance", "Endurance"], ["maintain", "Maintain"]];
const MAXSETS = 20;

// Which angle an exercise trains: the plan's own tags first (seed/exercise-jobs.json), then the library's movement type
// and name. Exercises that fit no single angle go under "Whole muscle".
const JOBS = JSON.parse(readFileSync(root + "src/core/seed/exercise-jobs.json", "utf8")) as Record<string, { jobs: Record<string, string | string[]> }>;
type Rule = { angle: string; move?: string[]; name?: RegExp };
const ANGLE_RULES: Record<string, Rule[]> = {
  back: [{ angle: "lats", move: ["pulldown", "straightArm", "pulloverLats"], name: /pull-?up|chin/i }, { angle: "lower back", name: /back ext|hyperext|good morning|superman|deadlift/i }, { angle: "upper back", move: ["row"] }],
  chest: [{ angle: "upper", name: /incline|low.?to.?high|low cable|reverse.?grip bench/i }, { angle: "mid/lower", move: ["press", "fly", "pulloverChest"] }],
  frontDelts: [{ angle: "press", move: ["ohp", "frontRaise"] }],
  sideDelts: [{ angle: "raise", move: ["lateral", "upright"] }],
  rearDelts: [{ angle: "reverse fly", move: ["rear", "facePull"] }],
  traps: [{ angle: "mid/lower", name: /kelso|face pull|y.?raise|overhead trap|prone|scap/i }, { angle: "shrug", move: ["shrug", "lateral"] }],
  biceps: [{ angle: "brachialis", move: ["hammer", "zottman"], name: /hammer|reverse|zottman/i }, { angle: "long head", name: /incline|bayesian|drag|lying supine|behind/i }, { angle: "short head", name: /preacher|spider|concentration|scott|prone/i }],
  triceps: [{ angle: "long head", name: /overhead|french|skull|lying|incline|behind|tate/i }, { angle: "medial head", name: /reverse.?grip|underhand|supinated/i }, { angle: "lateral head", move: ["closePress", "triceps"] }],
  forearms: [{ angle: "extensors", move: ["reverseCurl"], name: /reverse|extensor/i }, { angle: "flexors", move: ["wrist"] }],
  quads: [{ angle: "extension", move: ["legExt"] }, { angle: "squat", move: ["squat", "lunge"] }],
  hamstrings: [{ angle: "knee flexion", move: ["legCurl"], name: /curl|nordic/i }, { angle: "hip hinge", move: ["hinge", "deadlift"] }],
  glutes: [{ angle: "glute medius", move: ["abduction"], name: /abduct/i }, { angle: "glute max", move: ["deadlift", "hipThrust", "glute", "backExt"] }],
  adductors: [{ angle: "adduction", move: ["adduction"] }],
  calves: [{ angle: "bent-knee", name: /seated/i }, { angle: "straight-knee", move: ["calf"] }],
  abs: [{ angle: "obliques", name: /oblique|twist|woodchop|wood chop|side|russian|pallof|windmill|rotat/i }, { angle: "rectus abs", move: ["abs"] }],
  neck: [{ angle: "flexion", name: /flexion|neck curl|front|lying face up/i }, { angle: "extension", move: ["neck"] }],
};
function angleOf(e: Exercise, id: string): string {
  const tag = JOBS[e.id]?.jobs?.[id];
  if (tag) return Array.isArray(tag) ? tag[0] : tag;
  for (const r of ANGLE_RULES[id] ?? []) if ((r.name && r.name.test(e.name)) || (r.move && r.move.includes((e as any).movement))) return r.angle;
  return "Whole muscle";
}

function exerciseList(id: string, weight: number) {
  const xs = library.filter((e) => e.volume?.some((v) => v.group === id && v.weight === weight)).sort((a, b) => Number(!!b.isHeavy) - Number(!!a.isHeavy) || a.name.localeCompare(b.name));
  return xs;
}

function muscle(m: any): string {
  const direct = exerciseList(m.id, 1), indirect = exerciseList(m.id, 0.5);
  const goals = GOALS.map(([k, label]) => {
    const [lo, hi] = m.weeklySets[k];
    const l = (lo / MAXSETS) * 100, w = Math.max(((hi - lo) / MAXSETS) * 100, 1.5);
    return `<div class="goal"><span class="goal-name">${label}</span><span class="bar"><i style="left:${l}%;width:${w}%"></i></span><b class="mono">${lo === 0 ? `0–${hi}` : `${lo}–${hi}`}</b></div>`;
  }).join("");
  const facts: [string, string, string?][] = [
    ["Stretch", m.stretch ? `${esc(m.stretch.how)}${m.stretch.note ? ` <span class="src">${esc(m.stretch.note)}</span>` : ""}` : "No specific stretch rule", m.stretch?.evidence],
    ["Heavy and light", `<b class="${m.heavyLight.needs ? "yes" : "no"}">${m.heavyLight.needs ? "Yes" : "Not needed"}</b> · ${esc(m.heavyLight.why)}`, m.heavyLight.evidence],
    ["Recovery", `<b class="mono">${m.recoveryHours.value} h</b> after hard work${m.recoveryHours.note ? ` · ${esc(m.recoveryHours.note)}` : ""}`, m.recoveryHours.evidence],
    ["To failure", `${m.failure.safe ? `<span class="ok">Safe:</span> ${esc(m.failure.safe)}` : ""}${m.failure.safe && m.failure.avoid ? "<br>" : ""}${m.failure.avoid ? `<span class="warn">Avoid:</span> ${esc(m.failure.avoid)}` : ""}`, m.failure.evidence],
    ["Key lifts", esc(m.keyLifts)],
  ];
  const ul = (xs: string[]) => `<ul>${xs.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>`;
  const exRow = (e: Exercise) => `<li><span>${esc(e.name)}</span>${e.isHeavy ? `<span class="tag key">key lift</span>` : ""}${failureEligible(e) ? `<span class="tag fail">failure ok</span>` : ""}</li>`;
  return `
<section class="muscle" id="${m.id}">
  <header class="m-head">
    <h2>${esc(m.name)}</h2>
    <div class="pills"><span class="pill">${m.size} muscle</span><span class="pill">${m.side === "both" ? "front + back" : m.side}</span>${m.focus ? `<span class="pill pill-on">tracked</span>` : `<span class="pill">optional</span>`}</div>
  </header>
  <p class="does">${esc(m.does)}</p>

  <h3>Angles <span class="count">${m.angles.length}</span></h3>
  <div class="angles">${m.angles.map((a: any) => `<div class="angle"><b>${esc(a.name)}</b><p>${esc(a.what)}</p><p class="eg">${a.examples.map(esc).join(" · ")}</p></div>`).join("")}</div>

  <h3>Weekly sets by goal</h3>
  <div class="goals">${goals}<div class="scale mono"><span>0</span><span>10</span><span>20</span></div></div>

  <dl class="facts">${facts.map(([k, v, e]) => `<div><dt>${k}</dt><dd>${v} ${ev(e)}</dd></div>`).join("")}</dl>

  <div class="cues">
    <div><h4>Setup</h4>${ul(m.setup)}</div>
    <div><h4 class="h-tip">Tips</h4>${ul(m.tips)}</div>
    <div><h4 class="h-avoid">Avoid</h4>${ul(m.avoid)}</div>
  </div>

  <h3>Exercises that train it <span class="count">${direct.length}</span></h3>
  ${[...m.angles.map((a: any) => a.name), "Whole muscle"].map((name: string) => {
    const xs = direct.filter((e) => angleOf(e, m.id) === name);
    return xs.length ? `<details class="exs"><summary><span class="ang">${esc(name)}</span> <span class="count">${xs.length}</span></summary><ul class="ex-list">${xs.map(exRow).join("")}</ul></details>` : "";
  }).join("")}
  <details class="exs"><summary>Exercises that work it indirectly (½ set) <span class="count">${indirect.length}</span></summary><ul class="ex-list">${indirect.map(exRow).join("")}</ul></details>
</section>`;
}

const r = data.rules;
const html = `<meta charset="utf-8">
<title>Blue Fit Muscles</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@500&display=swap">
<style>
/* Layout: one narrow reading column of muscle cards under a sticky index of muscles. Single dark neon look (the app's own). */
:root {
  --bg: #04060c; --card: #0b1322; --card-2: #111c33; --line: rgba(110,165,255,.16); --ink: #eaf2ff; --muted: #8b9bbb;
  --neon: #3d9bff; --neon-2: #23e2ff; --good: #3dffb0; --warn: #ffc53d; --bad: #ff5a5a; --j: #c58bff;
  --display: "Barlow Condensed", "Arial Narrow", system-ui, sans-serif; --body: "IBM Plex Sans", system-ui, sans-serif; --mono: "IBM Plex Mono", ui-monospace, Menlo, monospace;
  color-scheme: dark;
}
body { background: var(--bg); color: var(--ink); font: 15px/1.5 var(--body); }
body::before { content: ""; position: fixed; inset: 0 0 auto; height: env(safe-area-inset-top, 0px); z-index: 10; background: var(--bg); }
.wrap { max-width: 760px; margin: 0 auto; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); padding-block: 28px 64px; }
.mono { font-family: var(--mono); font-variant-numeric: tabular-nums; }
h1 { font: 700 44px/1 var(--display); letter-spacing: .02em; text-transform: uppercase; margin: 0; color: var(--neon); text-shadow: 0 0 22px rgba(61,155,255,.45); }
.lede { color: var(--muted); max-width: 62ch; margin: 10px 0 0; }
.legend { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; font-size: 13px; color: var(--muted); align-items: center; }
.ev { display: inline-block; font: 500 11px/1 var(--mono); padding: 3px 6px; border-radius: 99px; border: 1px solid; vertical-align: 1px; white-space: nowrap; }
.ev-r { color: var(--good); border-color: rgba(61,255,176,.4); } .ev-c { color: var(--neon-2); border-color: rgba(35,226,255,.4); } .ev-j { color: var(--j); border-color: rgba(197,139,255,.4); }
.rules { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin: 22px 0 8px; }
.rule { background: var(--card); border: 1px solid var(--line); border-radius: 14px; padding: 12px 14px; min-width: 0; }
.rule b { display: block; font: 700 26px/1 var(--display); color: var(--neon-2); }
.rule > span { display: block; font-size: 13px; color: var(--muted); margin-top: 4px; }
.rule .ev { margin-left: 2px; }
.index { position: sticky; top: env(safe-area-inset-top, 0px); z-index: 5; background: var(--bg); padding: 10px 0; margin: 14px 0 6px; border-bottom: 1px solid var(--line); display: flex; flex-wrap: wrap; gap: 6px; }
.index a { flex: none; color: var(--ink); text-decoration: none; font: 500 13px var(--body); padding: 6px 11px; border-radius: 99px; border: 1px solid var(--line); background: var(--card); }
.index a:hover, .index a:focus-visible { border-color: var(--neon); outline: none; }
.muscle { background: var(--card); border: 1px solid var(--line); border-radius: 20px; padding: 20px 18px; margin-top: 16px; scroll-margin-top: 64px; }
.m-head { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 8px; }
h2 { font: 700 32px/1 var(--display); text-transform: uppercase; letter-spacing: .03em; margin: 0; }
.pills { display: flex; flex-wrap: wrap; gap: 6px; }
.pill { font-size: 12px; color: var(--muted); border: 1px solid var(--line); border-radius: 99px; padding: 2px 9px; }
.pill-on { color: var(--neon); border-color: rgba(61,155,255,.5); }
.does { margin: 8px 0 0; color: var(--ink); }
h3 { font: 600 13px var(--body); text-transform: uppercase; letter-spacing: .1em; color: var(--muted); margin: 20px 0 8px; }
.count { font: 500 12px var(--mono); color: var(--neon); margin-left: 4px; letter-spacing: 0; }
.angles { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 8px; }
.angle { background: var(--card-2); border-radius: 12px; padding: 10px 12px; min-width: 0; }
.angle b { color: var(--neon-2); text-transform: capitalize; }
.angle p { margin: 4px 0 0; font-size: 13.5px; }
.angle .eg { color: var(--muted); font-size: 12.5px; }
.goals { display: grid; gap: 7px; }
.goal { display: grid; grid-template-columns: 88px 1fr 52px; align-items: center; gap: 10px; font-size: 13.5px; }
.goal b { text-align: right; font-size: 13px; }
.bar { position: relative; height: 8px; border-radius: 99px; background: var(--card-2); }
.bar i { position: absolute; top: 0; bottom: 0; border-radius: 99px; background: linear-gradient(90deg, var(--neon), var(--neon-2)); box-shadow: 0 0 10px rgba(61,155,255,.5); }
.scale { display: flex; justify-content: space-between; margin-left: 98px; margin-right: 62px; font-size: 11px; color: var(--muted); }
.facts { margin: 18px 0 0; display: grid; gap: 0; }
.facts > div { display: grid; grid-template-columns: 118px 1fr; gap: 12px; padding: 9px 0; border-top: 1px solid var(--line); }
dt { color: var(--muted); font-size: 13px; }
dd { margin: 0; font-size: 14px; min-width: 0; }
.yes { color: var(--good); } .no { color: var(--muted); } .ok { color: var(--good); } .warn { color: var(--warn); }
.src { color: var(--muted); font-size: 12.5px; }
.cues { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 14px; margin-top: 14px; }
h4 { margin: 0 0 4px; font: 600 12px var(--body); text-transform: uppercase; letter-spacing: .1em; color: var(--muted); }
.h-tip { color: var(--neon-2); } .h-avoid { color: var(--bad); }
.cues ul { margin: 0; padding-left: 18px; font-size: 14px; }
.cues li + li { margin-top: 3px; }
.exs { border-top: 1px solid var(--line); padding-top: 4px; margin-top: 4px; }
.ang { text-transform: capitalize; }
summary { cursor: pointer; font-weight: 500; list-style: none; display: flex; align-items: center; gap: 4px; min-height: 32px; }
summary::-webkit-details-marker { display: none; }
summary::before { content: "›"; color: var(--neon); font-size: 20px; width: 14px; transition: transform .2s; }
details[open] summary::before { transform: rotate(90deg); }
summary:focus-visible { outline: 1px solid var(--neon); border-radius: 6px; }
.ex-list { list-style: none; padding: 6px 0 0; margin: 0; columns: 2 240px; column-gap: 18px; font-size: 13.5px; }
.ex-list li { break-inside: avoid; padding: 3px 0; display: flex; flex-wrap: wrap; gap: 5px; align-items: center; }
.tag { font: 500 10.5px var(--mono); padding: 1px 6px; border-radius: 99px; }
.tag.key { color: var(--warn); border: 1px solid rgba(255,197,61,.45); }
.tag.fail { color: var(--good); border: 1px solid rgba(61,255,176,.35); }
.sources { margin-top: 28px; font-size: 13.5px; }
.sources h2 { font-size: 24px; }
.sources ul { padding-left: 18px; }
.sources a { color: var(--neon); }
@media (max-width: 520px) { h1 { font-size: 36px; } .facts > div { grid-template-columns: 1fr; gap: 2px; } .goal { grid-template-columns: 76px 1fr 46px; } .scale { margin-left: 86px; margin-right: 56px; } }
@media (prefers-reduced-motion: reduce) { summary::before { transition: none; } }
</style>
<div class="wrap">
  <h1>Blue Fit Muscles</h1>
  <p class="lede">Everything the app knows about each muscle: its angles, how many sets a week for each goal, recovery, failure, key lifts and every exercise that trains it. The exercise database will link here by muscle.</p>
  <div class="legend">How sure we are: ${ev("R")} studies ${ev("C")} what coaches do ${ev("J")} the app's own rule</div>

  <div class="rules">
    <div class="rule"><b class="mono">≤ ${r.maxSetsPerWorkout.value}</b><span>sets per muscle in one workout (12–13 is a warning) ${ev("R")}</span></div>
    <div class="rule"><b class="mono">2 days</b><span>for a muscle over ${r.twoDaysAbove.value} sets a week ${ev("R")}</span></div>
    <div class="rule"><b class="mono">${r.growthReps.min}–${r.growthReps.max}</b><span>reps all grow muscle, close to failure ${ev("R")}</span></div>
    <div class="rule"><b class="mono">≤${r.heavyMaxReps} · ${r.lightMinReps}+</b><span>heavy and light sets, for big muscles ${ev("J")}</span></div>
  </div>
  <p class="lede" style="font-size:13.5px">Weekly sets: sets that hit the muscle only partly (like biceps in a row) count as half. Goals: ${GOALS.map(([k, l]) => `<b>${l}</b> ${esc(r.goals[k].split(": ")[1] ?? r.goals[k])}`).join(" ")}</p>

  <nav class="index" aria-label="Muscles">${data.muscles.map((m: any) => `<a href="#${m.id}">${esc(m.name)}</a>`).join("")}</nav>

  ${data.muscles.map(muscle).join("\n")}

  <section class="sources"><h2>Sources</h2><ul>${data.sources.map((s: any) => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.id)}</a>: ${esc(s.title)}</li>`).join("")}</ul></section>
</div>
`;
writeFileSync(root + "docs/muscles.html", html);
console.log("docs/muscles.html", (html.length / 1024).toFixed(0) + " KB");
