// App state: an in-memory snapshot of storage, updated optimistically and written through
// after every change (writes are queued so they land in order).
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { applyMigrations, IMPORT_SKIP } from "../core/migrations";
import { localDate } from "../core/util";
import type { StorageAdapter, TableName, Tables } from "../core/storage/StorageAdapter";
import { DEFAULT_SETTINGS, type AppData, type Exercise, type RestTimer, type Routine, type Session, type Settings, type VolumeTarget } from "../core/types";
import { IdbAdapter } from "../storage/idbAdapter";
import { mergeCatalog } from "../core/catalog";
import { targetsOf } from "../core/volumeModel";
import type { BodyScan } from "../core/body/types";

export type Toast = { id: number; kind: "info" | "pr" | "error" | "warn"; title: string; body?: string; leaving?: boolean;
  /** A button on the toast (e.g. Undo); tapping it runs `run` and closes the toast */
  action?: { label: string; run: () => void } };
/** How long a toast takes to slide back up before it is removed (matches .toast.out in app.css). */
const TOAST_OUT_MS = 240;

interface Store extends AppData {
  ready: boolean;
  /** Phone exercises + the exercise database (see core/catalog.ts); exMap also opens old ids */
  exMap: Map<string, Exercise>;
  /** Only the exercises saved on this phone (name checks, figure list) */
  phoneExercises: Exercise[];
  /** Saves a database exercise on the phone the first time it is picked (backups stay complete) */
  ensureSaved(e: Exercise): void;
  routine: Routine | undefined;
  active: Session | undefined;
  finished: Session[];
  restTimer: RestTimer | null;
  saveSession(s: Session): void;
  deleteSession(id: string): void;
  saveBodyScan(b: BodyScan): void;
  deleteBodyScan(id: string): void;
  saveSettings(s: Settings): void;
  saveExercise(e: Exercise): void;
  saveRoutine(r: Routine): void;
  saveRoutines(rs: Routine[]): void;
  saveTargets(ts: VolumeTarget[]): void;
  deleteRoutine(id: string): void;
  deleteExercise(id: string): void;
  setRestTimer(t: RestTimer | null): void;
  replaceAll(d: AppData): Promise<void>;
  exportAll(): Promise<AppData>;
  toast(t: Omit<Toast, "id">): void;
  toasts: Toast[];
  /** ISO time of the last export/copy, and until when the reminder is snoozed */
  backup: { lastAt: string | null; snoozedUntil: string | null };
  markBackup(): void;
  snoozeBackup(days: number): void;
  dismissToast(id: number): void;
}

const Ctx = createContext<Store | null>(null);
export const useStore = () => {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore outside provider");
  return s;
};

