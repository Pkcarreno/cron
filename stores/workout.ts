import { TimerMode } from "@/helpers/timer/factory";
import {
  amrapDefaults,
  emomDefaults,
  forTimeDefaults,
  intervalDefaults,
  stopWatchDefaults,
} from "@/helpers/timer/utils/config-serializer";
import type {
  AmrapFormValues,
  EmomFormValues,
  ForTimeFormValues,
  IntervalFormValues,
  StopWatchFormValues,
} from "@/screens/menu/schema";

import { atomWithMMKV } from "./storage";

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
