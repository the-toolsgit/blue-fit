// Create or edit an exercise (custom or built-in): same detail fields as the plan, volume mapping and an optional figure.
import { useEffect, useMemo, useState } from "react";
import { defaultLoadMode, exerciseInUse, linesToList, listToLines, newCustomExercise, withDerivedMuscles } from "../../core/customExercise";
import { EQUIPMENT_LABEL, MUSCLE_GROUPS, type Equipment, type Exercise, type LoadMode, type MuscleGroup } from "../../core/types";
import { useStore } from "../store";
import { fmtRest } from "../format";
import { Seg, Stepper, Switch } from "./Controls";
import { Figure } from "./Figure";
import { Icon } from "./Icon";
import { Confirm, Sheet } from "./Sheet";

type Draft = Exercise & { _setup: string; _form: string; _tips: string; _avoid: string; _aliases: string };
const toDraft = (e: Exercise): Draft => ({ ...e, _setup: listToLines(e.setup), _form: listToLines(e.form), _tips: listToLines(e.tips), _avoid: listToLines(e.avoid), _aliases: e.aliases.join(", ") });

export function ExerciseEditor({ open, exercise, onClose, onSaved }: { open: boolean; exercise?: Exercise | null; onClose: () => void; onSaved?: (e: Exercise) => void }) {
  const { exercises, sessions, routines, saveExercise, deleteExercise, toast } = useStore();
  const [d, setD] = useState<Draft>(() => toDraft(exercise ?? newCustomExercise("")));
  const [confirmDel, setConfirmDel] = useState(false);
  useEffect(() => { if (open) setD(toDraft(exercise ?? newCustomExercise(""))); }, [open, exercise]);
  const isNew = !exercise;
  const inUse = !isNew && exerciseInUse(d.id, sessions, routines);
  const figures = useMemo(() => exercises.filter((e) => e.figure && e.id !== d.id), [exercises, d.id]);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));
  const weightOf = (g: MuscleGroup) => d.volume.find((v) => v.group === g)?.weight ?? 0;
  const cycle = (g: MuscleGroup) => {
    const w = weightOf(g);
    const next = w === 0 ? 1 : w === 1 ? 0.5 : 0;
    set("volume", next ? [...d.volume.filter((v) => v.group !== g), { group: g, weight: next as 1 | 0.5 }] : d.volume.filter((v) => v.group !== g));
  };

  const save = () => {
    const name = d.name.trim();
    if (!name) return toast({ kind: "error", title: "Name needed", body: "Give the exercise a name." });
    if (exercises.some((e) => e.id !== d.id && e.name.toLowerCase() === name.toLowerCase())) return toast({ kind: "error", title: "Name taken", body: "Another exercise already has this name." });
    const { _setup, _form, _tips, _avoid, _aliases, ...rest } = d;
    const ex = withDerivedMuscles({
      ...rest, name, setup: linesToList(_setup), form: linesToList(_form), tips: linesToList(_tips), avoid: linesToList(_avoid),
      aliases: _aliases.split(",").map((x) => x.trim()).filter(Boolean),
    });
    // Built-in exercises keep their hand-written muscle text; only custom ones derive it.
    const final = ex.isCustom ? ex : { ...ex, muscles: exercise!.muscles, secondaryMuscles: exercise!.secondaryMuscles };
    saveExercise(final);
    toast({ kind: "info", title: isNew ? "Exercise added" : "Exercise saved" });
    onSaved?.(final);
    onClose();
  };

  const area = (k: "_setup" | "_form" | "_tips" | "_avoid", label: string) => (
    <div className="field"><label htmlFor={"ee" + k}>{label} <span style={{ textTransform: "none", letterSpacing: 0 }}>· one per line</span></label>
      <textarea id={"ee" + k} className="input" value={d[k]} onChange={(e) => set(k, e.target.value)} /></div>
  );

  return (
    <Sheet open={open} onClose={onClose} label={isNew ? "New exercise" : "Edit exercise"}>
      <div className="spread" style={{ marginBottom: 10 }}>
        <button className="btn btn-quiet" onClick={onClose} style={{ paddingLeft: 0 }}>Cancel</button>
        <h3 className="title-md" style={{ textTransform: "uppercase" }}>{isNew ? "New exercise" : "Edit exercise"}</h3>
        <button className="btn btn-primary" style={{ minHeight: 40 }} onClick={save}>Save</button>
      </div>
      <div className="stack" style={{ gap: 14 }}>
        <div className="fig-stage" style={{ minHeight: 120 }}>{d.figure ? <Figure key={JSON.stringify(d.figure).length} spec={d.figure} size={120} /> : <span className="muted" style={{ fontSize: 13 }}>No figure</span>}</div>
        <div className="field"><label htmlFor="eename">Name</label><input id="eename" className="input" value={d.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Hack Squat" /></div>

        <div className="field"><span className="label">Figure</span>
          <div className="chips-scroll" style={{ gap: 6 }}>
            <button className="chip" aria-pressed={!d.figure} onClick={() => set("figure", null)} style={{ minHeight: 64 }}>None</button>
            {figures.map((e) => (
              <button key={e.id} title={e.name} aria-label={`Use the ${e.name} figure`} aria-pressed={JSON.stringify(d.figure) === JSON.stringify(e.figure)}
                onClick={() => set("figure", structuredClone(e.figure))}
                style={{ flex: "none", width: 64, height: 64, borderRadius: 14, display: "grid", placeItems: "center", background: "var(--surface-2)",
                  border: `1.5px solid ${JSON.stringify(d.figure) === JSON.stringify(e.figure) ? "var(--neon)" : "var(--line)"}` }}>
                <Figure spec={e.figure} size={46} still className="thin" />
              </button>
            ))}
          </div>
        </div>

        <div className="field"><span className="label">Muscles · tap to cycle: off → direct (1 set) → indirect (½)</span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {MUSCLE_GROUPS.map((m) => {
              const w = weightOf(m.id);
              return (
                <button key={m.id} className="chip" onClick={() => cycle(m.id)} aria-label={`${m.label}: ${w === 1 ? "direct" : w === 0.5 ? "indirect" : "not worked"}`}
                  style={w === 1 ? { background: "var(--neon)", color: "var(--on-neon)", borderColor: "transparent", boxShadow: "0 0 14px -3px var(--glow)" } : w === 0.5 ? { color: "var(--neon)", borderColor: "var(--neon)" } : undefined}>
                  {m.label}{w ? (w === 1 ? " ×1" : " ×½") : ""}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div className="field"><label htmlFor="eeeq">Equipment</label>
            <select id="eeeq" className="input" value={d.equipment} onChange={(e) => { const eq = e.target.value as Equipment; setD((x) => ({ ...x, equipment: eq, loadMode: defaultLoadMode(eq) })); }}>
              {(Object.keys(EQUIPMENT_LABEL) as Equipment[]).map((k) => <option key={k} value={k}>{EQUIPMENT_LABEL[k]}</option>)}
            </select></div>
          <div className="field"><span className="label">Heavy ★</span><div style={{ minHeight: 44, display: "flex", alignItems: "center" }}><Switch label="Heavy lift" checked={d.isHeavy} onChange={(v) => set("isHeavy", v)} /></div></div>
        </div>
        <div className="field"><span className="label">Log weight</span>
          <Seg label="Log weight" value={d.loadMode} onChange={(v: LoadMode) => set("loadMode", v)} options={[{ v: "total", label: "As shown" }, { v: "perSide", label: "Per side" }, { v: "perHand", label: "Per hand" }]} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Stepper label="Weight step" suffix="lb" value={d.incrementLb} step={2.5} min={0.5} onChange={(v) => set("incrementLb", v ?? 5)} />
          <Stepper label="Rest" suffix={fmtRest(d.defaultRestSec)} value={d.defaultRestSec} step={15} decimals={false} onChange={(v) => set("defaultRestSec", v ?? 120)} />
        </div>

        <div className="field"><label htmlFor="eewhy">Why</label><textarea id="eewhy" className="input" value={d.why} onChange={(e) => set("why", e.target.value)} /></div>
        {area("_setup", "Setup")}
        {area("_form", "Form")}
        {area("_tips", "Tips")}
        {area("_avoid", "Avoid")}
        <div className="field"><label htmlFor="eerom">Range</label><input id="eerom" className="input" value={d.rangeOfMotion} onChange={(e) => set("rangeOfMotion", e.target.value)} /></div>
        <div className="field"><label htmlFor="eetempo">Tempo</label><input id="eetempo" className="input" value={d.tempo} onChange={(e) => set("tempo", e.target.value)} /></div>
        <div className="field"><label htmlFor="eeal">Other names (Jefit), comma separated</label><input id="eeal" className="input" value={d._aliases} onChange={(e) => set("_aliases", e.target.value)} /></div>

        <button className="btn btn-primary btn-xl" onClick={save}><Icon name="check" /> Save exercise</button>
        {!isNew && d.isCustom && (
          <button className="btn btn-quiet btn-block" style={{ color: "var(--bad)" }} onClick={() => setConfirmDel(true)}><Icon name="trash" size={18} /> {inUse ? "Hide exercise" : "Delete exercise"}</button>
        )}
      </div>
      <Confirm open={confirmDel} danger confirm={inUse ? "Hide" : "Delete"}
        title={inUse ? "Hide this exercise?" : "Delete this exercise?"}
        body={inUse ? "It's in your history or a plan, so it stays there but no longer shows in the exercise picker." : "It's not used anywhere. This can't be undone."}
        onClose={() => setConfirmDel(false)}
        onConfirm={() => { if (inUse) saveExercise({ ...exercise!, archived: true }); else deleteExercise(d.id); onClose(); }} />
    </Sheet>
  );
}
