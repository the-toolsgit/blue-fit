// Builds the exercise library (src/core/seed/library.json): every gym exercise the app knows, with muscles,
// weekly-set weights and the ★ heavy-lift mark. Plan and rule: docs/plans/exercise-library.md.
// Source: free-exercise-db (public domain, pinned commit) + Jeff Nippard exercises missing from it (each with a source).
// Usage: node scripts/build-library.mjs   (needs network; prints a review report)
import { writeFileSync } from "node:fs";

const COMMIT = "f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5";
const URL = `https://raw.githubusercontent.com/yuhonas/free-exercise-db/${COMMIT}/dist/exercises.json`;

// ---------- 1. Which source exercises are kept ----------
const KEEP_CATEGORY = new Set(["strength", "powerlifting"]);
const KEEP_EQUIPMENT = new Set(["barbell", "dumbbell", "cable", "machine", "body only", "e-z curl bar", "other"]);
// Muscles we don't track as a group: left out, listed in the report. (Abs and neck were added Nov 17 2026.)
const NO_GROUP = new Set([]);
// Not common gym strength exercises: banded/chained/speed/explosive variants, strongman, odd or unsafe drills.
const DROP = [
  /band/i, /chain/i, /speed /i, /jump/i, /clean/i, /snatch/i, /jerk/i, /sled/i, /suspended/i, /plate movers/i,
  /isometric/i, /kipping/i, /muscle up/i, /rope climb/i, /london bridges/i, /battling/i, /rocky/i, /car drivers/i,
  /anti-gravity/i, /bradford/i, /jammer/i, /spell caster/i, /wind sprints/i, /air bike/i, /lunge sprint/i,
  /around the worlds/i, /^iron cross/i, /cuban press/i, /chair squat/i, /balance board/i, /power partials/i,
  /body-up/i, /body tricep press/i, /towel/i, /plate pinch/i, /hand squeeze/i, /finger curls/i, /wrist roller/i,
  /wrist rotations/i, /svend/i, /guillotine/i, /front raise and pullover/i, /clock push/i, /push up to side plank/i,
  /kneeling squat/i, /flutter kicks/i, /step-up with knee raise/i, /^leg lift$/i, /jefferson/i, /pin presses/i,
  /board press/i, /reverse band/i, /gironda/i, /side to side chins/i, /one arm chin-up/i, /single-arm push-up/i,
  /smith machine pistol/i, /lying machine squat/i, /cable deadlifts/i, /one-arm side deadlift/i, /squat to a bench/i,
  /behind the neck/i, /press behind neck/i, /single-leg high box/i, /hanging bar good morning/i, /good morning off pins/i,
  /seated good mornings/i, /incline push-up (medium|reverse grip|wide)/i, /pushups \(close and wide/i,
  /barbell incline shoulder raise/i, /smith incline shoulder raise/i, /dumbbell incline shoulder raise/i,
  /straight raises on incline/i, /standing front barbell raise over head/i, /straight-arm front delt raise above head/i,
  /see-saw press/i, /bosu/i, /reverse plate curls/i, /chain handle/i, /platform hamstring slides/i,
  /reverse hyperextension/i, /cocoons/i, /otis-up/i, /gorilla chin/i, /spider crawl/i, /judo flip/i, /butt-ups/i, /bottoms up/i, /frog sit-ups/i, /reverse calf raise/i, /^dumbbell raise$/i, /natural glute ham/i, /barbell side split squat/i, /narrow stance squats/i,
  /wide stance barbell squat/i, /barbell full squat/i, /^weighted squat$/i, /elevated back lunge/i, /plie dumbbell/i,
  /kneeling single-arm high pulley/i, /kneeling high pulley row/i, /shotgun row/i, /elevated cable rows/i,
  /bodyweight mid row/i, /sled row/i, /mixed grip chin/i, /wide-grip rear pull-up/i, /bodyweight flyes/i,
  /incline dumbbell flyes - with a twist/i, /cable iron cross/i, /neck press/i, /decline close-grip bench to skull/i,
  /lying close-grip barbell triceps press to chin/i, /reverse triceps bench press/i, /incline push-up close-grip/i,
  /close-grip push-up off of a dumbbell/i, /weighted bench dip/i, /ring dips/i, /landmine 180/i,
];

// ---------- 2. Muscles: movement templates (direct 1, indirect ½), following the plan's own conventions ----------
const T = {
  squat: [["quads", 1], ["glutes", 0.5], ["adductors", 0.5]],          // as Smith Squat / Leg Press in the plan
  lunge: [["quads", 1], ["glutes", 0.5], ["adductors", 0.5]],
  deadlift: [["glutes", 1], ["hamstrings", 1], ["back", 0.5], ["traps", 0.5], ["quads", 0.5]],
  hinge: [["hamstrings", 1], ["glutes", 0.5]],                          // RDL, stiff-leg, good morning
  hipThrust: [["glutes", 1], ["hamstrings", 0.5]],
  glute: [["glutes", 1]],
  backExt: [["glutes", 1], ["hamstrings", 0.5]],
  legCurl: [["hamstrings", 1]],
  legExt: [["quads", 1]],
  calf: [["calves", 1]],
  adduction: [["adductors", 1]],
  abduction: [["glutes", 1]],
  press: [["chest", 1], ["triceps", 0.5], ["frontDelts", 0.5]],
  closePress: [["triceps", 1], ["chest", 0.5], ["frontDelts", 0.5]],   // as Machine Dip in the plan
  fly: [["chest", 1]],
  pulloverChest: [["chest", 1], ["back", 0.5]],
  pulloverLats: [["back", 1], ["chest", 0.5]],
  row: [["back", 1], ["rearDelts", 0.5], ["biceps", 0.5]],             // as Cable Seated Row in the plan
  pulldown: [["back", 1], ["biceps", 0.5]],                             // as Wide-Grip Lat Pulldown in the plan
  straightArm: [["back", 1]],
  ohp: [["frontDelts", 1], ["sideDelts", 0.5], ["triceps", 0.5]],      // as Machine Shoulder Press in the plan
  lateral: [["sideDelts", 1]],
  upright: [["sideDelts", 1], ["traps", 0.5]],
  frontRaise: [["frontDelts", 1]],
  rear: [["rearDelts", 1]],
  facePull: [["rearDelts", 1], ["traps", 0.5], ["back", 0.5], ["rotatorCuff", 0.5]], // as Rope Face Pull in the plan
  rotation: [["rotatorCuff", 1]],
  shrug: [["traps", 1]],
  curl: [["biceps", 1]],
  hammer: [["biceps", 1], ["forearms", 1]],                             // as DB Hammer Curl in the plan
  reverseCurl: [["forearms", 1], ["biceps", 0.5]],
  zottman: [["biceps", 1], ["forearms", 0.5]],
  triceps: [["triceps", 1]],
  wrist: [["forearms", 1]],
  abs: [["abs", 1]],
  neck: [["neck", 1]],
};
// Compound = more than one joint moves under load. Hip thrust / RDL / good morning count as compound, as the source
// and coaches class them (hip hinge with the trunk); back extensions don't.
const COMPOUND = new Set(["squat", "lunge", "deadlift", "hinge", "hipThrust", "press", "closePress", "row", "pulldown", "ohp", "upright"]);

/** Template for a source exercise, by name first, then by its primary muscle. Order matters. */
function templateFor(name, primary) {
  const n = name.toLowerCase();
  if (primary === "abdominals") return "abs";
  if (primary === "neck") return "neck";
  const rules = [
    [/face pull/, "facePull"],
    [/rear-delt rows|rear delt row/, "rear"],
    [/hammer grip.*press/, "press"],
    [/external rotation|internal rotation/, "rotation"],
    [/shrug/, "shrug"],
    [/upright/, "upright"],
    [/calf|calve/, "calf"],
    [/adductor|adduction/, "adduction"],
    [/abductor/, "abduction"],
    [/leg curl|glute ham/, "legCurl"],
    [/leg extension|sissy/, "legExt"],
    [/hip thrust|glute bridge|butt lift|hip raise/, "hipThrust"],
    [/kickback/, primary === "triceps" ? "triceps" : "glute"],
    [/pull through/, "glute"],
    [/hyperextension/, "backExt"],
    [/romanian|stiff-leg|stiff leg|good morning/, "hinge"],
    [/deadlift|rack pull/, "deadlift"],
    [/squat|leg press|lunge|step up|step-up|split/, n.includes("lunge") || n.includes("split") || n.includes("step") ? "lunge" : "squat"],
    [/pullover/, primary === "lats" ? "pulloverLats" : "pulloverChest"],
    [/straight-arm pulldown|cable incline pushdown/, "straightArm"],
    [/pulldown|pull-up|pullup|pull ups|\bchin/, "pulldown"],
    [/row|bench pull/, primary === "shoulders" ? "rear" : "row"],
    [/fly|flye|crossover|butterfly/, primary === "shoulders" ? "rear" : "fly"],
    [/rear|reverse flye|reverse machine/, "rear"],
    [/lateral|scaption|deltoid raise|y raise/, "lateral"],
    [/front .*raise|front cable raise|front plate raise|dumbbell raise|single dumbbell raise/, "frontRaise"],
    [/wrist|pronation|supination/, "wrist"],
    [/zottman/, "zottman"],
    [/hammer/, "hammer"],
    [/reverse (barbell |cable |dumbbell )?curl|reverse barbell preacher/, "reverseCurl"],
    [/curl/, "curl"],
    [/dips - chest/, "press"],
    [/close-grip.*(bench|press)|jm press|dip|floor press|close triceps position|close-grip dumbbell press|close-grip ez-bar press/, "closePress"],
    [/push-?up|bench press|incline dumbbell bench|chest press|incline.*press|decline.*press|dumbbell press|smith machine bench|machine bench/, primary === "shoulders" ? "ohp" : "press"],
    [/shoulder press|military|overhead.*press|arnold|dumbbell press|handstand/, "ohp"],
    [/triceps|tricep|skullcrusher|tate press|triceps press/, "triceps"],
  ];
  for (const [re, t] of rules) if (re.test(n)) return t;
  return null;
}

/** Our equipment for a source exercise. */
function equipmentFor(name, eq) {
  const n = name.toLowerCase();
  if (/smith/.test(n)) return "smith";
  if (/leverage|t-bar|long bar|landmine|hack squat|leg press|calf press/.test(n) && !/barbell hack/.test(n)) return "plateMachine";
  if (eq === "machine") return "machine";
  if (eq === "cable") return "cable";
  if (eq === "barbell" || eq === "e-z curl bar" || /trap bar/.test(n)) return "barbell";
  if (eq === "dumbbell") return "dumbbell";
  if (eq === "body only" || /dip|pull ?up|\bchin|push-up|pushup|hyperextension|glute ham|inverted/.test(n)) return "bodyweight";
  return "other";
}

// ---------- 3. Jeff Nippard exercises missing from the source (each with a source) ----------
const SRC = {
  shoulders: "https://generationiron.com/jeff-nippard-shoulder-exercises/",
  back: "https://barbend.com/news/jeff-nippard-ranks-best-and-worst-back-exercises/",
  chest: "https://barbend.com/news/jeff-nippard-ranks-chest-exercises-for-hypertrophy/",
  triceps: "https://fitnessvolt.com/jeff-nippard-ranks-the-20-best-and-worst-triceps-exercises/",
  legs: "https://fitnessvolt.com/jeff-nippard-leg-routine-one-year/",
  picks: "https://fitnessvolt.com/jeff-nippard-best-exercises-every-muscle-group/",
};
const NIPPARD = [
  ["Lean-In Dumbbell Lateral Raise", "dumbbell", "lateral", SRC.shoulders],
  ["Lean-Away Dumbbell Lateral Raise", "dumbbell", "lateral", SRC.shoulders],
  ["Super ROM Lateral Raise", "dumbbell", "lateral", SRC.shoulders],
  ["Side-Lying Dumbbell Lateral Raise", "dumbbell", "lateral", SRC.shoulders, ["Arnold-style side-lying dumbbell raise"]],
  ["Standing Machine Lateral Raise", "machine", "lateral", SRC.shoulders, ["Atlantis standing lateral raise"]],
  ["Seated Machine Lateral Raise", "machine", "lateral", SRC.shoulders],
  ["Cable Lateral Raise", "cable", "lateral", SRC.shoulders],
  ["Cable Y-Raise", "cable", "lateral", SRC.shoulders],
  ["Behind-the-Back Cuffed Cable Lateral Raise", "cable", "lateral", SRC.shoulders],
  ["Reverse Cable Crossover", "cable", "rear", SRC.shoulders],
  ["Neutral-Grip Pull-Up", "bodyweight", "pulldown", SRC.back],
  ["Neutral-Grip Lat Pulldown", "cable", "pulldown", SRC.back],
  ["Half-Kneeling One-Arm Lat Pulldown", "cable", "pulldown", SRC.back],
  ["Cross-Body Lat Pull-Around", "cable", "straightArm", SRC.back],
  ["Pendlay Row", "barbell", "row", SRC.back],
  ["Deficit Pendlay Row", "barbell", "row", SRC.back, ["Modified deficit Pendlay row"]],
  ["Yates Row", "barbell", "row", SRC.back],
  ["Meadows Row", "plateMachine", "row", SRC.back],
  ["Kroc Row", "dumbbell", "row", SRC.back],
  ["Chest-Supported Machine Row", "machine", "row", SRC.back, ["Chest-supported row"]],
  ["Wide-Grip Cable Row", "cable", "row", SRC.back],
  ["Pendulum Squat", "plateMachine", "squat", SRC.legs],
  ["Seated Cable Fly", "cable", "fly", SRC.chest, ["Seated super-stretch cable fly"]],
  ["Cable Press-Around", "cable", "fly", SRC.chest],
  ["Katana Cable Triceps Extension", "cable", "triceps", SRC.triceps],
  ["Overhead Cable Triceps Extension (Bar)", "cable", "triceps", SRC.triceps],
  ["Dumbbell Skullcrusher", "dumbbell", "triceps", SRC.triceps],
  ["Smith Machine JM Press", "smith", "closePress", SRC.triceps],
  ["Cable Triceps Kickback", "cable", "triceps", SRC.triceps],
  ["Bayesian Cable Curl", "cable", "curl", SRC.picks, ["Face-away Bayesian cable curl"]],
  ["Kelso Shrug", "machine", "shrug", "https://boxlifemagazine.com/overlooked-exercises-backed-by-science/"],
];
// In Leo's plan but in neither source: kept so every plan exercise is in the library (source: the plan).
const PLAN_ONLY = [
  ["Lateral/Shrug Hybrid", "dumbbell", "shrug", [["traps", 1], ["sideDelts", 0.5]]],
  ["Overhead Trap", "cable", "lateral", [["traps", 1]]],
  ["All-the-way-up Lateral Raise", "dumbbell", "lateral", [["sideDelts", 1], ["traps", 0.5]]],
];

// ---------- 4. ★ rule (agreed with Leo, Nov 17 2026) ----------
const BIG = new Set(["quads", "glutes", "hamstrings", "back", "chest"]);
/** Free weight that travels over the face or neck: never ★ (safety), even if compound. */
const OVER_FACE = /jm press|skull|lying triceps|triceps press|french/i;
/** Bodyweight lifts people commonly load with extra weight (belt/vest): count as loadable. */
const LOADABLE_BW = /pull[- ]?ups?|\bchin|(?<!bench )dip/i;
/** Free-weight single-leg / balance-limited lifts: not stable enough to load heavy. */
const BALANCE = /lunge|split squat|step up|step-up|one leg|single-leg|single leg/i;

function heavy(name, tpl, equipment, volume) {
  if (tpl === "shrug") return [true, "shrug: very heavy loads in a short range (Leo's call: ★)"];
  if (tpl === "calf") return [true, "calf raise: very heavy loads in a short range (Leo's call: ★)"];
  if (!COMPOUND.has(tpl)) return [false, "single-joint"];
  const big = volume.some((v) => BIG.has(v.group)) || tpl === "ohp";
  if (!big) return [false, "small muscles drive it"];
  if (OVER_FACE.test(name)) return [false, "weight travels over the face"];
  if (equipment === "bodyweight" && !LOADABLE_BW.test(name)) return [false, "bodyweight only"];
  if (BALANCE.test(name) && !["smith", "machine", "plateMachine"].includes(equipment)) return [false, "balance limits the load"];
  return [true, "multi-joint, big muscles, stable"];
}

// ---------- build ----------
const slug = (s) => s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const raw = await (await fetch(URL)).json();
const out = [], report = { dropped: [], noGroup: [], noTemplate: [] };
for (const x of raw) {
  if (!KEEP_CATEGORY.has(x.category) || !KEEP_EQUIPMENT.has(x.equipment)) continue;
  if (DROP.some((re) => re.test(x.name))) { report.dropped.push(x.name); continue; }
  const primary = x.primaryMuscles[0];
  if (NO_GROUP.has(primary)) { report.noGroup.push(x.name); continue; }
  const tpl = templateFor(x.name, primary);
  if (!tpl) { report.noTemplate.push(`${x.name} (${primary})`); continue; }
  const equipment = equipmentFor(x.name, x.equipment);
  const volume = T[tpl].map(([group, weight]) => ({ group, weight }));
  const [isHeavy, heavyWhy] = heavy(x.name, tpl, equipment, volume);
  out.push({ id: slug(x.name), name: x.name, equipment, movement: tpl, compound: COMPOUND.has(tpl), volume, isHeavy, heavyWhy,
    source: { db: "free-exercise-db", id: x.id, mechanic: x.mechanic, primaryMuscles: x.primaryMuscles } });
}
for (const [name, equipment, tpl, url, aliases] of NIPPARD) {
  const volume = T[tpl].map(([group, weight]) => ({ group, weight }));
  const [isHeavy, heavyWhy] = heavy(name, tpl, equipment, volume);
  out.push({ id: slug(name), name, ...(aliases ? { aliases } : {}), equipment, movement: tpl, compound: COMPOUND.has(tpl), volume, isHeavy, heavyWhy,
    source: { nippard: url } });
}
// Same exercise under another name (source entry keeps its name; the other name becomes an alias)
const ALIASES = { "Machine Bench Press": ["Machine Chest Press"], "Butterfly": ["Pec Deck"], "Reverse Machine Flyes": ["Reverse Pec Deck"],
  "Face Pull": ["Rope Face Pull"], "Thigh Adductor": ["Hip Adduction Machine"], "Thigh Abductor": ["Hip Abduction Machine"],
  "Lying Leg Curls": ["Prone Leg Curl"], "Seated Leg Curl": ["Seated Hamstring Curl"] };
for (const e of out) if (ALIASES[e.name]) e.aliases = [...(e.aliases ?? []), ...ALIASES[e.name]];
for (const [name, equipment, tpl, vol] of PLAN_ONLY) {
  const volume = vol.map(([group, weight]) => ({ group, weight }));
  const [isHeavy, heavyWhy] = heavy(name, tpl, equipment, volume);
  out.push({ id: slug(name), name, equipment, movement: tpl, compound: COMPOUND.has(tpl), volume, isHeavy, heavyWhy, source: { plan: "Leo v3.1" } });
}
// Leo's plan exercise id → library name (same exercise), so plan and library can be matched later.
const PLAN_MAP = {
  "t-bar-reverse-row": "T-Bar Row with Handle", "single-arm-cable-lat-pulldown": "One Arm Lat Pulldown", "single-arm-db-row": "One-Arm Dumbbell Row",
  "straight-arm-cable-pulldown": "Straight-Arm Pulldown", "db-incline-curl": "Incline Dumbbell Curl", "barbell-preacher-curl": "Preacher Curl",
  "machine-shoulder-press": "Machine Shoulder (Military) Press", "cable-lateral-raise": "Cable Lateral Raise", "lateral-shrug-hybrid": "Lateral/Shrug Hybrid",
  "barbell-shrug": "Barbell Shrug", "overhead-trap": "Overhead Trap", "machine-reverse-fly": "Reverse Machine Flyes", "smith-squat": "Smith Machine Squat",
  "leg-extension": "Leg Extensions", "prone-leg-curl": "Lying Leg Curls", "hip-adduction": "Thigh Adductor", "standing-calf-raise": "Standing Calf Raises",
  "wide-grip-lat-pulldown": "Wide-Grip Lat Pulldown", "cable-seated-row": "Seated Cable Rows", "ez-bar-incline-tricep-extension": "Incline Barbell Triceps Extension",
  "machine-dip": "Dip Machine", "v-bar-pushdown": "Triceps Pushdown - V-Bar Attachment", "rope-face-pull": "Face Pull",
  "lean-away-lateral-raise": "Lean-Away Dumbbell Lateral Raise", "all-the-way-up-lateral-raise": "All-the-way-up Lateral Raise", "kelso-shrug": "Kelso Shrug",
  "single-arm-cable-reverse-fly": "Cable Rear Delt Fly", "rope-overhead-tricep-extension": "Triceps Overhead Extension with Rope", "db-hammer-curl": "Hammer Curls",
  "leg-press": "Leg Press", "seated-leg-curl": "Seated Leg Curl", "seated-calf-raise": "Seated Calf Raise", "cable-one-arm-tricep-kickback": "Cable Triceps Kickback",
};
for (const [planId, name] of Object.entries(PLAN_MAP)) {
  const e = out.find((x) => x.name === name);
  if (!e) throw new Error("plan exercise not in library: " + name);
  e.planIds = [...(e.planIds ?? []), planId];
}
const ids = new Set();
for (const e of out) { if (ids.has(e.id)) throw new Error("duplicate id " + e.id); ids.add(e.id); }
out.sort((a, b) => a.name.localeCompare(b.name));
writeFileSync("src/core/seed/library.json", JSON.stringify({ source: URL, built: "see git history", exercises: out }, null, 1) + "\n");
console.log(`library: ${out.length} exercises (${out.filter((e) => e.isHeavy).length} ★)`);
console.log(`left out, no muscle group yet (${report.noGroup.length}):`, report.noGroup.join("; "));
console.log(`no template (${report.noTemplate.length}):`, report.noTemplate.join("; "));
console.log(`dropped as uncommon (${report.dropped.length})`);
