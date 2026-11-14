// One-off seed extraction: runs the plan page's own data script (DAYS, FIG, EXT, ADD)
// and writes platform-neutral JSON into src/core/seed/. The plan page is the source of truth.
// Usage: npm run seed   (needs docs/source/Leo_Training_Plan.html, which is not in git)
import { readFileSync, writeFileSync } from "node:fs";
import vm from "node:vm";

const html = readFileSync(new URL("../docs/source/Leo_Training_Plan.html", import.meta.url), "utf8");
const script = html.slice(html.indexOf("<script>") + 8, html.indexOf("const daysEl="));
const ctx = { window: {}, Math, Object, Set, Array, String, Number };
vm.createContext(ctx);
vm.runInContext(script + "\nthis.__out={FIG,DAYS};this.__draw=(n,k)=>drawFig(FIG[n],k);", ctx);
const { FIG, DAYS } = JSON.parse(JSON.stringify(ctx.__out));
// Reference renders from the original engine, used to test the TypeScript port (src/core/figure).
const ref = {};
for (const name of Object.keys(FIG)) if (!name.includes("(leg day)")) ref[name] = [0, 0.25, 0.5, 0.75, 1].map((k) => ctx.__draw(name, k));
writeFileSync(new URL("../src/core/figure/reference.fixture.json", import.meta.url), JSON.stringify(ref) + "\n");

