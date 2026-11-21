// Exercise picker: search + Muscle and Equipment filters (each opens a sheet with checkbox rows, multi-select). Used for swap and add (and the plan editor later).
import { useMemo, useState } from "react";
import { EQUIPMENT_LABEL, MUSCLE_GROUPS, muscleLabel, type Equipment, type Exercise, type MuscleGroup } from "../../core/types";
import { useStore } from "../store";
import { isTopPick } from "../../core/catalog";
import { Figure } from "./Figure";
import { MuscleMap } from "./MuscleMap";
import { Seg } from "./Controls";
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
  const [groups, setGroups] = useState<MuscleGroup[]>([]);
  const [eqs, setEqs] = useState<Equipment[]>([]);
  const [tab, setTab] = useState<"muscle" | "equipment" | null>(null);
  // Equipment present in the list, each with one exercise's figure as its picture
  const equipments = useMemo(() => {
    const m = new Map<Equipment, Exercise>();
    for (const e of exercises) if (!e.archived && !m.has(e.equipment)) m.set(e.equipment, e);
    return [...m].sort((a, b) => EQUIPMENT_LABEL[a[0]].localeCompare(EQUIPMENT_LABEL[b[0]]));
  }, [exercises]);
  // A top pick belongs to the muscle it trains fully: with a muscle filter on, only that muscle's top picks count (and show the tag)
  const top = (e: Exercise) => isTopPick(e, goal) && (!groups.length || e.volume.some((v) => v.weight === 1 && groups.includes(v.group)));
  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    return exercises
      .filter((e) => !e.archived && e.id !== exclude)
      .filter((e) => !groups.length || e.volume.some((v) => groups.includes(v.group)))
      .filter((e) => !eqs.length || eqs.includes(e.equipment))
      .filter((e) => !term || [e.name, ...e.aliases, ...e.muscles, ...e.secondaryMuscles].join(" ").toLowerCase().includes(term))
      .sort((a, b) => {
        // with a muscle chosen: its top picks for the training goal first, then direct work for it; no muscle: A–Z
        if (groups.length) {
          const ta = top(a), tb = top(b);
          if (ta !== tb) return ta ? -1 : 1;
          const w = (e: Exercise) => Math.max(...e.volume.filter((v) => groups.includes(v.group)).map((v) => v.weight)); const da = w(a), db = w(b); if (da !== db) return db - da;
        }
        return a.name.localeCompare(b.name);
      });
  }, [exercises, q, groups, eqs, exclude, goal]);

  return (
    <Sheet open={open} onClose={onClose} label={title} tall>
      <div className="spread" style={{ marginBottom: 10 }}>
        <h3 className="title-md">{title}</h3>
      </div>
      <button className="btn btn-ghost btn-block" style={{ marginBottom: 10 }} onClick={() => setCreating(true)}><Icon name="plus" size={18} /> New exercise</button>
      <div style={{ position: "relative" }}>
        <span style={{ position: "absolute", left: 12, top: 11, color: "var(--muted)" }}><Icon name="search" size={20} /></span>
        <input className="input" style={{ paddingLeft: 40 }} type="search" placeholder="Search name, alias or muscle" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search exercises" />
      </div>
      <div className="row" style={{ gap: 8, marginTop: 10 }}>
        <button className="filter-btn" aria-pressed={groups.length > 0} onClick={() => setTab("muscle")}>{pickedLabel(groups.map(muscleLabel), "Muscle", "muscles")} <Icon name="chevron" size={14} /></button>
        <button className="filter-btn" aria-pressed={eqs.length > 0} onClick={() => setTab("equipment")}>{pickedLabel(eqs.map((x) => EQUIPMENT_LABEL[x]), "Equipment", "types")} <Icon name="chevron" size={14} /></button>
      </div>
      <div className="muted" style={{ fontSize: 13, margin: "10px 2px 0" }}><b style={{ color: "var(--ink)" }}>{groups.length || eqs.length ? "Filtered" : "All exercises"}</b> · {list.length} found</div>
      <div style={{ marginTop: 6 }}>
        {(more ? list : list.slice(0, 60)).map((e) => (
          <button key={e.id} className="list-row" onClick={() => { ensureSaved(e); onPick(e); onClose(); }}>
            <Figure spec={e.figure} size={40} still className="thin" />
            <span className="grow">
              <span style={{ display: "block", fontWeight: 600 }}>{e.name} {e.isHeavy && <span className="star">★</span>}{top(e) && <span className="badge p" style={{ marginLeft: 6, verticalAlign: 2 }}>Top pick</span>}</span>
              <span className="muted" style={{ fontSize: 13 }}>{e.muscles.join(", ")} · {EQUIPMENT_LABEL[e.equipment]}</span>
            </span>
            <Icon name="plus" size={20} />
          </button>
        ))}
        {!more && list.length > 60 && <button className="btn btn-ghost btn-block" style={{ marginTop: 8 }} onClick={() => setMore(true)}>Show all {list.length}</button>}
        {!list.length && <div className="empty">No exercise matches. Tap "New exercise" to add your own.</div>}
      </div>
      <Sheet open={tab !== null} onClose={() => setTab(null)} label="Filter exercises" tall>
        <Seg label="Filter by" value={tab ?? "muscle"} onChange={setTab} options={[{ v: "muscle", label: "Muscle" }, { v: "equipment", label: "Equipment" }]} />
        <div style={{ marginTop: 10 }}>
          {tab === "equipment" ? (
            <>
              <FilterRow on={!eqs.length} label="All equipment" pic={<Icon name="check" size={22} />} onClick={() => setEqs([])} />
              {equipments.map(([x, e]) => <FilterRow key={x} on={eqs.includes(x)} label={EQUIPMENT_LABEL[x]} pic={<Figure spec={e.figure} size={44} still className="thin" />} onClick={() => setEqs(toggle(eqs, x))} />)}
            </>
          ) : (
            <>
              <FilterRow on={!groups.length} label="All muscles" pic={<MuscleMap intensity={Object.fromEntries(MUSCLE_GROUPS.map((m) => [m.id, 0.6]))} />} map onClick={() => setGroups([])} />
              {MUSCLE_GROUPS.map((m) => <FilterRow key={m.id} on={groups.includes(m.id)} label={m.label} pic={<MuscleMap intensity={{ [m.id]: 1 }} />} map onClick={() => setGroups(toggle(groups, m.id))} />)}
            </>
          )}
        </div>
        <button className="btn btn-primary btn-block" style={{ position: "sticky", bottom: 0, marginTop: 12 }} onClick={() => setTab(null)}>Show {list.length} exercises</button>
      </Sheet>
      <ExerciseEditor open={creating} onClose={() => setCreating(false)} onSaved={(e) => { onPick(e); onClose(); }} />
    </Sheet>
  );
}

const toggle = <T,>(xs: T[], x: T) => (xs.includes(x) ? xs.filter((y) => y !== x) : [...xs, x]);
const pickedLabel = (names: string[], none: string, many: string) => (names.length === 0 ? none : names.length === 1 ? names[0] : `${names.length} ${many}`);

function FilterRow({ on, label, pic, onClick, map }: { on: boolean; label: string; pic: React.ReactNode; onClick: () => void; map?: boolean }) {
  return (
    <button className={"list-row filter-row" + (on ? " on" : "")} aria-pressed={on} onClick={onClick}>
      <span className={"filter-pic" + (map ? " map" : "")}>{pic}</span>
      <span className="grow" style={{ fontWeight: 600 }}>{label}</span>
      <span className="filter-box">{on && <Icon name="check" size={18} />}</span>
    </button>
  );
}
