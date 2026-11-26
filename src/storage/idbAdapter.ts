// IndexedDB implementation of StorageAdapter, written against the raw browser API (no library).
// Opens the same "blue-fit" database the app has always used: object stores exercises (id),
// routines (id), sessions (id), targets (group), jefitAliases (jefitName), bodyScans (id) and kv (key).
// Earlier versions created it with Dexie, which stores schema version 1 as IndexedDB version 10.
import { ACCENTS, DEFAULT_SETTINGS, type AppData, type Settings } from "../core/types";
import { TABLE_KEYS, type StorageAdapter, type TableName, type Tables } from "../core/storage/StorageAdapter";

// 11 (Nov 24 2026): bodyScans store
const DB_VERSION = 11;
const TABLES: TableName[] = ["exercises", "routines", "sessions", "targets", "jefitAliases", "bodyScans"];
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
  /** A write whose transaction failed on a lost connection (iOS, after the background) runs once more on a fresh one.
   *  Every write here is a put or delete by key, so running it twice gives the same result. */
  private async write(t: TableName | "kv", f: (s: IDBObjectStore) => void) {
    const run = async () => { const s = await this.store(t, "readwrite"); f(s); await done(s.transaction); };
    try { await run(); }
    catch (e) {
      const name = (e as { name?: string } | null)?.name;
      if (name !== "UnknownError" && name !== "InvalidStateError" && name !== "AbortError" && !(e instanceof Error && e.message === "Transaction aborted")) throw e;
      this.dbp = null;
      await run();
    }
  }
  async put<T extends TableName>(t: T, row: Tables[T]) { await this.write(t, (s) => s.put(row)); }
  async putMany<T extends TableName>(t: T, rows: Tables[T][]) { await this.write(t, (s) => rows.forEach((r) => s.put(r))); }
  async remove<T extends TableName>(t: T, key: string) { await this.write(t, (s) => s.delete(key)); }
  private async kvGet(key: string) { return (await req((await this.store("kv", "readonly")).get(key)) as { value: unknown } | undefined)?.value; }
  private async kvPut(key: string, value: unknown) { await this.write("kv", (s) => s.put({ key, value })); }
  async getSettings(): Promise<Settings> {
    const s: Settings = { ...DEFAULT_SETTINGS, ...((await this.kvGet("settings")) as Partial<Settings> | undefined ?? {}) };
    // An accent that no longer exists (green, removed Nov 24 2026) falls back to blue
    return ACCENTS.includes(s.accent) ? s : { ...s, accent: "blue" };
  }
  async saveSettings(s: Settings) { await this.kvPut("settings", s); }
  async getMeta<V>(key: string) { return (await this.kvGet("meta:" + key)) as V | undefined; }
  async setMeta<V>(key: string, value: V | undefined) {
    if (value !== undefined) return this.kvPut("meta:" + key, value);
    await this.write("kv", (s) => s.delete("meta:" + key));
  }
  async exportAll(): Promise<AppData> {
    return { exercises: await this.all("exercises"), routines: await this.all("routines"), sessions: await this.all("sessions"),
      targets: await this.all("targets"), jefitAliases: await this.all("jefitAliases"), bodyScans: await this.all("bodyScans"), settings: await this.getSettings() };
  }
  /** Replace everything in one transaction: all or nothing. */
  async replaceAll(d: AppData, meta: Record<string, unknown> = {}) {
    const tx = await this.tx([...TABLES, "kv"]);
    for (const t of TABLES) { const s = tx.objectStore(t); s.clear(); for (const row of d[t] ?? []) s.put(row); }
    tx.objectStore("kv").put({ key: "settings", value: d.settings });
    tx.objectStore("kv").delete("meta:restTimer");
    for (const [k, v] of Object.entries(meta)) tx.objectStore("kv").put({ key: "meta:" + k, value: v });
    await done(tx);
  }
}