const slug = (s) => s.toLowerCase().replace(/\(leg day\)/, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// ---- Approved mapping (Nov 14): D = direct (1 set), I = indirect (0.5 set). Reproduces the weekly volume table.
// Extra tracked groups without targets: Glutes, Rotator cuff, Forearms.
const META = {
  "T-Bar Reverse Row":            { D: ["back"], I: ["rearDelts", "biceps"], eq: "plateMachine", load: "perSide", inc: 2.5, jefit: "Machine T Bar Reverse Row" },
  "Single-arm Cable Lat Pulldown":{ D: ["back"], I: ["biceps"], eq: "cable", load: "total", inc: 5, jefit: "Cable One-Arm Lat Pulldown" },
  "Single-arm DB Row":            { D: ["back"], I: ["rearDelts", "biceps"], eq: "dumbbell", load: "perHand", inc: 5, jefit: "Dumbbell One-Arm Row" },
  "Straight-arm Cable Pulldown":  { D: ["back"], I: [], eq: "cable", load: "total", inc: 5, jefit: "Cable Shoulder Extension" },
  "DB Incline Curl":              { D: ["biceps"], I: [], eq: "dumbbell", load: "perHand", inc: 5, jefit: "Dumbbell Incline Curl" },
  "Barbell Preacher Curl":        { D: ["biceps"], I: [], eq: "fixedBar", load: "total", inc: 10, jefit: "Barbell Preacher Curl" },
  "Machine Shoulder Press":       { D: ["frontDelts"], I: ["sideDelts", "triceps"], eq: "machine", load: "total", inc: 5, jefit: "Machine Shoulder Press" },
  "Cable Lateral Raise":          { D: ["sideDelts"], I: [], eq: "cable", load: "total", inc: 5, jefit: "Cable Lateral Raise" },
  "Lateral/Shrug Hybrid":         { D: ["traps"], I: ["sideDelts"], eq: "dumbbell", load: "perHand", inc: 5, jefit: "Dumbbell Lateral Raise" },
  "Barbell Shrug":                { D: ["traps"], I: [], eq: "barbell", load: "perSide", inc: 2.5, jefit: "Barbell Shrug" },
  "Overhead Trap":                { D: ["traps"], I: [], eq: "cable", load: "total", inc: 5, jefit: "Overheaed trap" },
  "Machine Reverse Fly":          { D: ["rearDelts"], I: [], eq: "machine", load: "total", inc: 5, jefit: "Machine Reverse Fly" },
  "Smith Squat":                  { D: ["quads"], I: ["adductors", "glutes"], eq: "smith", load: "perSide", inc: 5, jefit: "Smith Machine Squat" },
  "Leg Extension":                { D: ["quads"], I: [], eq: "machine", load: "total", inc: 10, jefit: "Machine Leg Extension" },
  "Prone Leg Curl":               { D: ["hamstrings"], I: [], eq: "machine", load: "total", inc: 10, jefit: "Machine Leg Curl (Prone)" },
  "Hip Adduction":                { D: ["adductors"], I: [], eq: "machine", load: "total", inc: 10, jefit: "Machine Hip Adduction" },
  "Standing Calf Raise":          { D: ["calves"], I: [], eq: "machine", load: "total", inc: 10, jefit: "Machine Calf Raise" },
  "Wide-Grip Lat Pulldown":       { D: ["back"], I: ["biceps"], eq: "cable", load: "total", inc: 5, jefit: "Cable Lat Pulldown (Wide Grip)" },
  "Cable Seated Row":             { D: ["back"], I: ["rearDelts", "biceps"], eq: "cable", load: "total", inc: 5, jefit: "Cable Seated Row" },
  "EZ Bar Incline Tricep Extension": { D: ["triceps"], I: [], eq: "fixedBar", load: "total", inc: 10, jefit: "EZ Bar Incline Tricep Extension" },
  "Machine Dip":                  { D: ["triceps"], I: ["chest", "frontDelts"], eq: "machine", load: "total", inc: 5, jefit: "Machine Dip" },
  "V-Bar Pushdown":               { D: ["triceps"], I: [], eq: "cable", load: "total", inc: 5, jefit: "Cable Tricep Pushdown (V-Bar)" },
  "Rope Face Pull":               { D: ["rearDelts"], I: ["traps", "back", "rotatorCuff"], eq: "cable", load: "total", inc: 5, jefit: "Cable Rope Face Pull" },
  "Lean-away Lateral Raise":      { D: ["sideDelts"], I: [], eq: "dumbbell", load: "perHand", inc: 5, jefit: "Dumbbell One-Arm Lateral Raise" },
  "All-the-way-up Lateral Raise": { D: ["sideDelts"], I: ["traps"], eq: "dumbbell", load: "perHand", inc: 5, jefit: "All the way up lateral raise" },
  "Kelso Shrug":                  { D: ["traps"], I: [], eq: "machine", load: "total", inc: 5, jefit: "Machine Seated Row" },
  "Single-arm Cable Reverse Fly": { D: ["rearDelts"], I: [], eq: "cable", load: "total", inc: 5, jefit: "Single arm cable reverse fly" },
  "Rope Overhead Tricep Extension": { D: ["triceps"], I: [], eq: "cable", load: "total", inc: 5, jefit: "Cable Rope Overhead Tricep Extension" },
  "DB Hammer Curl":               { D: ["biceps", "forearms"], I: [], eq: "dumbbell", load: "perHand", inc: 5, jefit: "Dumbbell Alternating Hammer Curl" },
  "Leg Press":                    { D: ["quads"], I: ["adductors", "glutes"], eq: "plateMachine", load: "perSide", inc: 5, jefit: "Machine Leg Press" },
  "Seated Leg Curl":              { D: ["hamstrings"], I: [], eq: "machine", load: "total", inc: 10, jefit: "Machine Seated Leg Curl" },
  "Seated Calf Raise":            { D: ["calves"], I: [], eq: "machine", load: "total", inc: 10, jefit: "Machine Seated Calf Raise" },
  "Cable One-Arm Tricep Kickback":{ D: ["triceps"], I: [], eq: "cable", load: "total", inc: 5, jefit: "Cable One-Arm Tricep Kickback" },
};
const LOWER = new Set(["Smith Squat","Leg Extension","Prone Leg Curl","Hip Adduction","Standing Calf Raise","Leg Press","Seated Leg Curl","Seated Calf Raise"]);

// Slot notes from Leo_Workout_Routine.md (per day, in order)
const NOTES = {
  Mon: ["back version, elbows to hips", "lats stretched", "elbow to hip", "lats only", "biceps long head stretched", "biceps lengthened"],
  Tue: ["only direct front-delt work", "side delts", "upper traps (locked in)", "upper traps", "cable low → overhead, finish in a Y · lower traps", "rear delts"],
  Wed: ["to parallel only (less glute)", "", "hamstrings, short position", "", "upper calf", "extra side delts"],
  Thu: ["", "", "long head", "upright torso", "", "rear delts + mid traps"],
  Fri: ["side delts stretched", "side delts + upper traps", "chest on row-machine pad, arms straight · mid traps", "rear delts", "long head", "brachialis"],
  Sat: ["feet low, not deep (less glute)", "hamstrings stretched", "", "lower calf (soleus)", "", "triceps short position"],
};
const WEEKDAY = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

const exercises = new Map();
const days = [];
for (const day of DAYS) {
  const slots = [];
  day.ex.forEach((e, i) => {
    const base = e.name.replace(" (leg day)", "");
    const m = META[base];
    if (!m) throw new Error("No mapping for " + base);
    const id = slug(base);
    if (!exercises.has(id)) {
      exercises.set(id, {
        id, name: base, aliases: [m.jefit],
        muscles: e.muscles, secondaryMuscles: e.sec,
        volume: [...m.D.map((g) => ({ group: g, weight: 1 })), ...m.I.map((g) => ({ group: g, weight: 0.5 }))],
        equipment: m.eq, loadMode: m.load, isHeavy: !!e.star, bodyRegion: LOWER.has(base) ? "lower" : "upper",
        why: e.why, setup: e.setup, form: e.form, tips: e.tips, avoid: e.mistakes,
        rangeOfMotion: e.rom, tempo: "1–2 s up, 2–3 s down",
        defaultRestSec: 120, incrementLb: m.inc,
        figure: FIG[base] ?? null, isCustom: false, archived: false,
      });
    }
    const [lo, hi] = e.r.split("–").map(Number);
    const slot = { id: `${day.d.toLowerCase()}-${i + 1}`, exerciseId: id, sets: e.s, repMin: lo, repMax: hi ?? lo, restSec: 120 };
    const note = NOTES[day.d]?.[i];
    if (note) slot.notes = note;
    if (e.name.endsWith("(leg day)")) { slot.whyOverride = e.why; slot.tipsOverride = e.tips; }
    slots.push(slot);
  });
  days.push({ id: day.d.toLowerCase(), weekday: WEEKDAY[day.d], title: day.t, slots });
}

// Plan rules (Effort, Progression, ★ Heavy) from the top of the plan page
const rules = [...html.matchAll(/<div class="rule"><b>(.*?)<\/b><p>(.*?)<\/p><\/div>/g)].map((m) => ({ title: m[1], text: m[2] }));
const routine = { id: "leo-v3-1", name: "Leo v3.1", isCurrent: true, createdAt: "2026-11-11T00:00:00.000Z", rules, days };

const targets = [
  { group: "back", min: 14, max: 22, angles: "vertical, rows, lat stretch, lat isolation" },
  { group: "biceps", min: 14, max: 20, angles: "stretched, lengthened, hammer", gap: "short position, heavy palm-up curl" },
  { group: "triceps", min: 14, max: 22, angles: "overhead, pushdown, compound, kickback" },
  { group: "sideDelts", min: 14, max: 20, angles: "cable, stretched, all-the-way-up" },
  { group: "rearDelts", min: 14, max: 20, angles: "machine, cable, face pull" },
  { group: "traps", min: 12, max: 20, angles: "upper, mid, lower" },
  { group: "frontDelts", min: 6, max: 8, angles: "press only", gap: "by design" },
  { group: "chest", min: null, max: null, angles: "dips only", note: "0 by plan" },
  { group: "quads", min: 10, max: null, angles: "squat, leg press, extension" },
  { group: "hamstrings", min: 10, max: null, angles: "short, stretched", gap: "hip hinge (glutes)", acceptedBelow: true, note: "by choice (shorter leg days)" },
  { group: "adductors", min: 10, max: null, angles: "machine, squat, leg press" },
  { group: "calves", min: 8, max: null, angles: "standing, seated" },
  { group: "glutes", min: null, max: null, note: "tracked only" },
  { group: "rotatorCuff", min: null, max: null, note: "tracked only" },
  { group: "forearms", min: null, max: null, note: "tracked only" },
];

const out = (f, d) => writeFileSync(new URL(`../src/core/seed/${f}`, import.meta.url), JSON.stringify(d, null, 2) + "\n");
out("exercises.json", [...exercises.values()]);
out("routine-leo-v3-1.json", routine);
out("targets.json", targets);
console.log(`exercises: ${exercises.size}, days: ${days.length}, slots: ${days.reduce((a, d) => a + d.slots.length, 0)}, sets: ${days.reduce((a, d) => a + d.slots.reduce((b, s) => b + s.sets, 0), 0)}`);
