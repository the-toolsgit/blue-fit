// IndexedDB implementation of StorageAdapter (via Dexie). The only file that knows about Dexie.
import Dexie, { type Table } from "dexie";
import { DEFAULT_SETTINGS, type AppData, type Exercise, type JefitAlias, type Routine, type Session, type Settings, type VolumeTarget } from "../core/types";
import type { StorageAdapter, TableName, Tables } from "../core/storage/StorageAdapter";

class BlueFitDB extends Dexie {
  exercises!: Table<Exercise, string>;
  routines!: Table<Routine, string>;
  sessions!: Table<Session, string>;
  targets!: Table<VolumeTarget, string>;
  jefitAliases!: Table<JefitAlias, string>;
  kv!: Table<{ key: string; value: unknown }, string>;
  constructor(name: string) {
    super(name);
    this.version(1).stores({
      exercises: "id, name",
      routines: "id",
      sessions: "id, date, status, importKey",
      targets: "group",
      jefitAliases: "jefitName",
      kv: "key",
    });
  }
}

const TABLES: TableName[] = ["exercises", "routines", "sessions", "targets", "jefitAliases"];

export class DexieAdapter implements StorageAdapter {
  private db: BlueFitDB;
  constructor(name = "blue-fit") { this.db = new BlueFitDB(name); }

  private table<T extends TableName>(t: T) { return this.db[t] as unknown as Table<Tables[T], string>; }

  async init(seed: () => AppData) {
    await this.db.open();
    // Ask the browser not to evict our data under storage pressure.
    try { await navigator.storage?.persist?.(); } catch { /* not supported */ }
    if ((await this.db.exercises.count()) === 0) await this.replaceAll(seed());
  }
  async all<T extends TableName>(t: T) { return this.table(t).toArray(); }
  async put<T extends TableName>(t: T, row: Tables[T]) { await this.table(t).put(row); }
  async putMany<T extends TableName>(t: T, rows: Tables[T][]) { await this.table(t).bulkPut(rows); }
  async remove<T extends TableName>(t: T, key: string) { await this.table(t).delete(key); }
  async getSettings(): Promise<Settings> {
    const row = await this.db.kv.get("settings");
    return { ...DEFAULT_SETTINGS, ...((row?.value as Partial<Settings>) ?? {}) };
  }
  async saveSettings(s: Settings) { await this.db.kv.put({ key: "settings", value: s }); }
  async getMeta<V>(key: string) { return (await this.db.kv.get("meta:" + key))?.value as V | undefined; }
  async setMeta<V>(key: string, value: V | undefined) {
    if (value === undefined) await this.db.kv.delete("meta:" + key);
    else await this.db.kv.put({ key: "meta:" + key, value });
  }
  async exportAll(): Promise<AppData> {
    return {
      exercises: await this.all("exercises"), routines: await this.all("routines"), sessions: await this.all("sessions"),
      targets: await this.all("targets"), jefitAliases: await this.all("jefitAliases"), settings: await this.getSettings(),
    };
  }
  async replaceAll(d: AppData) {
    await this.db.transaction("rw", [...TABLES.map((t) => this.db[t]), this.db.kv], async () => {
      for (const t of TABLES) await this.db[t].clear();
      await this.db.exercises.bulkPut(d.exercises);
      await this.db.routines.bulkPut(d.routines);
      await this.db.sessions.bulkPut(d.sessions);
      await this.db.targets.bulkPut(d.targets);
      await this.db.jefitAliases.bulkPut(d.jefitAliases);
      await this.db.kv.put({ key: "settings", value: d.settings });
      await this.db.kv.delete("meta:restTimer");
    });
  }
}
