// Exercise picker: search + filters by muscle group and equipment. Used for swap and add (and the plan editor later).
import { useMemo, useState } from "react";
import { EQUIPMENT_LABEL, MUSCLE_GROUPS, type Equipment, type Exercise, type MuscleGroup } from "../../core/types";
import { useStore } from "../store";
import { isTopPick } from "../../core/catalog";
import { Figure } from "./Figure";
import { Icon } from "./Icon";
import { Sheet } from "./Sheet";
import { ExerciseEditor } from "./ExerciseEditor";

export function ExercisePicker({ open, title, onClose, onPick, exclude }: { open: boolean; title: string; onClose: () => void; onPick: (e: Exercise) => void; exclude?: string }) {
  const [creating, setCreating] = useState(false);
  const { exercises, settings, ensureSaved } = useStore();
  const goal = settings.profile?.goal;
  // ~430 exercises: draw the first 60, more on request (search and filters narrow it first)
  const [more, setMore] = useState(false);
  const [q, setQ] = useState("");
  const [group, setGroup] = useState<MuscleGroup | null>(null);
  const [eq, setEq] = useState<Equipment | null>(null);
  const equipments = useMemo(() => [...new Set(exercises.map((e) => e.equipment))], [exercises]);
  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    return exercises
      .filter((e) => !e.archived && e.id !== exclude)
      .filter((e) => !group || e.volume.some((v) => v.group === group))
      .filter((e) => !eq || e.equipment === eq)
      .filter((e) => !term || [e.name, ...e.aliases, ...e.muscles, ...e.secondaryMuscles].join(" ").toLowerCase().includes(term))
      .sort((a, b) => {
        // direct work for the chosen group first
        if (group) { const da = a.volume.find((v) => v.group === group)!.weight, db = b.volume.find((v) => v.group === group)!.weight; if (da !== db) return db - da; }
        // top picks for the training goal next
        const ta = isTopPick(a, goal), tb = isTopPick(b, goal);
        if (ta !== tb) return ta ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
  }, [exercises, q, group, eq, exclude, goal]);

  return (
    <Sheet open={open} onClose={onClose} label={title}>
      <div className="spread" style={{ marginBottom: 10 }}>
        <h3 className="title-md">{title}</h3>
      </div>
      <button className="btn btn-ghost btn-block" style={{ marginBottom: 10 }} onClick={() => setCreating(true)}><Icon name="plus" size={18} /> New exercise</button>
      <div style={{ position: "relative" }}>
        <span style={{ position: "absolute", left: 12, top: 11, color: "var(--muted)" }}><Icon name="search" size={20} /></span>
        <input className="input" style={{ paddingLeft: 40 }} type="search" placeholder="Search name, alias or muscle" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search exercises" />
      </div>
      <div className="chips-scroll" style={{ marginTop: 10 }}>
        {MUSCLE_GROUPS.map((m) => <button key={m.id} className="chip" aria-pressed={group === m.id} onClick={() => setGroup(group === m.id ? null : m.id)}>{m.label}</button>)}
      </div>
      <div className="chips-scroll">
        {equipments.map((x) => <button key={x} className="chip" aria-pressed={eq === x} onClick={() => setEq(eq === x ? null : x)}>{EQUIPMENT_LABEL[x]}</button>)}
      </div>
      <div style={{ marginTop: 6 }}>
        {(more ? list : list.slice(0, 60)).map((e) => (
          <button key={e.id} className="list-row" onClick={() => { ensureSaved(e); onPick(e); onClose(); }}>
            <Figure spec={e.figure} size={40} still className="thin" />
            <span className="grow">
              <span style={{ display: "block", fontWeight: 600 }}>{e.name} {e.isHeavy && <span className="star">★</span>}{isTopPick(e, goal) && <span className="badge p" style={{ marginLeft: 6, verticalAlign: 2 }}>Top pick</span>}</span>
              <span className="muted" style={{ fontSize: 13 }}>{e.muscles.join(", ")} · {EQUIPMENT_LABEL[e.equipment]}</span>
            </span>
            <Icon name="plus" size={20} />
          </button>
        ))}
        {!more && list.length > 60 && <button className="btn btn-ghost btn-block" style={{ marginTop: 8 }} onClick={() => setMore(true)}>Show all {list.length}</button>}
        {!list.length && <div className="empty">No exercise matches. Tap "New exercise" to add your own.</div>}
      </div>
      <ExerciseEditor open={creating} onClose={() => setCreating(false)} onSaved={(e) => { onPick(e); onClose(); }} />
    </Sheet>
  );
}