const adapter: StorageAdapter = new IdbAdapter();
const EMPTY: AppData = { exercises: [], routines: [], sessions: [], targets: [], jefitAliases: [], bodyScans: [], settings: DEFAULT_SETTINGS };
// The seed (plan + exercise library) is only needed on first launch and reset, so it loads on demand.
export const loadSeed = async () => (await import("../core/seed")).buildSeed();
// The exercise database (built-in, ~425 exercises) loads with storage; built once.
const loadCatalog = async () => (await import("../core/seed/exercise-db")).catalog();

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(EMPTY);
  const [db, setDb] = useState<Exercise[]>([]);
  const [ready, setReady] = useState(false);
  const [restTimer, setTimerState] = useState<RestTimer | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [backup, setBackup] = useState<{ lastAt: string | null; snoozedUntil: string | null }>({ lastAt: null, snoozedUntil: null });
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const toastId = useRef(0);

  const toast = useCallback((t: Omit<Toast, "id">) => {
    const id = ++toastId.current;
    setToasts((x) => [...x.slice(-2), { ...t, id }]);
    setTimeout(() => dismiss(id), t.action ? 5000 : t.kind === "warn" ? 7000 : t.kind === "pr" ? 4200 : 3200);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Slide up, then remove
  const dismiss = (id: number) => {
    setToasts((x) => x.map((y) => (y.id === id ? { ...y, leaving: true } : y)));
    setTimeout(() => setToasts((x) => x.filter((y) => y.id !== id)), TOAST_OUT_MS);
  };
  const dismissToast = useCallback((id: number) => dismiss(id), []);

  const write = useCallback((f: () => Promise<unknown>) => {
    queue.current = queue.current.then(f).catch((e) => {
      console.error(e);
      toast({ kind: "error", title: "Couldn't save", body: "Your last change may not be stored. Export a backup from Settings." });
    });
  }, [toast]);

  useEffect(() => {
    (async () => {
      const dbP = loadCatalog().catch((e) => { console.error(e); return [] as Exercise[]; });
      await adapter.init(loadSeed);
      let d = await adapter.exportAll();
      // One-time migrations (each runs once; ids remembered in meta)
      const m = applyMigrations(d, localDate(new Date()), (await adapter.getMeta<string[]>("migrations")) ?? []);
      if (m.changed) { await adapter.replaceAll(m.data); d = await adapter.exportAll(); }
      await adapter.setMeta("migrations", m.done);
      const t = await adapter.getMeta<RestTimer>("restTimer");
      setBackup({ lastAt: (await adapter.getMeta<string>("lastBackupAt")) ?? null, snoozedUntil: (await adapter.getMeta<string>("backupSnoozedUntil")) ?? null });
      setDb(await dbP);
      setData(d);
      if (t && t.endsAt > Date.now() - 60_000) setTimerState(t);
      setReady(true);
    })().catch((e) => {
      console.error(e);
      toast({ kind: "error", title: "Storage unavailable", body: "This browser blocked local storage. Private mode can cause this." });
    });
  }, [toast]);

  const putRow = useCallback(<T extends TableName>(table: T, row: Tables[T], key: keyof Tables[T]) => {
    setData((d) => {
      const list = d[table] as unknown as Tables[T][];
      const i = list.findIndex((x) => x[key] === row[key]);
      const next = i >= 0 ? list.map((x, k) => (k === i ? row : x)) : [...list, row];
      return { ...d, [table]: next };
    });
    write(() => adapter.put(table, row));
  }, [write]);

  const cat = useMemo(() => mergeCatalog(data.exercises, db), [data.exercises, db]);
  // Speed (Nov 22 2026): workouts sorted once per change to them, so a toast, the rest timer or a settings change
  // doesn't hand every screen new `finished` / `active` lists (which re-ran their memoized work)
  const sessionsView = useMemo(() => {
    const sorted = [...data.sessions].sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1));
    return { active: sorted.find((s) => s.status === "active"), finished: sorted.filter((s) => s.status === "finished") };
  }, [data.sessions]);
  const planView = useMemo(() => {
    const current = data.routines.find((r) => r.isCurrent) ?? data.routines[0];
    return { current, targets: targetsOf(current, data.targets) };
  }, [data.routines, data.targets]);
  const store = useMemo<Store>(() => {
    const { exMap } = cat;
    const { current } = planView;
    return {
      ...data,
      exercises: cat.exercises,
      phoneExercises: data.exercises,
      ensureSaved: (e) => { if (!cat.phoneIds.has(e.id)) putRow("exercises", e, "id"); },
      ready,
      exMap,
      routine: current,
      // Weekly targets belong to the current plan (app-wide list only as a fallback for plans from older versions)
      targets: planView.targets,
      active: sessionsView.active,
      finished: sessionsView.finished,
      restTimer,
      toasts,
      toast,
      backup,
      markBackup: () => { const at = new Date().toISOString(); setBackup((b) => ({ ...b, lastAt: at })); write(() => adapter.setMeta("lastBackupAt", at)); },
      snoozeBackup: (days) => { const until = new Date(Date.now() + days * 86_400_000).toISOString(); setBackup((b) => ({ ...b, snoozedUntil: until })); write(() => adapter.setMeta("backupSnoozedUntil", until)); },
      dismissToast,
      saveSession: (s) => putRow("sessions", s, "id"),
      saveExercise: (e) => putRow("exercises", e, "id"),
      saveRoutine: (r) => putRow("routines", r, "id"),
      saveRoutines: (rs) => rs.forEach((r) => putRow("routines", r, "id")),
      // Changed targets go into the current plan (merged by muscle)
      saveTargets: (ts) => {
        if (!current) return;
        const base = targetsOf(current, data.targets);
        const next = [...base.map((t) => ts.find((x) => x.group === t.group) ?? t), ...ts.filter((x) => !base.some((t) => t.group === x.group))];
        putRow("routines", { ...current, targets: next }, "id");
      },
      deleteRoutine: (id) => {
        setData((d) => ({ ...d, routines: d.routines.filter((r) => r.id !== id) }));
        write(() => adapter.remove("routines", id));
      },
      deleteExercise: (id) => {
        setData((d) => ({ ...d, exercises: d.exercises.filter((e) => e.id !== id) }));
        write(() => adapter.remove("exercises", id));
      },
      deleteSession: (id) => {
        setData((d) => ({ ...d, sessions: d.sessions.filter((s) => s.id !== id) }));
        write(() => adapter.remove("sessions", id));
      },
      saveBodyScan: (b) => putRow("bodyScans", b, "id"),
      deleteBodyScan: (id) => {
        setData((d) => ({ ...d, bodyScans: d.bodyScans.filter((b) => b.id !== id) }));
        write(() => adapter.remove("bodyScans", id));
      },
      saveSettings: (s) => {
        setData((d) => ({ ...d, settings: s }));
        write(() => adapter.saveSettings(s));
      },
      setRestTimer: (t) => {
        setTimerState(t);
        write(() => adapter.setMeta("restTimer", t ?? undefined));
      },
      replaceAll: async (d) => {
        await queue.current;
        // A backup from an older version (or the raw seed on reset) gets every migration, like a first launch
        const m = applyMigrations(d, localDate(new Date()), IMPORT_SKIP);
        await adapter.replaceAll(m.data);
        await adapter.setMeta("migrations", m.done);
        setData(await adapter.exportAll());
        setTimerState(null);
      },
      exportAll: async () => {
        await queue.current;
        return adapter.exportAll();
      },
    };
  }, [data, cat, sessionsView, planView, ready, restTimer, toasts, toast, dismissToast, putRow, write, backup]);

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}
