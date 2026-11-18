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
    expect(ex.setup[0]).toBe("Pulley low, one arm, cable in front of your body.");
    const ran = run("2026-11-17-lateral-raise-cable-front", { ...d, exercises: [{ ...ex, setup: ["Pulley low, one arm, cable behind your body.", "x"] }] })!;
    expect(ran.exercises[0].setup).toEqual(["Pulley low, one arm, cable in front of your body.", "x"]);
  });
});

describe("text review migration", () => {
  it("updates untouched texts and tempos, keeps edited ones", () => {
    const d = buildSeed();
    d.exercises = d.exercises.map((e) =>
      e.id === "machine-dip" ? { ...e, avoid: ["Only doing the bottom half.", "Leaning far forward."], tempo: "my tempo" }
      : e.id === "hip-adduction" ? { ...e, tempo: "In 1 s · Out 3 s" } : e);
    const out = run("2026-11-17-text-review", d)!.exercises;
    const dip = out.find((e) => e.id === "machine-dip")!;
    expect(dip.avoid[0]).toBe("Short reps that skip the deep part.");
    expect(dip.tempo).toBe("my tempo");
    expect(out.find((e) => e.id === "hip-adduction")!.tempo).toBe("In 1 s · Hold 1 s · Out 3 s");
    expect(out.find((e) => e.id === "lean-away-lateral-raise")!.figure!.A.ua).toBe(-10);
  });
});
