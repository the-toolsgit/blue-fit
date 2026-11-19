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
  });
});
