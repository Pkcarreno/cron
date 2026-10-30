import { atom } from "jotai";
import type { TextStyle } from "react-native";

import { colors } from "@/helpers/colors";
import type { TimerConfig } from "@/helpers/timer/factory";
import { TimerMode } from "@/helpers/timer/factory";
import { TimerPhase } from "@/helpers/timer/strategy";
import {
  formatDuration,
  formatTimeForDisplay,
  getModeAbbreviation,
} from "@/helpers/timer/utils/formatter";
import type { TimerFlags, UICheckpoint } from "@/hooks/use-timer";
import { TimerStatus } from "@/hooks/use-timer";

export interface ContextBannerState {
  label: string | number | undefined;
  labelColor?: TextStyle["color"];
  value: string | number | undefined;
  valueColor?: TextStyle["color"];
}

export const getTimerFlags = (
  config: TimerConfig,
  phase: TimerPhase
): TimerFlags => {
  const isPreparing = phase === TimerPhase.PREPARATION;

  return {
    hasCheckpointsBehavior:
      !isPreparing &&
      (config.mode === TimerMode.STOP_WATCH || config.mode === TimerMode.AMRAP),
    isPreparing,
    showsMinuteDigits: !isPreparing,
  };
};

/**
 * Base primitive atoms
 */
export const timerConfigAtom = atom<TimerConfig>({
  mode: TimerMode.FOR_TIME,
  timecapMs: 0,
});

export const timerStatusAtom = atom<TimerStatus>(TimerStatus.READY);

export const timerDisplayTimeMsAtom = atom<number>(0);

export const timerPhaseAtom = atom<TimerPhase>(TimerPhase.PREPARATION);

export const timerCurrentRoundAtom = atom<number>(0);

export const timerTotalRoundsAtom = atom<number>(1);

export const timerIsFinishedAtom = atom<boolean>(false);

export const timerCheckpointsAtom = atom<UICheckpoint[]>([]);

export const timerStartedAtAtom = atom<Date | null>(null);

export const timerEndedAtAtom = atom<Date | null>(null);

export const isLowBatteryAtom = atom<boolean>(false);

/**
 * Derived state atoms
 */
export const timerModeAbbrAtom = atom<string>((get) => {
  const config = get(timerConfigAtom);
  return getModeAbbreviation(config.mode);
});

export const timerFlagsAtom = atom<TimerFlags>((get) => {
  const config = get(timerConfigAtom);
  const phase = get(timerPhaseAtom);
  return getTimerFlags(config, phase);
});

export const timerFormattedTimeAtom = atom((get) => {
  const displayTimeMs = get(timerDisplayTimeMsAtom);
  const config = get(timerConfigAtom);
  return formatTimeForDisplay(
    displayTimeMs,
    config.mode === TimerMode.STOP_WATCH
  );
});

export const timerHoursStrAtom = atom(
  (get) => get(timerFormattedTimeAtom).hours
);

export const timerMinutesStrAtom = atom(
  (get) => get(timerFormattedTimeAtom).minutes
);

export const timerSecondsStrAtom = atom(
  (get) => get(timerFormattedTimeAtom).seconds
);

export const timerContextBannerAtom = atom<ContextBannerState>((get) => {
  const phase = get(timerPhaseAtom);
  const config = get(timerConfigAtom);
  const checkpoints = get(timerCheckpointsAtom);
  const currentRound = get(timerCurrentRoundAtom);

  if (phase === TimerPhase.PREPARATION) {
    return {
      label: undefined,
      labelColor: undefined,
      value: undefined,
      valueColor: undefined,
    };
  }

  switch (config.mode) {
    case TimerMode.AMRAP: {
      const lastCheckpoint = checkpoints.at(-1);
      return {
        label: lastCheckpoint?.lap ? "RND" : undefined,
        labelColor: colors.red,
        value: lastCheckpoint?.lap ?? undefined,
        valueColor: undefined,
      };
    }

    case TimerMode.INTERVAL: {
      const isActivePhase =
        phase === TimerPhase.WORK || phase === TimerPhase.REST;
      return {
        label: isActivePhase ? phase : undefined,
        labelColor: phase === TimerPhase.WORK ? colors.blue : colors.green,
        value: currentRound,
        valueColor: undefined,
      };
    }

    case TimerMode.EMOM: {
      return {
        label: undefined,
        labelColor: undefined,
        value: currentRound,
        valueColor: undefined,
      };
    }

    default: {
      return {
        label: undefined,
        labelColor: undefined,
        value: undefined,
        valueColor: undefined,
      };
    }
  }
});

export const timerQuickAccessInfoAtom = atom<string[]>((get) => {
  const isLowBattery = get(isLowBatteryAtom);
  const hours = get(timerHoursStrAtom);
  const checkpoints = get(timerCheckpointsAtom);
  const config = get(timerConfigAtom);

  const lastCheckpoint = checkpoints.at(-1);
  const lap =
    checkpoints.length > 0 && config.mode === TimerMode.STOP_WATCH
      ? lastCheckpoint?.lap
      : undefined;
  const delta =
    checkpoints.length > 0 && config.mode === TimerMode.STOP_WATCH
      ? lastCheckpoint?.lapDeltaMs
      : undefined;

  return [
    isLowBattery ? "[BAT LOW]" : null,
    hours ? `${hours}H` : null,
    lap && lap > 0 ? `L${lap.toString().padStart(2, "0")}` : null,
    delta ? formatDuration(delta, true) : null,
  ].filter((item): item is string => Boolean(item));
});
