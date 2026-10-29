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
  activeTimerConfigAtom,
  activeTimerModeAtom,
  amrapWorkoutAtom,
  emomWorkoutAtom,
  forTimeWorkoutAtom,
  intervalWorkoutAtom,
  isActiveTimerValidAtom,
  isCurrentTimerValidAtom,
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

describe("activeTimerModeAtom and dynamic validation atom", () => {
  it("initializes activeTimerModeAtom with default TimerMode.FOR_TIME", () => {
    const store = createStore();
    expect(store.get(activeTimerModeAtom)).toBe(TimerMode.FOR_TIME);
  });

  it("evaluates isCurrentTimerValidAtom for the active mode and exposes alias isActiveTimerValidAtom", () => {
    const store = createStore();

    expect(isActiveTimerValidAtom).toBe(isCurrentTimerValidAtom);
    expect(store.get(isCurrentTimerValidAtom)).toBe(true);

    store.set(forTimeWorkoutAtom, { timecapMs: 0 });
    expect(store.get(isCurrentTimerValidAtom)).toBe(false);

    store.set(forTimeWorkoutAtom, { timecapMs: 60_000 });
    expect(store.get(isCurrentTimerValidAtom)).toBe(true);
  });

  it("evaluates validity solely for the active mode without subscribing to inactive forms", () => {
    const store = createStore();
    store.set(activeTimerModeAtom, TimerMode.FOR_TIME);

    const listener = jest.fn();
    const unsub = store.sub(isCurrentTimerValidAtom, listener);

    // Initial read to establish active subscription to forTimeWorkoutAtom
    expect(store.get(isCurrentTimerValidAtom)).toBe(true);
    expect(listener).not.toHaveBeenCalled();

    // Changing an inactive form (AMRAP) must NOT trigger the listener
    store.set(amrapWorkoutAtom, { durationMs: 0 });
    expect(listener).not.toHaveBeenCalled();
    expect(store.get(isCurrentTimerValidAtom)).toBe(true);

    // Changing the active form (FOR_TIME) MUST trigger the listener
    store.set(forTimeWorkoutAtom, { timecapMs: 0 });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.get(isCurrentTimerValidAtom)).toBe(false);

    // Switch mode to AMRAP (which was set to invalid duration 0)
    store.set(activeTimerModeAtom, TimerMode.AMRAP);
    expect(store.get(isCurrentTimerValidAtom)).toBe(false);

    const listenerCallCount = listener.mock.calls.length;

    // Now FOR_TIME is inactive; changing it must NOT trigger the listener
    store.set(forTimeWorkoutAtom, { timecapMs: 60_000 });
    expect(listener.mock.calls.length).toBe(listenerCallCount);

    // Changing AMRAP must trigger the listener
    store.set(amrapWorkoutAtom, { durationMs: 60_000 });
    expect(store.get(isCurrentTimerValidAtom)).toBe(true);
    expect(listener.mock.calls.length).toBeGreaterThan(listenerCallCount);

    unsub();
  });

  it("returns the active timer config through activeTimerConfigAtom", () => {
    const store = createStore();

    expect(store.get(activeTimerConfigAtom)).toEqual({
      mode: TimerMode.FOR_TIME,
      ...forTimeDefaults,
    });

    store.set(activeTimerModeAtom, TimerMode.EMOM);
    expect(store.get(activeTimerConfigAtom)).toEqual({
      mode: TimerMode.EMOM,
      ...emomDefaults,
    });
  });
});
