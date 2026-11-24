// Build a plan for me: a full-screen, one-question-per-screen flow (goal → eating → days → workout length → rest →
// targets → conflicts → build). On the plan, each exercise can be swapped or removed and exercises added. The plan itself comes from core/generator.ts; this file is only the steps.
import { reducedMotion } from "../device";
import { useCallback, useEffect, useMemo, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { generatePlanAsync } from "../generate";
import { planConflicts, repsFor, REST_BY_GOAL, swapOptions, type Conflict } from "../../core/generator";
import { slotsMinutes } from "../../core/timeEstimate";
import { uid, WEEKDAY_LONG } from "../../core/util";
import { completeProfile, MUSCLE_GROUPS, muscleLabel, type Goal, type MuscleGroup, type Phase, type PlanBuild, type RoutineDay, type VolumeTarget } from "../../core/types";
import { formatTarget, isFocus } from "../../core/volume";
import { defaultRange, priorityOf, type Priority } from "../../core/volumeModel";
import { editImpact, weekInsight } from "../../core/workoutCheck";
import { useStore } from "../store";
import { lockScroll } from "../scrollLock";
import { Icon } from "../components/Icon";
import { MuscleMap } from "../components/MuscleMap";
import { DELTS, shouldersTo, TargetEdit, toggleSkip, withPriority } from "../components/TargetEdit";
import { useLongPress } from "../components/longPress";
import { Seg } from "../components/Controls";
import { Splash } from "../components/Splash";
import { ExercisePicker } from "../components/ExercisePicker";
import { Confirm } from "../components/Sheet";
import { Figure } from "../components/Figure";
import { ExerciseSheet } from "./ExerciseScreen";
import { useWeekFailure } from "../components/FailFlame";
import { failureInput, WeekInsight } from "../components/WeekInsight";

export interface WizardResult { days: RoutineDay[]; targets: VolumeTarget[]; goal: Goal; phase: Phase; build?: PlanBuild }

const GOALS: { v: Goal; label: string; sub: string }[] = [
  { v: "growth", label: "Mass gain", sub: "Build muscle" },
  { v: "strength", label: "Strength", sub: "Lift heavier" },
  { v: "endurance", label: "Endurance", sub: "More reps, less rest" },
  { v: "maintenance", label: "Maintain", sub: "Keep what you have" },
];
const PHASES: { v: Phase; label: string; sub: string }[] = [
  { v: "cutting", label: "Cutting", sub: "Eating less to lose fat" },
  { v: "maintaining", label: "Maintaining", sub: "Eating about what you burn" },
  { v: "bulking", label: "Bulking", sub: "Eating more to grow" },
];
const MINUTES = [45, 60, 75, 90];
const WEEK = [1, 2, 3, 4, 5, 6, 0];
const DAY_NAME = WEEKDAY_LONG;
/** Rest between sets: what each one suits (REST_BY_GOAL) */
const RESTS: { sec: number; big: string; goal: Goal }[] = [
  { sec: 60, big: "1", goal: "endurance" }, { sec: 90, big: "1½", goal: "maintenance" },
  { sec: 120, big: "2", goal: "growth" }, { sec: 180, big: "3", goal: "strength" },
];
const PRIO_LABEL: Record<Priority, string> = { priority: "Priority", normal: "Normal", off: "Skip" };
const GOAL_LABEL: Record<Goal, string> = { growth: "mass gain", strength: "strength", endurance: "endurance", maintenance: "maintaining" };
const STEPS = ["goal", "eating", "days", "length", "rest", "targets", "check", "build"] as const;
type Step = (typeof STEPS)[number];

export function PlanWizard({ open, initialTargets, onClose, onDone }: {
  open: boolean; initialTargets: VolumeTarget[]; onClose: () => void; onDone: (r: WizardResult) => void;
}) {
  const { settings, exercises, routine, exMap, toast } = useStore();
  const [step, setStep] = useState<Step>("goal");
  const [goal, setGoalRaw] = useState<Goal>(settings.profile?.goal ?? "growth");
  const [phase, setPhaseRaw] = useState<Phase>(settings.profile?.phase ?? "maintaining");
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 6, 0]);
  const [minutes, setMinutes] = useState(75);
  // Rest between sets: the goal's best until the user picks one
  const [restPick, setRestPick] = useState<number | null>(null);
  const restSec = restPick ?? REST_BY_GOAL[goal];
  const [targets, setTargets] = useState<VolumeTarget[]>(initialTargets);
  const [touched, setTouched] = useState(false);
  const [sel, setSel] = useState<MuscleGroup | null>(null);
  const [head, setHead] = useState<MuscleGroup | null>(null);
  // An opened target (or a delt head inside Shoulders) low on the screen scrolls up so all of it shows above Continue
  useEffect(() => {
    if (!sel && !head) return;
    const id = requestAnimationFrame(() => {
      const el = document.querySelector(".wz-body .wz-trow.open .wz-trow.open") ?? document.querySelector(".wz-body .wz-cedit") ?? document.querySelector(".wz-body .wz-trow.open");
      el?.scrollIntoView({ block: "nearest", behavior: reducedMotion() ? "auto" : "smooth" });
    });
    return () => cancelAnimationFrame(id);
  }, [sel, head]);
  const [seed, setSeed] = useState(1);
  const [building, setBuilding] = useState(false);
  const built = useCallback(() => setBuilding(false), []);
  // The built plan, then the user's swaps, removals and additions on top. Built on demand (not derived), so saving
  // a database exercise to the phone (Add exercise) doesn't rebuild it and lose the edits.
  const [result, setResult] = useState<RoutineDay[] | null>(null);
  /** The recipe and untouched output of the shown plan (saved with it, so a reported plan can be rebuilt exactly) */
  const [recipe, setRecipe] = useState<PlanBuild | null>(null);
  /** Per slot: the exercise the plan picked and how many swaps along its list of alternatives */
  const [swaps, setSwaps] = useState<Record<string, { orig: string; k: number }>>({});
  const [openRow, setOpenRow] = useState<string | null>(null);
  const [addTo, setAddTo] = useState<string | null>(null);
  const [howTo, setHowTo] = useState<string | null>(null);
  const [edited, setEdited] = useState(false);
  /** Leaving the plan would drop the user's edits: what to do once they confirm */
  const [discard, setDiscard] = useState<(() => void) | null>(null);
  /** Which way the last step change went, so the screen slides in from that side */
  const [dir, setDir] = useState<"fwd" | "back">("fwd");
  const swipe = useRef<{ x: number; y: number } | null>(null);

  const profileFor = (g: Goal, p: Phase) => completeProfile(settings.profile ? { ...settings.profile, goal: g, phase: p } : null);
  const profile = useMemo(() => profileFor(goal, phase), [settings.profile, goal, phase]); // eslint-disable-line react-hooks/exhaustive-deps
  // Goal or eating changed and no target was edited yet: work them out again for those answers (the plan's own
  // targets stay until then). Changing the goal also puts the rest back to that goal's best.
  // Each muscle keeps its Priority / Normal / Skip; only the ranges follow the new answers
  const rerange = (g: Goal, p: Phase) => setTargets((ts) => ts.map((t) => {
    const pr = priorityOf(t.group, t);
    return pr === "off" ? t : withPriority(t, pr, defaultRange(t.group, profileFor(g, p), pr, g));
  }));
  const setGoal = (g: Goal) => { setGoalRaw(g); setRestPick(null); if (!touched) rerange(g, phase); };
  const setPhase = (p: Phase) => { setPhaseRaw(p); if (!touched) rerange(goal, p); };
  useEffect(() => {
    if (!open) return;
    setStep("goal"); setBuilding(false); setResult(null); buildId.current++; setTargets(initialTargets); setTouched(false); setRestPick(null); setSeed(1); setEdited(false);
    setDays([1, 2, 3, 4, 6, 0]); setMinutes(75); setOpenRow(null); setSel(null); setHead(null); setDir("fwd");
    setGoalRaw(settings.profile?.goal ?? "growth"); setPhaseRaw(settings.profile?.phase ?? "maintaining");
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => (open ? lockScroll() : undefined), [open]);

  const conflicts = useMemo(() => planConflicts({ trainDays: days, maxMinutes: minutes, targets, restSec, goal }), [days, minutes, targets, restSec, goal]);
  // The plan you come from: its exercises are swapped for others wherever possible
  const avoid = useMemo(() => new Set(routine?.days.flatMap((d) => d.slots.map((s) => s.exerciseId)) ?? []), [routine]);
  // The check screen builds the plan quietly (same seed as the real build) and lists what it would still miss, so
  // "All good" only shows when the plan really passes
  // Built after the screen shows (a few hundred ms on a phone), so the tap that opens it never freezes
  const [previewPlan, setPreviewPlan] = useState<RoutineDay[] | null>(null);
  /** The latest build asked for: an older one finishing late is ignored */
  const buildId = useRef(0);
  useEffect(() => {
    setPreviewPlan(null);
    if (step !== "check") return;
    // Built in a worker (Nov 22 2026), so the screen stays smooth while it works
    let live = true;
    generatePlanAsync({ goal, trainDays: days, maxMinutes: minutes, targets, exercises, avoid, seed, restSec }).then((p) => { if (live) setPreviewPlan(p); });
    return () => { live = false; };
  }, [step, goal, days, minutes, targets, exercises, avoid, seed, restSec]);
  const preview = useMemo(() => {
    if (!previewPlan || conflicts.length) return [];
    const w = weekInsight({ id: "", name: "", isCurrent: false, createdAt: "", days: previewPlan }, exMap, targets, goal);
    return [...new Set(w.checks.filter((c) => !c.pass && !c.warn).flatMap((c) => c.issues.map((x) => `${x.who}: ${x.what.split(" · ")[0]}`)))];
  }, [previewPlan, conflicts.length, exMap, targets, goal]);
  const recipeFor = (sd: number, p: RoutineDay[]): PlanBuild => ({
    version: __APP_VERSION__, at: new Date().toISOString(), goal, phase, trainDays: [...days], maxMinutes: minutes, restSec, seed: sd,
    avoid: [...avoid], targets: structuredClone(targets),
    built: p.map((d) => ({ weekday: d.weekday, title: d.title, slots: d.slots.map((x) => [x.exerciseId, x.sets] as [string, number]) })),
  });
  const build = (sd: number) => {
    // The check screen already built this exact plan (same answers and seed): use it, don't build twice
    const same = previewPlan && sd === seed;
    setSwaps({}); setOpenRow(null); setEdited(false);
    if (same) { setRecipe(recipeFor(sd, previewPlan)); return setResult(structuredClone(previewPlan)); }
    // Otherwise built in the worker while the splash plays (the plan list waits for it)
    setResult(null);
    const id = ++buildId.current;
    generatePlanAsync({ goal, trainDays: days, maxMinutes: minutes, targets, exercises, avoid, seed: sd, restSec }).then((p) => { if (buildId.current === id) { setRecipe(recipeFor(sd, p)); setResult(p); } });
  };
  const plan = useMemo(() => (result ? { id: "wizard", name: "", isCurrent: false, createdAt: "", days: result } : undefined), [result]);
  // Same score as the editor shows once the plan is used: with this week's failure picks
  const weekFail = useWeekFailure(plan, targets);
  const check = useMemo(() => (plan ? weekInsight(plan, exMap, targets, goal, failureInput(plan, exMap, weekFail, goal)) : null), [plan, exMap, targets, goal, weekFail]);

  // (Hooks: above the early return.) After a swap, removal or addition: say what it broke (a muscle over or under its target, an angle left short)
  const editedBy = useRef(false), lastResult = useRef<RoutineDay[] | null>(null);
  useEffect(() => {
    const prev = lastResult.current;
    lastResult.current = result;
    if (!editedBy.current || !prev || !result) return;
    editedBy.current = false;
    const R = (days: RoutineDay[]) => ({ id: "", name: "", isCurrent: false, createdAt: "", days });
    const lines = editImpact(R(prev), R(result), exMap, targets);
    if (lines.length) toast({ kind: "warn", title: "That change breaks the plan check", body: lines.join(" · ") });
  }, [result]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!open) return null;
  const i = STEPS.indexOf(step);
  const next = () => {
    const n = STEPS[i + 1];
    if (n === "build") { setBuilding(true); build(seed); }
    if (n) { setDir("fwd"); setStep(n); }
  };
  /** Leave the built plan (Back, Edit settings, Build again): ask first when the user changed it */
  const leavePlan = (go: () => void) => (step === "build" && edited ? setDiscard(() => go) : go());
  const back = () => (i ? leavePlan(() => { setDir("back"); setStep(STEPS[i - 1]); }) : onClose());
  // Swipe between steps: left = next (up to the check screen; building stays a button tap), right = back.
  // Not from the screen edges (the phone's own back gesture), not on rows that scroll sideways or on fields.
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0], el = e.target as HTMLElement;
    swipe.current = e.touches.length === 1 && t.clientX > 24 && t.clientX < window.innerWidth - 24 && !el.closest("input, textarea, .wz-cmin, .chips-scroll, .stepper, .sheet") ? { x: t.clientX, y: t.clientY } : null;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const s0 = swipe.current; swipe.current = null;
    if (!s0 || building || discard) return;
    const t = e.changedTouches[0], dx = t.clientX - s0.x, dy = t.clientY - s0.y;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    if (dx > 0) { if (i) back(); }
    else if (STEPS[i + 1] && STEPS[i + 1] !== "build" && !(step === "days" && !days.length)) next();
  };
  const editTarget = (t: VolumeTarget) => { setTouched(true); setTargets((ts) => ts.map((x) => (x.group === t.group ? t : x))); };
  /** Priority / Normal / Skip for all three delt heads at once, each to its own default range */
  /** Press and hold a muscle row: Skip it, or back to Normal when skipped (Shoulders: all three heads) */
  const holdSkip = (g: MuscleGroup) => editAll(toggleSkip(targets, g, profileFor(goal, phase), goal));
  const editAll = (ns: VolumeTarget[]) => { setTouched(true); setTargets((ts) => ts.map((x) => ns.find((y) => y.group === x.group) ?? x)); };
  const setShoulders = (x: Priority) => editAll(shouldersTo(targets, x, profile, goal));
  const applyFix = (c: Conflict) => {
    if (c.fix?.maxMinutes) setMinutes(c.fix.maxMinutes);
    if (c.fix?.restSec) setRestPick(c.fix.restSec);
    if (c.fix?.targets) { setTouched(true); setTargets((ts) => ts.map((x) => c.fix!.targets!.find((y) => y.group === x.group) ?? x)); }
  };
  const editDay = (dayId: string, f: (d: RoutineDay) => RoutineDay) => { editedBy.current = true; setResult((ds) => ds && ds.map((d) => (d.id === dayId ? f(d) : d))); };
  /** Alternatives for a slot: same main muscle and angle, not already in that day; the plan's own pick comes first */
  const altsOf = (d: RoutineDay, slotId: string) => {
    const s = d.slots.find((x) => x.id === slotId)!, orig = swaps[slotId]?.orig ?? s.exerciseId, ex = exMap.get(orig);
    // Nothing repeated in the week: the other exercises of every day are taken
    const taken = new Set(result!.flatMap((day) => day.slots).filter((x) => x.id !== slotId).map((x) => x.exerciseId));
    return ex ? [orig, ...swapOptions(ex, exercises, goal, taken).map((e) => e.id)] : [orig];
  };
  const swap = (d: RoutineDay, slotId: string) => {
    const list = altsOf(d, slotId), cur = swaps[slotId] ?? { orig: list[0], k: 0 }, k = (cur.k + 1) % list.length;
    setSwaps((x) => ({ ...x, [slotId]: { orig: cur.orig, k } }));
    // Reps follow the new exercise (e.g. a ★ lift gets heavy reps for strength); mass gain keeps the heavy / light role
    editDay(d.id, (day) => ({ ...day, slots: day.slots.map((x) => {
      if (x.id !== slotId) return x;
      const role = goal === "growth" ? (x.repMin === 6 && x.repMax === 10 ? "heavy" : x.repMin === 12 && x.repMax === 15 ? "light" : undefined) : undefined;
      return { ...x, exerciseId: list[k], ...repsFor(exMap.get(list[k])!, goal, restSec, role) };
    }) }));
    setEdited(true);
  };
  const remove = (d: RoutineDay, slotId: string) => {
    setOpenRow(null); setEdited(true);
    editDay(d.id, (day) => ({ ...day, slots: day.slots.filter((x) => x.id !== slotId) }));
  };
  const intensity = Object.fromEntries(MUSCLE_GROUPS.map((m) => { const t = targets.find((x) => x.group === m.id); return [m.id, !isFocus(t) ? 0 : priorityOf(m.id, t) === "priority" ? 1 : 0.55]; }));

  const body = (() => {
    switch (step) {
      case "goal": return (
        <Screen center eyebrow="Your goal" title="What are you training for?">
          <Choices items={GOALS} value={goal} onPick={(v) => setGoal(v as Goal)} />
        </Screen>);
      case "eating": return (
        <Screen center eyebrow="Eating" title="How are you eating?">
          <Choices items={PHASES} value={phase} onPick={(v) => setPhase(v as Phase)} />
        </Screen>);
      case "days": return (
        <Screen center eyebrow={`${days.length} workout${days.length === 1 ? "" : "s"} a week`} title="Which days do you train?">
          <div className="wz-days">
            {WEEK.map((d) => {
              const on = days.includes(d);
              return (
                <button key={d} type="button" className={"wz-day" + (on ? " on" : "")} aria-pressed={on}
                  onClick={() => setDays((xs) => (on ? xs.filter((x) => x !== d) : [...xs, d]))}>
                  <span>{DAY_NAME[d]}</span><b>{on ? "Train" : "Rest"}</b>
                </button>
              );
            })}
          </div>
        </Screen>);
      case "length": return (
        <Screen eyebrow="Workout length" title="How long can a workout be?">
          <p className="muted wz-note">An average: a workout 5 minutes shorter or longer still counts.</p>
          <div className="wz-minutes">
            {MINUTES.map((m) => (
              <button key={m} type="button" className={"wz-min" + (m === minutes ? " on" : "")} aria-pressed={m === minutes} onClick={() => setMinutes(m)}>
                <b>{m}</b><span>min</span><small>{m - 5}–{m + 5} on average</small>
              </button>
            ))}
          </div>
        </Screen>);
      case "rest": return (
        <Screen eyebrow="Rest between sets" title="How long do you rest?">
          <p className="muted wz-note">Best for {GOAL_LABEL[goal]}: {RESTS.find((x) => x.sec === REST_BY_GOAL[goal])!.big} min. It sets how long each workout takes.</p>
          <div className="wz-minutes">
            {RESTS.map((x) => (
              <button key={x.sec} type="button" className={"wz-min" + (x.sec === restSec ? " on" : "")} aria-pressed={x.sec === restSec} onClick={() => setRestPick(x.sec)}>
                <b>{x.big}</b><span>min</span><small>{x.goal === goal ? "Best for your goal" : `For ${GOAL_LABEL[x.goal]}`}</small>
              </button>
            ))}
          </div>
        </Screen>);
      case "targets": return (
        <Screen eyebrow="Weekly sets per muscle" title="Your targets" sub="Tap to adjust">
          <div className="wz-map"><MuscleMap intensity={intensity} selected={sel} onSelect={(g) => setSel(sel === g ? null : g)} /></div>
          <div className="wz-targets">
            {MUSCLE_GROUPS.filter((m) => !DELTS.includes(m.id) || m.id === DELTS[0]).map((m) => {
              if (DELTS.includes(m.id)) {
                // One Shoulders row: Priority / Normal / Skip for all three heads; tap a head to fine-tune its range
                const ps = DELTS.map((g) => priorityOf(g, targets.find((x) => x.group === g)));
                const p = ps.every((x) => x === ps[0]) ? ps[0] : null, open = !!sel && DELTS.includes(sel);
                return (
                  <div key="shoulders" className={"wz-trow" + (open ? " open" : "") + (p === "off" ? " skipped" : "")}>
                    <HoldButton className="wz-thead" onClick={() => { setSel(open ? null : "sideDelts"); setHead(null); }} onHold={() => holdSkip("sideDelts")} aria-expanded={open}>
                      <span className="wz-tname">Shoulders</span>
                      <span className={"wz-tprio " + (p ?? "mixed")}>{p ? PRIO_LABEL[p] : "Mixed"}</span>
                      <span className="mono wz-trange">3 heads</span>
                    </HoldButton>
                    {open && (
                      <div className="vedit">
                        <Seg label="Shoulders: focus" value={(p ?? "") as Priority} onChange={setShoulders}
                          options={[{ v: "priority", label: "Priority" }, { v: "normal", label: "Normal" }, { v: "off", label: "Skip" }]} />
                        <p className="muted" style={{ fontSize: 12, margin: "6px 2px 0" }}>Sets all three heads. Each is still tracked on its own: tap one to change its range.</p>
                        <div className="wz-heads">
                          {DELTS.map((g) => {
                            const t = targets.find((x) => x.group === g), hp = priorityOf(g, t);
                            return (
                              <div key={g} className={"wz-trow" + (head === g ? " open" : "") + (hp === "off" ? " skipped" : "")}>
                                <button type="button" className="wz-thead" onClick={() => { setHead(head === g ? null : g); setSel(g); }} aria-expanded={head === g}>
                                  <span className="wz-tname">{muscleLabel(g)}</span>
                                  <span className={"wz-tprio " + hp}>{PRIO_LABEL[hp]}</span>
                                  <span className="mono wz-trange">{isFocus(t) ? formatTarget(t) : "—"}</span>
                                </button>
                                {head === g && <TargetEdit group={g} label={muscleLabel(g)} t={t} current={0} onEdit={editTarget} hideFocus answers={{ goal, phase }} />}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              }
              const t = targets.find((x) => x.group === m.id), p = priorityOf(m.id, t), focus = isFocus(t);
              return (
                <div key={m.id} className={"wz-trow" + (sel === m.id ? " open" : "") + (p === "off" ? " skipped" : "")}>
                  <HoldButton className="wz-thead" onClick={() => setSel(sel === m.id ? null : m.id)} onHold={() => holdSkip(m.id)} aria-expanded={sel === m.id}>
                    <span className="wz-tname">{m.label}</span>
                    <span className={"wz-tprio " + p}>{p === "off" ? "Skip" : p === "priority" ? "Priority" : "Normal"}</span>
                    <span className="mono wz-trange">{focus ? formatTarget(t) : "—"}</span>
                  </HoldButton>
                  {sel === m.id && <TargetEdit group={m.id} label={m.label} t={t} current={0} onEdit={editTarget} all={targets} onEditAll={editAll} answers={{ goal, phase }} />}
                </div>
              );
            })}
          </div>
        </Screen>);
      case "check": return (
        <Screen eyebrow="Before we build" title={conflicts.length ? `${conflicts.length} thing${conflicts.length > 1 ? "s" : ""} to fix` : !previewPlan ? "Checking…" : preview.length ? "Almost there" : "All good"}>
          {conflicts.length ? (
            <div className="wz-conflicts">
              {conflicts.map((c) => {
                const t = c.edit.kind === "target" ? targets.find((x) => x.group === (c.edit as { group: MuscleGroup }).group) : undefined;
                return (
                  <div key={c.id} className="wz-conflict">
                    <span className="wz-cic"><Icon name="flame" size={18} /></span>
                    <span className="grow">{c.text}</span>
                    {c.edit.kind !== "time" && <div className="wz-fixes">
                      {c.fix && <button type="button" className="btn btn-primary wz-fix" onClick={() => applyFix(c)}>{c.fix.label}</button>}
                      {c.edit.kind === "target" && <button type="button" className="btn btn-ghost wz-fix" aria-expanded={sel === c.edit.group} onClick={() => setSel(sel === (c.edit as { group: MuscleGroup }).group ? null : (c.edit as { group: MuscleGroup }).group)}>Edit target</button>}
                      {c.edit.kind === "rest"
                        ? <button type="button" className="btn btn-ghost wz-fix" onClick={() => { setDir("back"); setStep("rest"); }}>Change rest</button>
                        : <button type="button" className="btn btn-ghost wz-fix" onClick={() => { setDir("back"); setStep("days"); }}>Change days</button>}
                    </div>}
                    {c.edit.kind === "target" && sel === c.edit.group && <div className="wz-cedit"><TargetEdit group={c.edit.group} label={muscleLabel(c.edit.group)} t={t} current={0} onEdit={editTarget} all={targets} onEditAll={editAll} answers={{ goal, phase }} /></div>}
                    {c.edit.kind === "time" && (
                      <div className="wz-cedit wz-opts">
                        <div className="wz-opt">
                          <span className="wz-opt-label">{c.moreDays ? "Option 1 · " : ""}Longer workouts</span>
                          <div className="wz-cmin">
                            {MINUTES.map((m) => <button key={m} type="button" className={"chip" + (m === minutes ? " on" : "")} aria-pressed={m === minutes} onClick={() => setMinutes(m)}>{m} min</button>)}
                          </div>
                        </div>
                        {c.moreDays && (
                          <>
                            <div className="wz-or" aria-hidden><span>or</span></div>
                            <div className="wz-opt">
                              <span className="wz-opt-label">Option 2 · More training days</span>
                              <button type="button" className="wz-opt-days" onClick={() => { setDir("back"); setStep("days"); }}>
                                <span><b>{c.moreDays.days} days a week</b><small>about {c.moreDays.minutes} min each</small></span>
                                <span className="wz-opt-go">Pick days <Icon name="chevron" size={16} /></span>
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              <p className="muted" style={{ fontSize: 13 }}>You can build anyway: the plan gets as close as it can.</p>
            </div>
          ) : preview.length ? (
            <div className="wz-conflicts">
              <div className="wz-conflict">
                <span className="wz-cic"><Icon name="flame" size={18} /></span>
                <span className="grow">Not everything fits in {days.length} workout{days.length > 1 ? "s" : ""} of {minutes} min. The plan would still miss:</span>
                <ul className="wz-misses">{preview.slice(0, 6).map((x) => <li key={x}>{x}</li>)}</ul>
                <div className="wz-fixes">
                  <button type="button" className="btn btn-ghost wz-fix" onClick={() => { setDir("back"); setStep("days"); }}>More days</button>
                  <button type="button" className="btn btn-ghost wz-fix" onClick={() => { setDir("back"); setStep("length"); }}>Longer workouts</button>
                </div>
              </div>
              <p className="muted" style={{ fontSize: 13 }}>You can build anyway: the plan gets as close as it can.</p>
            </div>
          ) : !previewPlan ? (
            <div className="wz-ok wz-checking"><Icon name="target" size={56} /><p>Building it once to check every rule…</p></div>
          ) : (
            <div className="wz-ok"><Icon name="check" size={56} /><p>Your days, time and targets fit together. Ready to build.</p></div>
          )}
        </Screen>);
      case "build": return !result ? null : (
        <Screen eyebrow={check ? `${check.checks.filter((c) => c.pass).length}/${check.checks.length} plan checks · score ${check.score.score}` : ""} title="Your plan">
          <div className="wz-planbar">
            <span className="muted">Tap an exercise to swap or remove it.</span>
            <button type="button" className="wz-edit" onClick={() => leavePlan(() => { setDir("back"); setStep("goal"); })}>Edit settings</button>
          </div>
          <div className="wz-plan">
            {result.map((d) => (
              <div key={d.id} className={"wz-pday" + (d.slots.length ? "" : " rest")}>
                <div className="wz-pdh">
                  <span>{DAY_NAME[d.weekday!].slice(0, 3)}</span><b>{d.slots.length ? d.title : "Rest"}</b>
                  {d.slots.length > 0 && <span className="mono">{d.slots.reduce((a, s) => a + s.sets, 0)} sets · ~{slotsMinutes(d.slots)} min</span>}
                </div>
                {d.slots.length > 0 && (
                  <ul>
                    {d.slots.map((s) => {
                      const on = openRow === s.id, alts = on ? altsOf(d, s.id) : [];
                      return (
                        <li key={s.id} className={on ? "open" : ""}>
                          <button type="button" className="wz-ex" aria-expanded={on} onClick={() => setOpenRow(on ? null : s.id)}>
                            <span>{exMap.get(s.exerciseId)?.name}</span><span className="mono">{s.sets} × {s.repMin === s.repMax ? s.repMin : `${s.repMin}–${s.repMax}`}{s.dropSet && <span className="drop-tag">+drop</span>}</span>
                          </button>
                          {on && (
                            <div className="wz-exact">
                              <button type="button" className="btn btn-ghost" disabled={alts.length < 2} onClick={() => swap(d, s.id)}><Icon name="swap" size={16} /> Swap</button>
                              <button type="button" className="btn btn-ghost" onClick={() => remove(d, s.id)}><Icon name="trash" size={16} /> Remove</button>
                              {/* The exercise's line man, moving; tap for how to do it */}
                              {exMap.get(s.exerciseId)?.figure && (
                                <button type="button" className="wz-exfig" aria-label={`How to do ${exMap.get(s.exerciseId)!.name}`} onClick={() => setHowTo(s.exerciseId)}>
                                  <Figure spec={exMap.get(s.exerciseId)!.figure!} size={64} />
                                </button>
                              )}
                              <small className="muted">{alts.length < 2 ? "No other exercise works the same angle" : `Same muscle and angle · ${(swaps[s.id]?.k ?? 0) + 1} of ${alts.length}`}</small>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
                {<button type="button" className="wz-add" onClick={() => setAddTo(d.id)}><Icon name="plus" size={16} /> Add exercise</button>}
              </div>
            ))}
          </div>
          {/* The same overview and Plan check as the Plan tab, live with every swap, removal or addition (Leo, Nov 23 2026) */}
          {plan && <div className="wz-insight"><WeekInsight routine={plan} exMap={exMap} targets={targets} weekFail={weekFail} /></div>}
          <ExercisePicker open={!!addTo} title="Add exercise" onClose={() => setAddTo(null)}
            onPickMany={(es) => { const id = addTo!; setAddTo(null); setEdited(true); editDay(id, (d) => ({ ...d, slots: [...d.slots, ...es.map((e) => ({ id: "slot-" + uid().slice(0, 8), exerciseId: e.id, sets: 3, ...repsFor(e, goal, restSec) }))] })); }} />
        </Screen>);
    }
  })();

  const cta = step === "build"
    ? (building || !result ? null : (
      <div className="wz-ctas">
        <button type="button" className="btn btn-ghost" onClick={() => leavePlan(() => { setSeed(seed + 1); build(seed + 1); setBuilding(true); })}><Icon name="undo" size={18} /> Build again</button>
        <button type="button" className="btn btn-primary btn-xl" onClick={() => onDone({ days: result.map((d) => ({ ...d, title: !d.slots.length ? "Rest" : d.title === "Rest" ? "Extra" : d.title })), targets, goal, phase, build: recipe ?? undefined })}><Icon name="check" size={20} /> Use this plan</button>
      </div>))
    : <button type="button" className="btn btn-primary btn-xl wz-next" disabled={step === "days" && !days.length} onClick={next}>{step === "check" ? "Build my plan" : "Continue"}</button>;

  return createPortal(
    <div className="wz" role="dialog" aria-modal="true" aria-label="Build a plan">
      <div className="wz-top">
        <button type="button" className="icon-btn" onClick={back} aria-label="Back" style={{ visibility: i ? "visible" : "hidden" }}><Icon name="back" /></button>
        <div className="wz-progress" aria-hidden>{STEPS.map((s, k) => <span key={s} className={k <= i ? "on" : ""} />)}</div>
        <button type="button" className="icon-btn" onClick={() => leavePlan(onClose)} aria-label="Close"><Icon name="close" /></button>
      </div>
      <div className={"wz-body" + (dir === "back" ? " back" : "")} key={step + seed} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>{body}</div>
      <div className="wz-bottom">{cta}</div>
      {/* The plan is ready: the splash flex, then the zoom into his head opens onto the plan underneath */}
      {building && <Splash word="Your plan" onDone={built} />}
      <ExerciseSheet id={howTo} onClose={() => setHowTo(null)} />
      <Confirm open={!!discard} title="Lose your changes?" body="Your swaps, removals and added exercises are thrown away." confirm="Continue" danger
        onClose={() => setDiscard(null)} onConfirm={() => { const go = discard; setDiscard(null); go?.(); }} />
    </div>,
    document.body,
  );
}

function Screen({ eyebrow, title, sub, children, center }: { eyebrow: string; title: string; sub?: string; children: React.ReactNode; center?: boolean }) {
  return (
    <div className={"wz-screen" + (center ? " center" : "")}>
      <span className="wz-eyebrow">{eyebrow}</span>
      <h2 className="wz-title">{title}</h2>
      {sub && <span className="wz-sub">{sub}</span>}
      {children}
    </div>
  );
}

function Choices({ items, value, onPick }: { items: { v: string; label: string; sub: string }[]; value: string; onPick: (v: string) => void }) {
  return (
    <div className="wz-choices">
      {items.map((x) => (
        <button key={x.v} type="button" className={"wz-choice" + (x.v === value ? " on" : "")} aria-pressed={x.v === value} onClick={() => onPick(x.v)}>
          <b>{x.label}</b><span>{x.sub}</span>
        </button>
      ))}
    </div>
  );
}


/** A row button that also does something on press and hold (~0.45 s) */
function HoldButton({ onHold, children, ...rest }: { onHold: () => void; children: ReactNode } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type">) {
  const long = useLongPress(onHold);
  return <button type="button" {...rest} {...long}>{children}</button>;
}
