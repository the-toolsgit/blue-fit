import { describe, expect, it } from "vitest";
import { MIGRATIONS } from "./migrations";
import { buildSeed } from "./seed";

const run = (id: string, d: ReturnType<typeof buildSeed>) => MIGRATIONS.find((m) => m.id === id)!.run(d, "2026-11-17");

describe("lateral raise stretch migration", () => {
  it("updates the figure and the old texts, keeps edited texts", () => {
    const d = buildSeed();
    d.exercises = d.exercises.map((e) => e.id === "cable-lateral-raise"
      ? { ...e, figure: { v: "f", base: { L: { ua: 4, fa: 4 } }, A: { ua: 8 }, B: { ua: 90 } }, setup: ["Pulley low, one arm, cable behind your body.", "Lean away a little."], form: ["My own form note."], rangeOfMotion: "Hand by your hip → shoulder height" } as any
      : e);
    const ex = run("2026-11-17-lateral-raise-stretch", d)!.exercises.find((e) => e.id === "cable-lateral-raise")!;
    expect(ex.figure!.A.ua).toBe(-30); // starts across the body
    expect(Array.isArray(ex.figure!.props)).toBe(true);
    expect(ex.setup[1]).toMatch(/Hold the machine/);
    expect(ex.form).toEqual(["My own form note."]);
    expect(ex.rangeOfMotion).toBe("Hand across your body → shoulder height");
  });
});
