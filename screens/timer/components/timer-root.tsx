import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useAtom, useSetAtom } from "jotai";
import type { FC, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef } from "react";
import type { AppStateStatus } from "react-native";
import { AppState, StyleSheet, View } from "react-native";

import { HideNavigationBar } from "@/components/hide-navigation-bar";
import { colors } from "@/helpers/colors";
import type {
  CheckpointData,
  SessionSummary,
} from "@/helpers/timer/controller";
import { TimerEventType } from "@/helpers/timer/controller";
import type { TimerConfig } from "@/helpers/timer/factory";
import type { TimerPhase } from "@/helpers/timer/strategy";
import type { TimerRouteParams } from "@/helpers/timer/utils/config-serializer";
import { deserializeTimerConfig } from "@/helpers/timer/utils/config-serializer";
import { useIsLowBattery } from "@/hooks/use-is-low-battery";
import type { UICheckpoint, UISessionSummary } from "@/hooks/use-timer";
import { TimerStatus, useTimerInstance } from "@/hooks/use-timer";
import {
  isLowBatteryAtom,
  timerCheckpointsAtom,
  timerConfigAtom,
  timerCurrentRoundAtom,
  timerDisplayTimeMsAtom,
  timerEndedAtAtom,
  timerIsFinishedAtom,
  timerPhaseAtom,
  timerStartedAtAtom,
  timerStatusAtom,
  timerTotalRoundsAtom,
} from "@/screens/timer/atoms";
import { OledBurnInProtector } from "@/screens/timer/components/oled-burn-in-protector";
import { SummaryFace } from "@/screens/timer/components/summary-face";
import { TimerDisplay } from "@/screens/timer/components/timer-display";
import { TimerGestureOverlay } from "@/screens/timer/components/timer-gesture-overlay";
import { TimerHeader } from "@/screens/timer/components/timer-header";
import type { TimerActions } from "@/screens/timer/context";
import { TimerContext } from "@/screens/timer/context";
import { FeedbackService } from "@/services/audio/feedback-service";

export interface TimerRootProps {
  autoStart?: boolean;
  children?: ReactNode;
  config?: TimerConfig;
  feedbackService?: FeedbackService;
  onFinish?: (summary: SessionSummary) => void;
  onPause?: () => void;
  onResume?: () => void;
}

