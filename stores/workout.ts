import type { Getter } from "jotai";
import { atom } from "jotai";

import type { TimerConfig } from "@/helpers/timer/factory";
import { TimerMode } from "@/helpers/timer/factory";
import type {
  AmrapFormValues,
  EmomFormValues,
  ForTimeFormValues,
  IntervalFormValues,
  StopWatchFormValues,
} from "@/helpers/timer/schemas";
import {
  amrapDefaults,
  emomDefaults,
  forTimeDefaults,
  intervalDefaults,
  schemasByMode,
  stopWatchDefaults,
} from "@/helpers/timer/schemas";

import { atomWithMMKV } from "./storage";

export const activeTimerModeAtom = atom<TimerMode>(TimerMode.FOR_TIME);

export const forTimeWorkoutAtom = atomWithMMKV<ForTimeFormValues>(
  "workout.forTime",
  forTimeDefaults
);

export const amrapWorkoutAtom = atomWithMMKV<AmrapFormValues>(
  "workout.amrap",
  amrapDefaults
);

export const emomWorkoutAtom = atomWithMMKV<EmomFormValues>(
  "workout.emom",
  emomDefaults
);

export const intervalWorkoutAtom = atomWithMMKV<IntervalFormValues>(
  "workout.interval",
  intervalDefaults
);

export const stopWatchWorkoutAtom = atomWithMMKV<StopWatchFormValues>(
  "workout.stopWatch",
  stopWatchDefaults
);

export const workoutAtoms = {
  [TimerMode.FOR_TIME]: forTimeWorkoutAtom,
  [TimerMode.AMRAP]: amrapWorkoutAtom,
  [TimerMode.INTERVAL]: intervalWorkoutAtom,
  [TimerMode.EMOM]: emomWorkoutAtom,
  [TimerMode.STOP_WATCH]: stopWatchWorkoutAtom,
} as const;

const evaluateActiveTimerValidity = (mode: TimerMode, get: Getter): boolean => {
  switch (mode) {
    case TimerMode.FOR_TIME: {
      return schemasByMode[TimerMode.FOR_TIME].safeParse(
        get(forTimeWorkoutAtom)
      ).success;
    }
    case TimerMode.AMRAP: {
      return schemasByMode[TimerMode.AMRAP].safeParse(get(amrapWorkoutAtom))
        .success;
    }
    case TimerMode.EMOM: {
      return schemasByMode[TimerMode.EMOM].safeParse(get(emomWorkoutAtom))
        .success;
    }
    case TimerMode.INTERVAL: {
      return schemasByMode[TimerMode.INTERVAL].safeParse(
        get(intervalWorkoutAtom)
      ).success;
    }
    case TimerMode.STOP_WATCH: {
      return schemasByMode[TimerMode.STOP_WATCH].safeParse(
        get(stopWatchWorkoutAtom)
      ).success;
    }
    default: {
      return false;
    }
  }
};

const resolveActiveTimerConfig = (
  mode: TimerMode,
  get: Getter
): TimerConfig => {
  switch (mode) {
    case TimerMode.FOR_TIME: {
      return { mode: TimerMode.FOR_TIME, ...get(forTimeWorkoutAtom) };
    }
    case TimerMode.AMRAP: {
      return { mode: TimerMode.AMRAP, ...get(amrapWorkoutAtom) };
    }
    case TimerMode.EMOM: {
      return { mode: TimerMode.EMOM, ...get(emomWorkoutAtom) };
    }
    case TimerMode.INTERVAL: {
      return { mode: TimerMode.INTERVAL, ...get(intervalWorkoutAtom) };
    }
    case TimerMode.STOP_WATCH: {
      return { mode: TimerMode.STOP_WATCH, ...get(stopWatchWorkoutAtom) };
    }
    default: {
      return { mode: TimerMode.FOR_TIME, ...get(forTimeWorkoutAtom) };
    }
  }
};

/**
 * Evaluates validation status solely for the active mode schema.
 * Dynamically subscribes to the active workout atom to avoid re-renders
 * when inactive forms change.
 */
export const isCurrentTimerValidAtom = atom<boolean>((get) => {
  const activeMode = get(activeTimerModeAtom);
  return evaluateActiveTimerValidity(activeMode, get);
});

/**
 * Semantic naming alias for `isCurrentTimerValidAtom`.
 */
export const isActiveTimerValidAtom = isCurrentTimerValidAtom;

/**
 * Returns the current workout configuration for the active mode.
 */
export const activeTimerConfigAtom = atom<TimerConfig>((get) => {
  const activeMode = get(activeTimerModeAtom);
  return resolveActiveTimerConfig(activeMode, get);
});
