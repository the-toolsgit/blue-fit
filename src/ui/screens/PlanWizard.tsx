// Build a plan for me: a full-screen, one-question-per-screen flow (goal → eating → days → workout length → rest →
// targets → conflicts → build). On the plan, each exercise can be swapped or removed and exercises added. The plan itself comes from core/generator.ts; this file is only the steps.
import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { generatePlan, planConflicts, repsFor, REST_BY_GOAL, swapOptions, type Conflict } from "../../core/generator";
import { slotsMinutes } from "../../core/timeEstimate";
import { uid } from "../../core/util";
import { completeProfile, MUSCLE_GROUPS, muscleLabel, type Goal, type MuscleGroup, type Phase, type RoutineDay, type VolumeTarget } from "../../core/types";
import { formatTarget, isFocus } from "../../core/volume";
import { freshTargets, priorityOf } from "../../core/volumeModel";
import { weekInsight } from "../../core/workoutCheck";
import { useStore } from "../store";
import { Icon } from "../components/Icon";
import { MuscleMap } from "../components/MuscleMap";
import { TargetEdit } from "../components/VolumeTable";
import { Splash } from "../components/Splash";
import { ExercisePicker } from "../components/ExercisePicker";

export interface WizardResult { days: RoutineDay[]; targets: VolumeTarget[]; goal: Goal; phase: Phase }

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
const DAY_NAME = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
/** Rest between sets: what each one suits (REST_BY_GOAL) */
const RESTS: { sec: number; big: string; goal: Goal }[] = [
  { sec: 60, big: "1", goal: "endurance" }, { sec: 90, big: "1½", goal: "maintenance" },
  { sec: 120, big: "2", goal: "growth" }, { sec: 180, big: "3", goal: "strength" },
];
const GOAL_LABEL: Record<Goal, string> = { growth: "mass gain", strength: "strength", endurance: "endurance", maintenance: "maintaining" };
const STEPS = ["goal", "eating", "days", "length", "rest", "targets", "check", "build"] as const;
type Step = (typeof STEPS)[number];

