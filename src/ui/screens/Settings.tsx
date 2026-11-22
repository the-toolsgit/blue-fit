import { useRef, useState } from "react";
import type { Backup } from "../../core/io/exportFormat";
import { weekOrder } from "../../core/util";
import { ACCENTS, type ProfileDraft } from "../../core/types";
import { Seg, Stepper, Switch } from "../components/Controls";
import { Icon } from "../components/Icon";
import { Confirm, Sheet } from "../components/Sheet";
import { isStandalone } from "../device";
import { fmtRest } from "../format";
import { loadSeed, useStore } from "../store";
import { backupText, daysSince, downloadBackup, REMIND_AFTER_DAYS } from "../backup";

export function SettingsScreen({ onUpdate, onCheck }: { onUpdate?: () => void; onCheck?: () => Promise<boolean> }) {
  const [checking, setChecking] = useState(false);
  const { settings, saveSettings, exportAll, replaceAll, toast, routine, saveRoutine, backup, markBackup } = useStore();
  const since = daysSince(backup.lastAt);
  const [pending, setPending] = useState<Backup | null>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [paste, setPaste] = useState("");
  const [reset, setReset] = useState(false);
  const [applyRest, setApplyRest] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const set = <K extends keyof typeof settings>(k: K, v: (typeof settings)[K]) => saveSettings({ ...settings, [k]: v });
  const prof: ProfileDraft = settings.profile ?? { goal: "growth", phase: "maintaining", age: null, yearsTraining: null, sleepHours: null };
  const setProf = (p: Partial<ProfileDraft>) => set("profile", { ...prof, ...p });

  // The backup format (with its validator) loads only when needed.
  const io = () => import("../../core/io/exportFormat");
  const doExport = async () => {
    await downloadBackup(await exportAll());
    markBackup();
    toast({ kind: "info", title: "Backup exported" });
  };
  const doCopy = async () => {
    try { await navigator.clipboard.writeText(await backupText(await exportAll())); markBackup(); toast({ kind: "info", title: "Backup copied", body: "Paste it into Notes or Files to keep it." }); }
    catch { toast({ kind: "error", title: "Couldn't copy", body: "Use Export instead." }); }
  };
  const check = async (text: string) => {
    const r = (await io()).parseBackup(text);
    if (!r.ok) { toast({ kind: "error", title: "Import refused", body: r.error }); return; }
    setPending(r.backup);
  };

  return (
    <div className="page">
      <span className="eyebrow">Settings</span>
      <h1 className="title-lg" style={{ marginTop: 6 }}>Settings</h1>

      <h2 className="section-title">Training week starts on</h2>
      <div className="glass" style={{ padding: 10, display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4 }} role="group" aria-label="Training week starts on">
        {weekOrder(1).map((d) => (
          <button key={d} className="chip" aria-pressed={settings.weekStartDay === d} style={{ padding: 0, justifyContent: "center", minHeight: 40 }} onClick={() => set("weekStartDay", d)}>
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d]}
          </button>
        ))}
      </div>
      <p className="muted" style={{ fontSize: 12, margin: "6px 4px 0" }}>Only for the numbers: streaks, "this week" and weekly charts. Screens always show Mon–Sun.</p>

      <h2 className="section-title">Training profile</h2>
      <div className="glass" style={{ padding: 14, display: "grid", gap: 12 }}>
        <div><span className="eyebrow" style={{ display: "block", margin: "0 2px 8px" }}>Goal</span>
          <Seg label="Goal" value={prof.goal} onChange={(v) => setProf({ goal: v })} options={[{ v: "growth", label: "Mass" }, { v: "strength", label: "Strength" }, { v: "endurance", label: "Endurance" }, { v: "maintenance", label: "Maintain" }]} /></div>
        <div><span className="eyebrow" style={{ display: "block", margin: "0 2px 8px" }}>Eating</span>
          <Seg label="Eating phase" value={prof.phase} onChange={(v) => setProf({ phase: v })} options={[{ v: "cutting", label: "Cutting" }, { v: "maintaining", label: "Maintaining" }, { v: "bulking", label: "Bulking" }]} /></div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
          <Stepper label="Age" value={prof.age} step={1} decimals={false} min={10} empty={30} onChange={(v) => setProf({ age: v })} />
          <Stepper label="Years lifting" value={prof.yearsTraining} step={0.5} min={0} empty={1} onChange={(v) => setProf({ yearsTraining: v })} />
          <Stepper label="Sleep a night (h)" value={prof.sleepHours} step={0.5} min={0} empty={7} onChange={(v) => setProf({ sleepHours: v })} />
        </div>
        <p className="muted" style={{ fontSize: 12, margin: 0 }}>Used to work out your weekly set targets (tap a muscle on the Plan tab → Reset to default). Stays on this phone.</p>
      </div>

      <h2 className="section-title">Workout</h2>
      <div className="glass" style={{ padding: "4px 14px" }}>
        <div className="setting" style={{ display: "block", paddingTop: 12 }}>
          <Stepper label="Default rest" suffix={fmtRest(settings.restDefaultSec)} value={settings.restDefaultSec} step={15} decimals={false} min={0}
            onChange={(v) => set("restDefaultSec", v ?? 120)} />
          <button className="btn btn-quiet" style={{ marginTop: 2, fontSize: 13, minHeight: 44, padding: 0 }} onClick={() => setApplyRest(true)}>Apply to every exercise in the plan</button>
        </div>
        <div className="setting"><span>Start rest timer when a set is done</span><Switch label="Auto-start rest" checked={settings.autoStartRest} onChange={(v) => set("autoStartRest", v)} /></div>
        <div className="setting"><span>Sound when rest is over</span><Switch label="Sound" checked={settings.sound} onChange={(v) => set("sound", v)} /></div>
        <div className="setting"><span>Keep screen on during a workout</span><Switch label="Keep screen on" checked={settings.keepAwake} onChange={(v) => set("keepAwake", v)} /></div>
      </div>

      <h2 className="section-title">Workout adjustments</h2>
      <div className="glass" style={{ padding: "4px 14px" }}>
        <div className="setting"><span>Auto-adjust workouts<span className="muted" style={{ display: "block", fontSize: 12 }}>Extra set for skipped work, failure sets</span></span>
          <Switch label="Auto-adjust workouts" checked={settings.autoAdjust !== false} onChange={(v) => set("autoAdjust", v)} /></div>
      </div>

      <h2 className="section-title">Reminders & tips</h2>
      <div className="glass" style={{ padding: "4px 14px" }}>
        <div className="setting"><span>Deload suggestions<span className="muted" style={{ display: "block", fontSize: 12 }}>Card on Today when it's time for a lighter week</span></span>
          <Switch label="Deload suggestions" checked={settings.deloadSuggestions} onChange={(v) => set("deloadSuggestions", v)} /></div>
        <div className="setting"><span>Inline workout tips<span className="muted" style={{ display: "block", fontSize: 12 }}>Weight and effort tips on each exercise</span></span>
          <Switch label="Inline workout tips" checked={settings.progressionHints} onChange={(v) => set("progressionHints", v)} /></div>
      </div>

      <h2 className="section-title">Look</h2>
      <div className="glass" style={{ padding: 14 }}>
        <Seg label="Theme" value={settings.theme} onChange={(v) => set("theme", v)} options={[{ v: "system", label: "System" }, { v: "dark", label: "Dark" }, { v: "light", label: "Light" }]} />
        <span className="eyebrow" style={{ display: "block", margin: "16px 2px 10px" }}>Accent</span>
        <div className="swatches" role="radiogroup" aria-label="Accent color">
          {ACCENTS.map((a) => (
            <button key={a} role="radio" aria-checked={settings.accent === a} className="swatch" data-a={a} onClick={() => set("accent", a)}>
              <i aria-hidden="true" /><span>{a[0].toUpperCase() + a.slice(1)}</span>
            </button>
          ))}
        </div>
      </div>

      <h2 className="section-title">Data</h2>
      <div className="glass" style={{ padding: 14 }} >
        <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>Everything is stored on this phone only. Last backup: <b style={{ color: since == null || since >= REMIND_AFTER_DAYS ? "var(--warn)" : "var(--ink)" }}>{since == null ? "never" : since === 0 ? "today" : since === 1 ? "yesterday" : `${since} days ago`}</b>.</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <button className="btn btn-primary" onClick={doExport}><Icon name="download" size={18} /> Export</button>
          <button className="btn btn-ghost" onClick={doCopy}><Icon name="copy" size={18} /> Copy JSON</button>
          <button className="btn btn-ghost" onClick={() => file.current?.click()}><Icon name="upload" size={18} /> Import file</button>
          <button className="btn btn-ghost" onClick={() => setPasteOpen(true)}><Icon name="note" size={18} /> Paste JSON</button>
        </div>
        <input ref={file} type="file" accept="application/json,.json" hidden onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) check(await f.text()); }} />
        <button className="btn btn-danger btn-block" style={{ marginTop: 14 }} onClick={() => setReset(true)}><Icon name="trash" size={18} /> Reset everything</button>
      </div>

      <h2 className="section-title">App</h2>
      <div className="glass" style={{ padding: 14, display: "grid", gap: 10, fontSize: 14 }}>
        {onUpdate
          ? <button className="btn btn-primary btn-block" onClick={onUpdate}>Update app</button>
          : <button className="btn btn-ghost btn-block" disabled={checking} onClick={async () => {
              setChecking(true);
              try { const found = await onCheck?.(); toast(found ? { kind: "info", title: "Update found", body: "Downloading. Tap Update app when it appears." } : { kind: "info", title: "You're up to date" }); }
              catch { toast({ kind: "error", title: "Couldn't check", body: "Check your connection." }); }
              setChecking(false);
            }}>{checking ? "Checking…" : "Check for updates"}</button>}
        {!isStandalone() && <p className="muted"><b style={{ color: "var(--ink)" }}>Install:</b> in Safari tap Share → Add to Home Screen. It then opens full screen and works offline.</p>}
        <p className="muted">Blue Fit · version {__APP_VERSION__}</p>
      </div>

      <Sheet open={pasteOpen} onClose={() => setPasteOpen(false)} label="Paste backup JSON">
        <div className="stack">
          <h3 className="title-md">Paste backup JSON</h3>
          <textarea className="input" style={{ minHeight: 180, fontFamily: "var(--mono)", fontSize: 12 }} value={paste} onChange={(e) => setPaste(e.target.value)} placeholder='{"app":"blue-fit", …}' />
          <button className="btn btn-primary btn-block" disabled={!paste.trim()} onClick={() => { setPasteOpen(false); check(paste); setPaste(""); }}>Check backup</button>
        </div>
      </Sheet>
      <Confirm open={!!pending} title="Replace all data with this backup?"
        body={pending && <>Backup from {new Date(pending.exportedAt).toLocaleString()}: {pending.data.sessions.length} workouts, {pending.data.exercises.length} exercises, {pending.data.routines.length} routine(s). Everything on this phone is replaced.</>}
        confirm="Replace" danger onClose={() => setPending(null)}
        onConfirm={async () => { if (!pending) return; try { await replaceAll(pending.data); toast({ kind: "info", title: "Backup imported" }); } catch (e) { console.error(e); toast({ kind: "error", title: "Import failed", body: "Nothing was changed. Try again." }); } }} />
      <Confirm open={reset} title="Reset everything?" body="Deletes all workouts, edits and settings, and reloads the original plan. Export a backup first. This can't be undone." confirm="Reset" danger
        onClose={() => setReset(false)} onConfirm={async () => { try { await replaceAll(await loadSeed()); toast({ kind: "info", title: "Reset done" }); } catch (e) { console.error(e); toast({ kind: "error", title: "Reset failed", body: "Nothing was changed. Try again." }); } }} />
      <Confirm open={applyRest} title={`Set rest to ${fmtRest(settings.restDefaultSec)} everywhere?`} body={`Every exercise in ${routine?.name ?? "the plan"} gets this rest time.`} confirm="Apply"
        onClose={() => setApplyRest(false)} onConfirm={() => routine && saveRoutine({ ...routine, days: routine.days.map((d) => ({ ...d, slots: d.slots.map((s) => ({ ...s, restSec: settings.restDefaultSec })) })) })} />
    </div>
  );
}
