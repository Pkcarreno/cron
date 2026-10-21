import { createStore } from "jotai";

import { TimerMode } from "@/helpers/timer/factory";
import {
  amrapDefaults,
  emomDefaults,
  forTimeDefaults,
  intervalDefaults,
  stopWatchDefaults,
} from "@/helpers/timer/utils/config-serializer";
import { storage } from "@/stores/storage";

import {
  amrapWorkoutAtom,
  emomWorkoutAtom,
  forTimeWorkoutAtom,
  intervalWorkoutAtom,
  stopWatchWorkoutAtom,
  workoutAtoms,
} from "./workout";

describe("workout store persistence", () => {
  beforeEach(() => {
    storage.clearAll();
  });

  it("initializes with default settings for each timer mode", () => {
    const store = createStore();

    expect(store.get(forTimeWorkoutAtom)).toEqual(forTimeDefaults);
    expect(store.get(amrapWorkoutAtom)).toEqual(amrapDefaults);
    expect(store.get(emomWorkoutAtom)).toEqual(emomDefaults);
    expect(store.get(intervalWorkoutAtom)).toEqual(intervalDefaults);
    expect(store.get(stopWatchWorkoutAtom)).toEqual(stopWatchDefaults);
  });

  it("persists customized workout settings in MMKV and restores them across store restarts", () => {
    const firstStore = createStore();

    // Mount and set atoms
    const unsub1 = firstStore.sub(forTimeWorkoutAtom, () => {});
    const unsub2 = firstStore.sub(amrapWorkoutAtom, () => {});
    const unsub3 = firstStore.sub(emomWorkoutAtom, () => {});
    const unsub4 = firstStore.sub(intervalWorkoutAtom, () => {});

    firstStore.set(forTimeWorkoutAtom, { timecapMs: 12 * 60 * 1000 });
    firstStore.set(amrapWorkoutAtom, { durationMs: 20 * 60 * 1000 });
    firstStore.set(emomWorkoutAtom, {
      roundDurationMs: 90 * 1000,
      totalRounds: 10,
    });
    firstStore.set(intervalWorkoutAtom, {
      restMs: 15 * 1000,
      totalRounds: 5,
      workMs: 45 * 1000,
    });

    unsub1();
    unsub2();
    unsub3();
    unsub4();

    expect(JSON.parse(storage.getString("workout.forTime") ?? "{}")).toEqual({
      timecapMs: 12 * 60 * 1000,
    });

    // Simulate app restart with a fresh store connected to MMKV
    const restartedStore = createStore();
    const unsubRestart = restartedStore.sub(forTimeWorkoutAtom, () => {});

    expect(restartedStore.get(forTimeWorkoutAtom)).toEqual({
      timecapMs: 12 * 60 * 1000,
    });
    unsubRestart();
  });

  it("exports workoutAtoms mapping matching all TimerModes", () => {
    expect(workoutAtoms[TimerMode.FOR_TIME]).toBe(forTimeWorkoutAtom);
    expect(workoutAtoms[TimerMode.AMRAP]).toBe(amrapWorkoutAtom);
    expect(workoutAtoms[TimerMode.EMOM]).toBe(emomWorkoutAtom);
    expect(workoutAtoms[TimerMode.INTERVAL]).toBe(intervalWorkoutAtom);
    expect(workoutAtoms[TimerMode.STOP_WATCH]).toBe(stopWatchWorkoutAtom);
  });
});
