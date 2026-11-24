// IndexedDB implementation of StorageAdapter, written against the raw browser API (no library).
// Opens the same "blue-fit" database the app has always used: object stores exercises (id),
// routines (id), sessions (id), targets (group), jefitAliases (jefitName) and kv (key).
// Earlier versions created it with Dexie, which stores schema version 1 as IndexedDB version 10.
import { ACCENTS, DEFAULT_SETTINGS, type AppData, type Settings } from "../core/types";
import { TABLE_KEYS, type StorageAdapter, type TableName, type Tables } from "../core/storage/StorageAdapter";

const DB_VERSION = 10;
const TABLES: TableName[] = ["exercises", "routines", "sessions", "targets", "jefitAliases"];
const INDEXES: Partial<Record<TableName, string[]>> = { exercises: ["name"], sessions: ["date", "status", "importKey"] };

const req = <T>(r: IDBRequest<T>) => new Promise<T>((ok, fail) => { r.onsuccess = () => ok(r.result); r.onerror = () => fail(r.error); });
const done = (tx: IDBTransaction) => new Promise<void>((ok, fail) => { tx.oncomplete = () => ok(); tx.onerror = () => fail(tx.error); tx.onabort = () => fail(tx.error ?? new Error("Transaction aborted")); });

export class IdbAdapter implements StorageAdapter {
  private dbp: Promise<IDBDatabase> | null = null;
  constructor(private name = "blue-fit", private idb: IDBFactory = indexedDB) {}

  private db(): Promise<IDBDatabase> {
    this.dbp ??= new Promise((ok, fail) => {
      const r = this.idb.open(this.name, DB_VERSION);
      r.onupgradeneeded = () => {
        const db = r.result;
        for (const t of [...TABLES, "kv"] as const) {
          if (db.objectStoreNames.contains(t)) continue;
          const os = db.createObjectStore(t, { keyPath: t === "kv" ? "key" : (TABLE_KEYS[t as TableName] as string) });
          for (const i of INDEXES[t as TableName] ?? []) os.createIndex(i, i);
        }
      };
      // iOS drops the connection after a while in the background: forget it so the next write opens a new one
      r.onsuccess = () => {
        const db = r.result;
        db.onversionchange = () => { db.close(); this.dbp = null; };
        db.onclose = () => { this.dbp = null; };
        ok(db);
      };
      r.onerror = () => fail(r.error);
      r.onblocked = () => fail(new Error("Storage is blocked by another open copy of the app. Close other tabs and try again."));
    });
    return this.dbp;
  }
  private async tx(names: string[]) {
    try { return (await this.db()).transaction(names, "readwrite"); }
    catch { this.dbp = null; return (await this.db()).transaction(names, "readwrite"); }
  }
  private async store(t: TableName | "kv", mode: IDBTransactionMode) {
    try { return (await this.db()).transaction(t, mode).objectStore(t); }
    catch (e) {
      // A closed or lost connection ("InvalidStateError"): open again once
      if (!(e instanceof DOMException) || (e.name !== "InvalidStateError" && e.name !== "UnknownError")) throw e;
      this.dbp = null;
      return (await this.db()).transaction(t, mode).objectStore(t);
    }
  }

  async init(seed: () => AppData | Promise<AppData>) {
    await this.db();
    try { await navigator.storage?.persist?.(); } catch { /* not supported */ }
    if ((await req((await this.store("exercises", "readonly")).count())) === 0) await this.replaceAll(await seed());
  }
  async all<T extends TableName>(t: T) { return req((await this.store(t, "readonly")).getAll()) as Promise<Tables[T][]>; }
  async put<T extends TableName>(t: T, row: Tables[T]) { const s = await this.store(t, "readwrite"); await req(s.put(row)); await done(s.transaction); }
  async putMany<T extends TableName>(t: T, rows: Tables[T][]) { const s = await this.store(t, "readwrite"); rows.forEach((r) => s.put(r)); await done(s.transaction); }
  async remove<T extends TableName>(t: T, key: string) { const s = await this.store(t, "readwrite"); s.delete(key); await done(s.transaction); }
  private async kvGet(key: string) { return (await req((await this.store("kv", "readonly")).get(key)) as { value: unknown } | undefined)?.value; }
  private async kvPut(key: string, value: unknown) { const s = await this.store("kv", "readwrite"); s.put({ key, value }); await done(s.transaction); }
  async getSettings(): Promise<Settings> {
    const s: Settings = { ...DEFAULT_SETTINGS, ...((await this.kvGet("settings")) as Partial<Settings> | undefined ?? {}) };
    // An accent that no longer exists (green, removed Nov 24 2026) falls back to blue
    return ACCENTS.includes(s.accent) ? s : { ...s, accent: "blue" };
  }
  async saveSettings(s: Settings) { await this.kvPut("settings", s); }
  async getMeta<V>(key: string) { return (await this.kvGet("meta:" + key)) as V | undefined; }
  async setMeta<V>(key: string, value: V | undefined) {
    if (value !== undefined) return this.kvPut("meta:" + key, value);
    const s = await this.store("kv", "readwrite"); s.delete("meta:" + key); await done(s.transaction);
  }
  async exportAll(): Promise<AppData> {
    return { exercises: await this.all("exercises"), routines: await this.all("routines"), sessions: await this.all("sessions"),
      targets: await this.all("targets"), jefitAliases: await this.all("jefitAliases"), settings: await this.getSettings() };
  }
  /** Replace everything in one transaction: all or nothing. */
  async replaceAll(d: AppData) {
    const tx = await this.tx([...TABLES, "kv"]);
    for (const t of TABLES) { const s = tx.objectStore(t); s.clear(); for (const row of d[t]) s.put(row); }
    tx.objectStore("kv").put({ key: "settings", value: d.settings });
    tx.objectStore("kv").delete("meta:restTimer");
    await done(tx);
  }
}
