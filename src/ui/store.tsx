// App state: an in-memory snapshot of storage, updated optimistically and written through
// after every change (writes are queued so they land in order).
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { MIGRATIONS } from "../core/migrations";
import { localDate } from "../core/util";
import type { StorageAdapter, TableName, Tables } from "../core/storage/StorageAdapter";
import { DEFAULT_SETTINGS, type AppData, type Exercise, type RestTimer, type Routine, type Session, type Settings } from "../core/types";
import { IdbAdapter } from "../storage/idbAdapter";

export type Toast = { id: number; kind: "info" | "pr" | "error"; title: string; body?: string };

interface Store extends AppData {
  ready: boolean;
  exMap: Map<string, Exercise>;
  routine: Routine | undefined;
  active: Session | undefined;
  finished: Session[];
  restTimer: RestTimer | null;
  saveSession(s: Session): void;
  deleteSession(id: string): void;
  saveSettings(s: Settings): void;
  saveExercise(e: Exercise): void;
  saveRoutine(r: Routine): void;
  saveRoutines(rs: Routine[]): void;
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
const EMPTY: AppData = { exercises: [], routines: [], sessions: [], targets: [], jefitAliases: [], settings: DEFAULT_SETTINGS };
// The seed (plan + exercise library) is only needed on first launch and reset, so it loads on demand.
export const loadSeed = async () => (await import("../core/seed")).buildSeed();

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(EMPTY);
  const [ready, setReady] = useState(false);
  const [restTimer, setTimerState] = useState<RestTimer | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [backup, setBackup] = useState<{ lastAt: string | null; snoozedUntil: string | null }>({ lastAt: null, snoozedUntil: null });
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const toastId = useRef(0);

  const toast = useCallback((t: Omit<Toast, "id">) => {
    const id = ++toastId.current;
    setToasts((x) => [...x.slice(-2), { ...t, id }]);
    setTimeout(() => setToasts((x) => x.filter((y) => y.id !== id)), t.kind === "pr" ? 4200 : 3200);
  }, []);
  const dismissToast = useCallback((id: number) => setToasts((x) => x.filter((y) => y.id !== id)), []);

  const write = useCallback((f: () => Promise<unknown>) => {
    queue.current = queue.current.then(f).catch((e) => {
      console.error(e);
      toast({ kind: "error", title: "Couldn't save", body: "Your last change may not be stored. Export a backup from Settings." });
    });
  }, [toast]);

  useEffect(() => {
    (async () => {
      await adapter.init(loadSeed);
      let d = await adapter.exportAll();
      // One-time migrations (each runs once; ids remembered in meta)
      const doneIds = (await adapter.getMeta<string[]>("migrations")) ?? [];
      for (const m of MIGRATIONS) {
        if (doneIds.includes(m.id)) continue;
        const next = m.run(d, localDate(new Date()));
        if (next) { await adapter.replaceAll(next); d = await adapter.exportAll(); }
        doneIds.push(m.id);
        await adapter.setMeta("migrations", doneIds);
      }
      const t = await adapter.getMeta<RestTimer>("restTimer");
      setBackup({ lastAt: (await adapter.getMeta<string>("lastBackupAt")) ?? null, snoozedUntil: (await adapter.getMeta<string>("backupSnoozedUntil")) ?? null });
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

  const store = useMemo<Store>(() => {
    const exMap = new Map(data.exercises.map((e) => [e.id, e]));
    const sorted = [...data.sessions].sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1));
    return {
      ...data,
      ready,
      exMap,
      routine: data.routines.find((r) => r.isCurrent) ?? data.routines[0],
      active: sorted.find((s) => s.status === "active"),
      finished: sorted.filter((s) => s.status === "finished"),
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
        await adapter.replaceAll(d);
        setData(await adapter.exportAll());
        setTimerState(null);
      },
      exportAll: async () => {
        await queue.current;
        return adapter.exportAll();
      },
    };
  }, [data, ready, restTimer, toasts, toast, dismissToast, putRow, write, backup]);

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}
