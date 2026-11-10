import * as v from "valibot";

import { TimerMode } from "@/helpers/timer/factory";

import {
  amrapDefaults,
  emomDefaults,
  forTimeDefaults,
  intervalDefaults,
  schemasByMode,
  stopWatchDefaults,
  TIMER_MODES,
} from "./schemas";

describe("timer schemas and defaults", () => {
  it("defines default values for each timer mode", () => {
    expect(forTimeDefaults.timecapMs).toBeGreaterThan(0);
    expect(amrapDefaults.durationMs).toBeGreaterThan(0);
    expect(emomDefaults.roundDurationMs).toBeGreaterThan(0);
    expect(emomDefaults.totalRounds).toBeGreaterThan(0);
    expect(intervalDefaults.workMs).toBeGreaterThan(0);
    expect(intervalDefaults.restMs).toBeGreaterThan(0);
    expect(intervalDefaults.totalRounds).toBeGreaterThan(0);
    expect(stopWatchDefaults).toEqual({});
  });

  it("validates all defaults with schemasByMode successfully", () => {
    expect(
      v.safeParse(schemasByMode[TimerMode.FOR_TIME], forTimeDefaults).success
    ).toBe(true);
    expect(
      v.safeParse(schemasByMode[TimerMode.AMRAP], amrapDefaults).success
    ).toBe(true);
    expect(
      v.safeParse(schemasByMode[TimerMode.EMOM], emomDefaults).success
    ).toBe(true);
    expect(
      v.safeParse(schemasByMode[TimerMode.INTERVAL], intervalDefaults).success
    ).toBe(true);
    expect(
      v.safeParse(schemasByMode[TimerMode.STOP_WATCH], stopWatchDefaults)
        .success
    ).toBe(true);
  });

  it("exports all 5 TIMER_MODES in order", () => {
    expect(TIMER_MODES).toEqual([
      TimerMode.FOR_TIME,
      TimerMode.AMRAP,
      TimerMode.INTERVAL,
      TimerMode.EMOM,
      TimerMode.STOP_WATCH,
    ]);
  });
});