// oxlint-disable eslint/max-statements
export const TimerRoot: FC<TimerRootProps> = ({
  autoStart = true,
  children,
  config: propConfig,
  feedbackService: propFeedbackService,
  onFinish,
  onPause,
  onResume,
}) => {
  const router = useRouter();
  const rawConfigParams = useLocalSearchParams<TimerRouteParams>();

  const config = useMemo<TimerConfig>(() => {
    if (propConfig) {
      return propConfig;
    }
    return deserializeTimerConfig(rawConfigParams);
  }, [propConfig, rawConfigParams]);

  const feedbackService = useMemo(
    () => propFeedbackService ?? new FeedbackService(),
    [propFeedbackService]
  );

  const [status, setStatus] = useAtom(timerStatusAtom);
  const setConfig = useSetAtom(timerConfigAtom);
  const setDisplayTimeMs = useSetAtom(timerDisplayTimeMsAtom);
  const setPhase = useSetAtom(timerPhaseAtom);
  const setCurrentRound = useSetAtom(timerCurrentRoundAtom);
  const setTotalRounds = useSetAtom(timerTotalRoundsAtom);
  const setIsFinished = useSetAtom(timerIsFinishedAtom);
  const [checkpoints, setCheckpoints] = useAtom(timerCheckpointsAtom);
  const [startedAt, setStartedAt] = useAtom(timerStartedAtAtom);
  const [endedAt, setEndedAt] = useAtom(timerEndedAtAtom);
  const setIsLowBattery = useSetAtom(isLowBatteryAtom);

  const isLowBattery = useIsLowBattery();

  useEffect(() => {
    setIsLowBattery(isLowBattery);
  }, [isLowBattery, setIsLowBattery]);

  useEffect(() => {
    setConfig(config);
    setTotalRounds("totalRounds" in config ? config.totalRounds : 1);
  }, [config, setConfig, setTotalRounds]);

  const controllerRef = useTimerInstance(config, feedbackService);
  const controller = controllerRef.current;

  const startedAtRef = useRef<Date | null>(startedAt);
  const endedAtRef = useRef<Date | null>(endedAt);
  const checkpointsRef = useRef<UICheckpoint[]>(checkpoints);

  useEffect(() => {
    startedAtRef.current = startedAt;
  }, [startedAt]);

  useEffect(() => {
    endedAtRef.current = endedAt;
  }, [endedAt]);

  useEffect(() => {
    checkpointsRef.current = checkpoints;
  }, [checkpoints]);

  // Audio feedback lifecycle
  useEffect(() => {
    void feedbackService.prepare();

    return () => {
      feedbackService.dispose();
    };
  }, [feedbackService]);

  useEffect(() => {
    if (!controller) {
      return;
    }

    const detach = feedbackService.attach(controller);
    return () => {
      detach();
    };
  }, [controller, feedbackService]);

  // AppState management
  useEffect(() => {
    const handleAppState = (nextState: AppStateStatus) => {
      controllerRef.current?.handleAppStateChange(nextState);
    };

    const sub = AppState.addEventListener("change", handleAppState);
    return () => {
      sub?.remove?.();
      // oxlint-disable-next-line typescript/no-explicit-any
      (AppState as any).removeEventListener?.("change", handleAppState);
    };
  }, [controllerRef]);

  // Controller event bindings
  useEffect(() => {
    if (!controller) {
      return;
    }

    controller.on(TimerEventType.UI_TICK, (state) => {
      setDisplayTimeMs(state.displayTimeMs);
      setPhase((prev) => (prev === state.phase ? prev : state.phase));
      setCurrentRound((prev) =>
        prev === state.currentRound ? prev : state.currentRound
      );
      setTotalRounds((prev) =>
        prev === state.totalRounds ? prev : state.totalRounds
      );
      setIsFinished((prev) =>
        prev === state.isFinished ? prev : state.isFinished
      );
    });

    controller.on(TimerEventType.GO, () => {
      const now = new Date();
      startedAtRef.current = now;
      setStartedAt(now);
    });

    controller.on(TimerEventType.PHASE_CHANGE, (newPhase: TimerPhase) => {
      setPhase(newPhase);
    });

    controller.on(TimerEventType.ROUND_CHANGE, (newRound: number) => {
      setCurrentRound(newRound);
    });

    controller.on(TimerEventType.FINISH, (summary: SessionSummary) => {
      const now = new Date();
      endedAtRef.current = now;
      setEndedAt(now);
      setStatus(TimerStatus.FINISHED);
      setIsFinished(true);
      onFinish?.(summary);
    });

    controller.on(
      TimerEventType.CHECKPOINT,
      (checkpointData: CheckpointData) => {
        const enriched: UICheckpoint = {
          ...checkpointData,
          recordedAt: new Date(),
        };
        setCheckpoints((prev) => [...prev, enriched]);
      }
    );

    return () => {
      controller.dispose();
    };
  }, [
    controller,
    setDisplayTimeMs,
    setPhase,
    setCurrentRound,
    setTotalRounds,
    setIsFinished,
    setStatus,
    setStartedAt,
    setEndedAt,
    setCheckpoints,
    onFinish,
  ]);

  const pause = useCallback(() => {
    setStatus(TimerStatus.PAUSED);
    controllerRef.current?.pause();
    onPause?.();
  }, [controllerRef, onPause, setStatus]);

  const start = useCallback(() => {
    setStatus(TimerStatus.RUNNING);
    controllerRef.current?.start();
    onResume?.();
  }, [controllerRef, onResume, setStatus]);

  const reset = useCallback(() => {
    setStatus(TimerStatus.READY);
    controllerRef.current?.reset();
  }, [controllerRef, setStatus]);

  const recordCheckpoint = useCallback(() => {
    controllerRef.current?.recordCheckpoint();
  }, [controllerRef]);

  const handleEndSession = useCallback(() => {
    setStatus(TimerStatus.FINISHED);
    controllerRef.current?.finishTimer();
  }, [controllerRef, setStatus]);

  const getSummary = useCallback((): UISessionSummary | undefined => {
    const coreSummary = controllerRef.current?.getSummary();
    if (!coreSummary) {
      return;
    }

    const currentDate = new Date();

    return {
      ...coreSummary,
      checkpoints: checkpointsRef.current,
      endedAt: endedAtRef.current || currentDate,
      startedAt: startedAtRef.current || currentDate,
    };
  }, [controllerRef]);

  const handleFinish = useCallback(() => {
    if (status !== TimerStatus.FINISHED) {
      handleEndSession();
    }
    router.back();
  }, [handleEndSession, router, status]);

  useEffect(() => {
    if (autoStart) {
      start();
    }

    return () => {
      reset();
    };
  }, [autoStart, start, reset]);

  const actions = useMemo<TimerActions>(
    () => ({
      getSummary,
      handleEndSession,
      pause,
      recordCheckpoint,
      reset,
      start,
    }),
    [getSummary, handleEndSession, pause, recordCheckpoint, reset, start]
  );

  if (status === TimerStatus.PAUSED || status === TimerStatus.FINISHED) {
    return (
      <SummaryFace
        summary={getSummary()}
        mode={config.mode}
        handleEndSession={handleFinish}
        handleResumeSession={start}
      />
    );
  }

  return (
    <TimerContext.Provider value={actions}>
      <StatusBar hidden={true} />
      <HideNavigationBar />

      <View style={styles.container} testID="timer-screen" collapsable={false}>
        {children ?? (
          <OledBurnInProtector>
            <TimerGestureOverlay>
              <TimerHeader />
              <TimerDisplay />
            </TimerGestureOverlay>
          </OledBurnInProtector>
        )}
      </View>
    </TimerContext.Provider>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.black,
    flex: 1,
  },
});
