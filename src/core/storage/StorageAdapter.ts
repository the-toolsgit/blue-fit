// Storage abstraction. Screens talk only to this interface, so IndexedDB can be replaced
// by a cloud database (e.g. Supabase) later. Keys: exercises.id, routines.id, sessions.id,
// targets.group, jefitAliases.jefitName. Settings and meta are single key/value records.
import type { AppData, Exercise, JefitAlias, Routine, Session, Settings, VolumeTarget } from "../types";

export interface Tables {
  exercises: Exercise;
  routines: Routine;
  sessions: Session;
  targets: VolumeTarget;
  jefitAliases: JefitAlias;
}
export type TableName = keyof Tables;
export const TABLE_KEYS: { [T in TableName]: keyof Tables[T] } = {
  exercises: "id", routines: "id", sessions: "id", targets: "group", jefitAliases: "jefitName",
};

export interface StorageAdapter {
  /** Open the store. Seeds it with `seed()` when empty. */
  init(seed: () => AppData): Promise<void>;
  all<T extends TableName>(table: T): Promise<Tables[T][]>;
  put<T extends TableName>(table: T, row: Tables[T]): Promise<void>;
  putMany<T extends TableName>(table: T, rows: Tables[T][]): Promise<void>;
  remove<T extends TableName>(table: T, key: string): Promise<void>;
  getSettings(): Promise<Settings>;
  saveSettings(s: Settings): Promise<void>;
  getMeta<V>(key: string): Promise<V | undefined>;
  setMeta<V>(key: string, value: V | undefined): Promise<void>;
  exportAll(): Promise<AppData>;
  /** Replace everything in one transaction (used by backup import and reset). */
  replaceAll(data: AppData): Promise<void>;
}