export function PlanWizard({ open, initialTargets, onClose, onDone }: {
  open: boolean; initialTargets: VolumeTarget[]; onClose: () => void; onDone: (r: WizardResult) => void;
}) {
  const { settings, exercises, routine, exMap } = useStore();
  const [step, setStep] = useState<Step>("goal");
  const [goal, setGoal] = useState<Goal>(settings.profile?.goal ?? "growth");
  const [phase, setPhase] = useState<Phase>(settings.profile?.phase ?? "maintaining");
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 6, 0]);
  const [minutes, setMinutes] = useState(75);
  // Rest between sets: the goal's best until the user picks one
  const [restPick, setRestPick] = useState<number | null>(null);
  const restSec = restPick ?? REST_BY_GOAL[goal];
  const [targets, setTargets] = useState<VolumeTarget[]>(initialTargets);
  const [touched, setTouched] = useState(false);
  const [sel, setSel] = useState<MuscleGroup | null>(null);
  const [seed, setSeed] = useState(1);
  const [building, setBuilding] = useState(false);
  const built = useCallback(() => setBuilding(false), []);

  // Goal or eating changed and the targets weren't edited yet: work them out again for the new profile
  const profile = useMemo(() => completeProfile(settings.profile ? { ...settings.profile, goal, phase } : null), [settings.profile, goal, phase]);
  useEffect(() => { if (!touched && profile) setTargets(freshTargets(profile)); }, [profile, touched]);
  useEffect(() => { if (open) { setStep("goal"); setBuilding(false); } }, [open]);
  useEffect(() => { if (!open) return; const prev = document.body.style.overflow; document.body.style.overflow = "hidden"; return () => { document.body.style.overflow = prev; }; }, [open]);

  const conflicts = useMemo(() => planConflicts({ trainDays: days, maxMinutes: minutes, targets, restSec }), [days, minutes, targets, restSec]);
  // The plan you come from: its exercises are swapped for others wherever possible
  const avoid = useMemo(() => new Set(routine?.days.flatMap((d) => d.slots.map((s) => s.exerciseId)) ?? []), [routine]);
  const generated = useMemo(() => (step === "build" ? generatePlan({ goal, trainDays: days, maxMinutes: minutes, targets, exercises, avoid, seed, restSec }) : null),
    [step, goal, days, minutes, targets, exercises, avoid, seed, restSec]);
  // The built plan, then the user's swaps, removals and additions on top
  const [result, setResult] = useState<RoutineDay[] | null>(null);
  useEffect(() => { setResult(generated); setSwaps({}); setOpenRow(null); }, [generated]);
  /** Per slot: the exercise the plan picked and how many swaps along its list of alternatives */
  const [swaps, setSwaps] = useState<Record<string, { orig: string; k: number }>>({});
  const [openRow, setOpenRow] = useState<string | null>(null);
  const [addTo, setAddTo] = useState<string | null>(null);
  const check = useMemo(() => (result ? weekInsight({ id: "", name: "", isCurrent: false, createdAt: "", days: result }, exMap, targets, goal) : null), [result, exMap, targets, goal]);

  if (!open) return null;
  const i = STEPS.indexOf(step);
  const next = () => {
    const n = STEPS[i + 1];
    if (n === "build") setBuilding(true);
    if (n) setStep(n);
  };
  const back = () => (i ? setStep(STEPS[i - 1]) : onClose());
  const editTarget = (t: VolumeTarget) => { setTouched(true); setTargets((ts) => ts.map((x) => (x.group === t.group ? t : x))); };
  const applyFix = (c: Conflict) => {
    if (c.fix?.maxMinutes) setMinutes(c.fix.maxMinutes);
    if (c.fix?.targets) { setTouched(true); setTargets((ts) => ts.map((x) => c.fix!.targets!.find((y) => y.group === x.group) ?? x)); }
  };
  const editDay = (dayId: string, f: (d: RoutineDay) => RoutineDay) => setResult((ds) => ds && ds.map((d) => (d.id === dayId ? f(d) : d)));
  /** Alternatives for a slot: same main muscle and angle, not already in that day; the plan's own pick comes first */
  const altsOf = (d: RoutineDay, slotId: string) => {
    const s = d.slots.find((x) => x.id === slotId)!, orig = swaps[slotId]?.orig ?? s.exerciseId, ex = exMap.get(orig);
    const taken = new Set(d.slots.filter((x) => x.id !== slotId).map((x) => x.exerciseId));
    return ex ? [orig, ...swapOptions(ex, exercises, goal, taken).map((e) => e.id)] : [orig];
  };
  const swap = (d: RoutineDay, slotId: string) => {
    const list = altsOf(d, slotId), cur = swaps[slotId] ?? { orig: list[0], k: 0 }, k = (cur.k + 1) % list.length;
    setSwaps((x) => ({ ...x, [slotId]: { orig: cur.orig, k } }));
    editDay(d.id, (day) => ({ ...day, slots: day.slots.map((x) => (x.id === slotId ? { ...x, exerciseId: list[k] } : x)) }));
  };
  const remove = (d: RoutineDay, slotId: string) => {
    setOpenRow(null);
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
        <Screen eyebrow="Weekly sets per muscle" title="Your targets">
          <div className="wz-map"><MuscleMap intensity={intensity} selected={sel} onSelect={(g) => setSel(sel === g ? null : g)} /></div>
          <div className="wz-targets">
            {MUSCLE_GROUPS.map((m) => {
              const t = targets.find((x) => x.group === m.id), p = priorityOf(m.id, t), focus = isFocus(t);
              return (
                <div key={m.id} className={"wz-trow" + (sel === m.id ? " open" : "")}>
                  <button type="button" className="wz-thead" onClick={() => setSel(sel === m.id ? null : m.id)} aria-expanded={sel === m.id}>
                    <span className="wz-tname">{m.label}</span>
                    <span className={"wz-tprio " + p}>{p === "off" ? "Skip" : p === "priority" ? "Priority" : "Normal"}</span>
                    <span className="mono wz-trange">{focus ? formatTarget(t) : "—"}</span>
                  </button>
                  {sel === m.id && <TargetEdit group={m.id} label={m.label} t={t} current={0} onEdit={editTarget} />}
                </div>
              );
            })}
          </div>
        </Screen>);
      case "check": return (
        <Screen eyebrow="Before we build" title={conflicts.length ? `${conflicts.length} thing${conflicts.length > 1 ? "s" : ""} to fix` : "All good"}>
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
                      <button type="button" className="btn btn-ghost wz-fix" onClick={() => setStep("days")}>Change days</button>
                    </div>}
                    {c.edit.kind === "target" && sel === c.edit.group && <div className="wz-cedit"><TargetEdit group={c.edit.group} label={muscleLabel(c.edit.group)} t={t} current={0} onEdit={editTarget} /></div>}
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
                              <button type="button" className="wz-opt-days" onClick={() => setStep("days")}>
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
          ) : (
            <div className="wz-ok"><Icon name="check" size={56} /><p>Your days, time and targets fit together. Ready to build.</p></div>
          )}
        </Screen>);
      case "build": return !result ? null : (
        <Screen eyebrow={check ? `${check.checks.filter((c) => c.pass).length}/${check.checks.length} plan checks · score ${check.score.score}` : ""} title="Your plan">
          <div className="wz-planbar">
            <span className="muted">Tap an exercise to swap or remove it.</span>
            <button type="button" className="wz-edit" onClick={() => setStep("goal")}>Edit settings</button>
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
                            <span>{exMap.get(s.exerciseId)?.name}</span><span className="mono">{s.sets} × {s.repMin === s.repMax ? s.repMin : `${s.repMin}–${s.repMax}`}</span>
                          </button>
                          {on && (
                            <div className="wz-exact">
                              <button type="button" className="btn btn-ghost" disabled={alts.length < 2} onClick={() => swap(d, s.id)}><Icon name="swap" size={16} /> Swap</button>
                              <button type="button" className="btn btn-ghost" onClick={() => remove(d, s.id)}><Icon name="trash" size={16} /> Remove</button>
                              <small className="muted">{alts.length < 2 ? "No other exercise works the same angle" : `Same muscle and angle · ${(swaps[s.id]?.k ?? 0) + 1} of ${alts.length}`}</small>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
                {d.slots.length > 0 && <button type="button" className="wz-add" onClick={() => setAddTo(d.id)}><Icon name="plus" size={16} /> Add exercise</button>}
              </div>
            ))}
          </div>
          <ExercisePicker open={!!addTo} title="Add exercise" onClose={() => setAddTo(null)}
            onPick={(e) => { const id = addTo!; setAddTo(null); editDay(id, (d) => ({ ...d, slots: [...d.slots, { id: "slot-" + uid().slice(0, 8), exerciseId: e.id, sets: 3, ...repsFor(e, goal, restSec) }] })); }} />
        </Screen>);
    }
  })();

  const cta = step === "build"
    ? (building || !result ? null : (
      <div className="wz-ctas">
        <button type="button" className="btn btn-ghost" onClick={() => { setSeed((x) => x + 1); setBuilding(true); }}><Icon name="undo" size={18} /> Build again</button>
        <button type="button" className="btn btn-primary btn-xl" onClick={() => onDone({ days: result, targets, goal, phase })}><Icon name="check" size={20} /> Use this plan</button>
      </div>))
    : <button type="button" className="btn btn-primary btn-xl wz-next" disabled={step === "days" && !days.length} onClick={next}>{step === "check" ? "Build my plan" : "Continue"}</button>;

  return createPortal(
    <div className="wz" role="dialog" aria-modal="true" aria-label="Build a plan">
      <div className="wz-top">
        <button type="button" className="icon-btn" onClick={back} aria-label="Back" style={{ visibility: i ? "visible" : "hidden" }}><Icon name="back" /></button>
        <div className="wz-progress" aria-hidden>{STEPS.map((s, k) => <span key={s} className={k <= i ? "on" : ""} />)}</div>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="close" /></button>
      </div>
      <div className="wz-body" key={step + seed}>{body}</div>
      <div className="wz-bottom">{cta}</div>
      {/* The plan is ready: the splash flex, then the zoom into his head opens onto the plan underneath */}
      {building && <Splash word="Your plan" onDone={built} />}
    </div>,
    document.body,
  );
}

function Screen({ eyebrow, title, children, center }: { eyebrow: string; title: string; children: React.ReactNode; center?: boolean }) {
  return (
    <div className={"wz-screen" + (center ? " center" : "")}>
      <span className="wz-eyebrow">{eyebrow}</span>
      <h2 className="wz-title">{title}</h2>
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

