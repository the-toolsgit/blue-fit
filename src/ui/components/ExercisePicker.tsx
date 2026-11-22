// Exercise picker: search + Muscle and Equipment filters (each opens a sheet with checkbox rows, multi-select). Used for swap and add.
// Tap a row's line man for the exercise's how-to. Swap: one tap picks and closes. Add (onPickMany): tap rows to tick several, then "Add N exercises" adds them in tap order.
import { useEffect, useMemo, useState } from "react";
import { EQUIPMENT_LABEL, MUSCLE_GROUPS, muscleLabel, type Equipment, type Exercise, type MuscleGroup } from "../../core/types";
import { useStore } from "../store";
import { isTopPick } from "../../core/catalog";
import { Figure } from "./Figure";
import { EquipmentIcon, MuscleIcon } from "./FilterIcons";
import { Seg } from "./Controls";
import { Icon } from "./Icon";
import { Sheet } from "./Sheet";
import { ExerciseEditor } from "./ExerciseEditor";
import { FigureTap } from "./swipeDelete";
import { ExerciseSheet } from "../screens/ExerciseScreen";

export function ExercisePicker({ open, title, onClose, onPick, onPickMany, exclude }: {
  open: boolean; title: string; onClose: () => void; onPick?: (e: Exercise) => void;
  /** Add mode: pick several before closing; called once with them in tap order */
  onPickMany?: (es: Exercise[]) => void; exclude?: string;
}) {
  const [creating, setCreating] = useState(false);
  const [howTo, setHowTo] = useState<string | null>(null);
  const [picked, setPicked] = useState<Exercise[]>([]);
  useEffect(() => { if (open) setPicked([]); }, [open]);
  const isOn = (e: Exercise) => picked.some((x) => x.id === e.id);
  const tap = (e: Exercise) => {
    if (onPickMany) return setPicked(isOn(e) ? picked.filter((x) => x.id !== e.id) : [...picked, e]);
    ensureSaved(e); onPick?.(e); onClose();
  };
  const addPicked = () => { picked.forEach(ensureSaved); onPickMany?.(picked); onClose(); };
  const { exercises, settings, ensureSaved } = useStore();
  const goal = settings.profile?.goal;
  // ~430 exercises: draw the first 60, more on request (search and filters narrow it first)
  const [more, setMore] = useState(false);
  const [q, setQ] = useState("");
  const [groups, setGroups] = useState<MuscleGroup[]>([]);
  const [eqs, setEqs] = useState<Equipment[]>([]);
  const [tab, setTab] = useState<"muscle" | "equipment" | null>(null);
  // Equipment present in the list; bodyweight shows a pull-up line man, the rest a drawn icon
  const equipments = useMemo(() => {
    const m = new Map<Equipment, Exercise>();
    for (const e of exercises) if (!e.archived && (!m.has(e.equipment) || /^pull-?up$/i.test(e.name))) m.set(e.equipment, e);
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
      {/* Compact header: title + New on one line, then search, then filters with the count */}
      <div className="spread" style={{ marginBottom: 8 }}>
        <h3 className="title-md">{title}</h3>
        <button className="new-btn" onClick={() => setCreating(true)} aria-label="New exercise"><Icon name="plus" size={15} /> New</button>
      </div>
      <div style={{ position: "relative" }}>
        <span style={{ position: "absolute", left: 12, top: 11, color: "var(--muted)" }}><Icon name="search" size={20} /></span>
        <input className="input" style={{ paddingLeft: 40 }} type="search" placeholder="Search name, alias or muscle" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search exercises" />
      </div>
      <div className="row" style={{ gap: 6, marginTop: 8, flexWrap: "wrap" }}>
        <button className="filter-btn" aria-pressed={groups.length > 0} onClick={() => setTab("muscle")}>Muscle <Icon name="chevron" size={14} /></button>
        <button className="filter-btn" aria-pressed={eqs.length > 0} onClick={() => setTab("equipment")}>Equipment <Icon name="chevron" size={14} /></button>
        {/* Each picked filter, with an X to remove it in one tap */}
        {groups.map((g) => <button key={g} className="filter-on" onClick={() => setGroups(groups.filter((x) => x !== g))} aria-label={`Remove ${muscleLabel(g)} filter`}>{muscleLabel(g)} <Icon name="close" size={12} /></button>)}
        {eqs.map((x) => <button key={x} className="filter-on" onClick={() => setEqs(eqs.filter((y) => y !== x))} aria-label={`Remove ${EQUIPMENT_LABEL[x]} filter`}>{EQUIPMENT_LABEL[x]} <Icon name="close" size={12} /></button>)}
        <span className="muted mono" style={{ marginLeft: "auto", fontSize: 12 }}>{list.length} found</span>
      </div>
      <div style={{ marginTop: 6 }}>
        {(more ? list : list.slice(0, 60)).map((e) => (
          <button key={e.id} className={"list-row" + (onPickMany ? " filter-row" + (isOn(e) ? " on" : "") : "")} aria-pressed={onPickMany ? isOn(e) : undefined} onClick={() => tap(e)}>
            <FigureTap name={e.name} onTap={() => setHowTo(e.id)}><Figure spec={e.figure} size={40} still className="thin" /></FigureTap>
            <span className="grow">
              <span style={{ display: "block", fontWeight: 600 }}>{e.name} {e.isHeavy && <span className="star">★</span>}{top(e) && <span className="badge p" style={{ marginLeft: 6, verticalAlign: 2 }}>Top pick</span>}</span>
              <span className="muted" style={{ fontSize: 13 }}>{e.muscles.join(", ")} · {EQUIPMENT_LABEL[e.equipment]}</span>
            </span>
            {onPickMany ? <span className="filter-box">{isOn(e) && <Icon name="check" size={18} />}</span> : <Icon name="plus" size={20} />}
          </button>
        ))}
        {!more && list.length > 60 && <button className="btn btn-ghost btn-block" style={{ marginTop: 8 }} onClick={() => setMore(true)}>Show all {list.length}</button>}
        {!list.length && <div className="empty">No exercise matches. Tap "New exercise" to add your own.</div>}
      </div>
      {onPickMany && picked.length > 0 && <button className="btn btn-primary btn-block picker-add" onClick={addPicked}><Icon name="plus" size={18} /> Add {picked.length} exercise{picked.length === 1 ? "" : "s"}</button>}
      <Sheet open={tab !== null} onClose={() => setTab(null)} label="Filter exercises" tall>
        <Seg label="Filter by" value={tab ?? "muscle"} onChange={setTab} options={[{ v: "muscle", label: "Muscle" }, { v: "equipment", label: "Equipment" }]} />
        <div style={{ marginTop: 10 }}>
          {tab === "equipment" ? (
            <>
              <FilterRow on={!eqs.length} label="All equipment" pic={<span className="pic-grid">{(["barbell", "dumbbell", "cable", "machine"] as const).map((x) => <EquipmentIcon key={x} eq={x} size={19} />)}</span>} onClick={() => setEqs([])} />
              {equipments.map(([x, e]) => <FilterRow key={x} on={eqs.includes(x)} label={EQUIPMENT_LABEL[x]} pic={x === "bodyweight" ? <Figure spec={e.figure} size={44} still className="thin" /> : <EquipmentIcon eq={x} />} onClick={() => setEqs(toggle(eqs, x))} />)}
            </>
          ) : (
            <>
              <FilterRow on={!groups.length} label="All muscles" pic={<MuscleIcon group={null} />} onClick={() => setGroups([])} />
              {MUSCLE_GROUPS.map((m) => <FilterRow key={m.id} on={groups.includes(m.id)} label={m.label} pic={<MuscleIcon group={m.id} />} onClick={() => setGroups(toggle(groups, m.id))} />)}
            </>
          )}
        </div>
        <button className="btn btn-primary btn-block" style={{ position: "sticky", bottom: 0, marginTop: 12 }} onClick={() => setTab(null)}>Show {list.length} exercises</button>
      </Sheet>
      <ExerciseSheet id={howTo} onClose={() => setHowTo(null)} />
      <ExerciseEditor open={creating} onClose={() => setCreating(false)} onSaved={(e) => (onPickMany ? setPicked((ps) => [...ps, e]) : (onPick?.(e), onClose()))} />
    </Sheet>
  );
}

const toggle = <T,>(xs: T[], x: T) => (xs.includes(x) ? xs.filter((y) => y !== x) : [...xs, x]);

function FilterRow({ on, label, pic, onClick }: { on: boolean; label: string; pic: React.ReactNode; onClick: () => void }) {
  return (
    <button className={"list-row filter-row" + (on ? " on" : "")} aria-pressed={on} onClick={onClick}>
      <span className="filter-pic">{pic}</span>
      <span className="grow" style={{ fontWeight: 600 }}>{label}</span>
      <span className="filter-box">{on && <Icon name="check" size={18} />}</span>
    </button>
  );
}
