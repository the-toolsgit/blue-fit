import { describe, expect, it } from "vitest";
import { ageOn, resolveProfile, yearsSince } from "./profile";

describe("profile dates", () => {
  it("age counts the birthday", () => {
    expect(ageOn("1990-06-15", "2026-06-14")).toBe(35);
    expect(ageOn("1990-06-15", "2026-06-15")).toBe(36);
  });
  it("years lifting in half years", () => {
    expect(yearsSince("2020-03", "2026-02-28")).toBe(5.5);
    expect(yearsSince("2020-03", "2026-03-01")).toBe(6);
    expect(yearsSince("2026-11", "2026-11-25")).toBe(0);
  });
  it("dates win over typed numbers", () => {
    const p = { goal: "growth" as const, phase: "maintaining" as const, age: 20, yearsTraining: 1, sleepHours: 7, born: "1990-01-01", liftingSince: "2016-01" };
    expect(resolveProfile(p, "2026-11-25")).toMatchObject({ age: 36, yearsTraining: 10.5 });
    expect(resolveProfile({ ...p, born: null, liftingSince: null }, "2026-11-25")).toMatchObject({ age: 20, yearsTraining: 1 });
  });
});
