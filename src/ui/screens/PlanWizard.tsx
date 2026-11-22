// Build a plan for me: a full-screen, one-question-per-screen flow (goal → eating → days → workout length → targets →
// conflicts → build). The plan itself comes from core/generator.ts; this file is only the steps.
import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { generatePlan, planConflicts, type Conflict } from "../../core/generator";
import { completeProfile, MUSCLE_GROUPS, type Goal, type MuscleGroup, type Phase, type RoutineDay, type VolumeTarget } from "../../core/types";
import { formatTarget, isFocus } from "../../core/volume";
import { freshTargets, priorityOf } from "../../core/volumeModel";
import { weekInsight } from "../../core/workoutCheck";
import { useStore } from "../store";
import { Icon } from "../components/Icon";
import { MuscleMap } from "../components/MuscleMap";
import { TargetEdit } from "../components/VolumeTable";
import { Splash } from "../components/Splash";

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
const STEPS = ["goal", "eating", "days", "length", "targets", "check", "build"] as const;
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

  const conflicts = useMemo(() => planConflicts({ trainDays: days, maxMinutes: minutes, targets }), [days, minutes, targets]);
  // The plan you come from: its exercises are swapped for others wherever possible
  const avoid = useMemo(() => new Set(routine?.days.flatMap((d) => d.slots.map((s) => s.exerciseId)) ?? []), [routine]);
  const result = useMemo(() => (step === "build" ? generatePlan({ goal, trainDays: days, maxMinutes: minutes, targets, exercises, avoid, seed }) : null),
    [step, goal, days, minutes, targets, exercises, avoid, seed]);
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
          <div className="wz-minutes">
            {MINUTES.map((m) => (
              <button key={m} type="button" className={"wz-min" + (m === minutes ? " on" : "")} aria-pressed={m === minutes} onClick={() => setMinutes(m)}>
                <b>{m}</b><span>min</span>
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
              {conflicts.map((c) => (
                <div key={c.id} className="wz-conflict">
                  <span className="wz-cic"><Icon name="flame" size={18} /></span>
                  <span className="grow">{c.text}</span>
                  {c.fix && <button type="button" className="btn btn-ghost wz-fix" onClick={() => applyFix(c)}>{c.fix.label}</button>}
                </div>
              ))}
              <p className="muted" style={{ fontSize: 13 }}>You can build anyway: the plan gets as close as it can.</p>
            </div>
          ) : (
            <div className="wz-ok"><Icon name="check" size={56} /><p>Your days, time and targets fit together. Ready to build.</p></div>
          )}
        </Screen>);
      case "build": return !result ? null : (
        <Screen eyebrow={check ? `${check.checks.filter((c) => c.pass).length}/${check.checks.length} plan checks · score ${check.score.score}` : ""} title="Your plan">
          <div className="wz-plan">
            {result.map((d) => (
              <div key={d.id} className={"wz-pday" + (d.slots.length ? "" : " rest")}>
                <div className="wz-pdh"><span>{DAY_NAME[d.weekday!].slice(0, 3)}</span><b>{d.slots.length ? d.title : "Rest"}</b>{d.slots.length > 0 && <span className="mono">{d.slots.reduce((a, s) => a + s.sets, 0)} sets</span>}</div>
                {d.slots.length > 0 && <ul>{d.slots.map((s) => <li key={s.id}><span>{exMap.get(s.exerciseId)?.name}</span><span className="mono">{s.sets} × {s.repMin === s.repMax ? s.repMin : `${s.repMin}–${s.repMax}`}</span></li>)}</ul>}
              </div>
            ))}
          </div>
        </Screen>);
    }
  })();

  const cta = step === "build"
    ? (building || !result ? null : (
      <div className="wz-ctas">
        <button type="button" className="btn btn-ghost" onClick={() => { setSeed((x) => x + 1); setBuilding(true); }}><Icon name="undo" size={18} /> Try again</button>
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

