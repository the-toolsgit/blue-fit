import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { DexieAdapter } from "./dexieAdapter";
import { buildSeed } from "../core/seed";

describe("DexieAdapter", () => {
  it("seeds once, writes through, replaces atomically", async () => {
    const db = new DexieAdapter("test-" + Math.random());
    await db.init(buildSeed);
    expect(await db.all("exercises")).toHaveLength(35);
    const r = (await db.all("routines"))[0];
    await db.put("routines", { ...r, name: "Edited" });
    await db.init(buildSeed); // second launch must not reseed
    expect((await db.all("routines"))[0].name).toBe("Edited");
    await db.setMeta("x", 1);
    expect(await db.getMeta("x")).toBe(1);
    const s = await db.getSettings();
    await db.saveSettings({ ...s, restDefaultSec: 90 });
    expect((await db.getSettings()).restDefaultSec).toBe(90);
    await db.replaceAll(buildSeed());
    expect((await db.all("routines"))[0].name).toBe("Leo v3.1");
    expect((await db.getSettings()).restDefaultSec).toBe(120);
  });
});
