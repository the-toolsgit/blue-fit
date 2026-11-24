// In-memory StorageAdapter: used by tests, and a reference for other implementations.
import { DEFAULT_SETTINGS, type AppData, type Settings } from "../types";
import { TABLE_KEYS, type StorageAdapter, type TableName, type Tables } from "./StorageAdapter";

export class MemoryAdapter implements StorageAdapter {
  private t: { [T in TableName]: Map<string, Tables[T]> } = {
    exercises: new Map(), routines: new Map(), sessions: new Map(), targets: new Map(), jefitAliases: new Map(), bodyScans: new Map(),
  };
  private settings: Settings = DEFAULT_SETTINGS;
  private meta = new Map<string, unknown>();
  private clone = <V>(v: V): V => structuredClone(v);

  async init(seed: () => AppData | Promise<AppData>) { if (this.t.exercises.size === 0) await this.replaceAll(await seed()); }
  async all<T extends TableName>(table: T) { return [...this.t[table].values()].map(this.clone) as Tables[T][]; }
  async put<T extends TableName>(table: T, row: Tables[T]) { (this.t[table] as Map<string, Tables[T]>).set(String(row[TABLE_KEYS[table]]), this.clone(row)); }
  async putMany<T extends TableName>(table: T, rows: Tables[T][]) { for (const r of rows) await this.put(table, r); }
  async remove<T extends TableName>(table: T, key: string) { this.t[table].delete(key); }
  async getSettings() { return this.clone(this.settings); }
  async saveSettings(s: Settings) { this.settings = this.clone(s); }
  async getMeta<V>(key: string) { return this.meta.get(key) as V | undefined; }
  async setMeta<V>(key: string, value: V | undefined) { if (value === undefined) this.meta.delete(key); else this.meta.set(key, value); }
  async exportAll(): Promise<AppData> {
    return { exercises: await this.all("exercises"), routines: await this.all("routines"), sessions: await this.all("sessions"), targets: await this.all("targets"), jefitAliases: await this.all("jefitAliases"), bodyScans: await this.all("bodyScans"), settings: await this.getSettings() };
  }
  async replaceAll(d: AppData) {
    (Object.keys(this.t) as TableName[]).forEach((k) => this.t[k].clear());
    await this.putMany("exercises", d.exercises); await this.putMany("routines", d.routines); await this.putMany("sessions", d.sessions);
    await this.putMany("targets", d.targets); await this.putMany("jefitAliases", d.jefitAliases); await this.putMany("bodyScans", d.bodyScans ?? []); await this.saveSettings(d.settings);
    this.meta.delete("restTimer");
  }
}
