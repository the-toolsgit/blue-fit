import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { IdbAdapter } from "./idbAdapter";
import { DexieAdapter } from "./dexieAdapter";
import { buildSeed } from "../core/seed";
import type { Session } from "../core/types";

const session = (id: string): Session => ({ id, date: "2026-11-14", title: "Back & Biceps", startedAt: "2026-11-14T10:00:00.000Z", finishedAt: "2026-11-14T11:00:00.000Z", status: "finished", source: "app",
  entries: [{ id: "e", exerciseId: "t-bar-reverse-row", restSec: 120, sets: [{ id: "s", type: "working", weight: 90, reps: 12, done: true }] }] });

describe("IdbAdapter", () => {
  it("reads everything an earlier (Dexie) version of the app stored", async () => {
    const name = "old-" + Math.random();
    const old = new DexieAdapter(name);
    await old.init(buildSeed);
    await old.put("sessions", session("s1"));
    const s = await old.getSettings();
    await old.saveSettings({ ...s, restDefaultSec: 90 });
    await old.setMeta("migrations", ["x"]);
    (old as unknown as { db: { close(): void } }).db.close();

    const db = new IdbAdapter(name);
    await db.init(() => { throw new Error("must not reseed"); });
    expect(await db.all("exercises")).toHaveLength(35);
    expect((await db.all("sessions"))[0].entries[0].sets[0].weight).toBe(90);
    expect((await db.getSettings()).restDefaultSec).toBe(90);
    expect(await db.getMeta("migrations")).toEqual(["x"]);
    // the upgrade added the body scans store (Nov 24 2026)
    expect(await db.all("bodyScans")).toEqual([]);
    // meta written in the same transaction as the data (import: the migrations list)
    await db.replaceAll(await db.exportAll(), { migrations: ["a", "b"] });
    expect(await db.getMeta("migrations")).toEqual(["a", "b"]);
  });
  it("seeds a new database once, writes through, replaces atomically", async () => {
    const db = new IdbAdapter("new-" + Math.random());
    await db.init(buildSeed);
    expect(await db.all("routines")).toHaveLength(1);
    await db.put("sessions", session("a"));
    await db.putMany("sessions", [session("b"), session("c")]);
    await db.remove("sessions", "b");
    expect((await db.all("sessions")).map((x) => x.id).sort()).toEqual(["a", "c"]);
    await db.setMeta("restTimer", { endsAt: 1 });
    await db.setMeta("k", 1); await db.setMeta("k", undefined);
    expect(await db.getMeta("k")).toBeUndefined();
    await db.init(buildSeed);
    expect(await db.all("sessions")).toHaveLength(2);
    const data = await db.exportAll();
    await db.replaceAll({ ...data, sessions: [] });
    expect(await db.all("sessions")).toHaveLength(0);
    expect(await db.all("exercises")).toHaveLength(35);
    expect(await db.getMeta("restTimer")).toBeUndefined();
    // body scans: stored, exported, cleared by Reset (replaceAll)
    const scan = { id: "b1", date: "2026-11-24T08:00", source: "manual" as const, scannerVersion: "manual", measureVersion: 1, heightCm: 175, sex: "female" as const, measurements: { hips: 100 }, confidence: { hips: 1 } };
    await db.put("bodyScans", scan);
    expect((await db.exportAll()).bodyScans).toEqual([scan]);
    await db.replaceAll({ ...(await db.exportAll()), bodyScans: [] });
    expect(await db.all("bodyScans")).toEqual([]);
    // meta written in the same transaction as the data (import: the migrations list)
    await db.replaceAll(await db.exportAll(), { migrations: ["a", "b"] });
    expect(await db.getMeta("migrations")).toEqual(["a", "b"]);
  });
});
