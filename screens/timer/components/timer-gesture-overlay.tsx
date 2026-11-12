import { useAtomValue } from "jotai";
import type { FC, ReactNode } from "react";
import { useCallback, useRef } from "react";
import { StyleSheet, View } from "react-native";
import {
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { PressableArea } from "@/components/pressable-area";
import { timerFlagsAtom } from "@/screens/timer/atoms";
import { TimerAmbientHint } from "@/screens/timer/components/timer-ambient-hint";
import { TimerTapRecoveryPill } from "@/screens/timer/components/timer-tap-recovery-pill";
import { useTimerContext } from "@/screens/timer/context";

export const TAP_HINT_DEBOUNCE_MS = 1500;
export const TAP_HINT_VISIBLE_DURATION_MS = 1200;

export interface TimerGestureOverlayProps {
  children: ReactNode;
  deadZone?: number;
  onDoublePress?: () => void;
  onLongPress?: () => void;
  onPress?: () => void;
  onUnassignedTap?: () => void;
}

export const TimerGestureOverlay: FC<TimerGestureOverlayProps> = ({
  children,
  deadZone = 14,
  onDoublePress,
  onLongPress,
  onPress,
  onUnassignedTap,
}) => {
  const flags = useAtomValue(timerFlagsAtom);
  const actions = useTimerContext();
  const toastProgress = useSharedValue(0);
  const lastTapHintTimestampRef = useRef<number>(0);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleDoublePress =
    onDoublePress ??
    (flags.hasCheckpointsBehavior ? actions.recordCheckpoint : undefined);

  const handleLongPress = onLongPress ?? actions.pause;

  const handleUnassignedTap = useCallback(() => {
    onUnassignedTap?.();

    const now = Date.now();
    if (now - lastTapHintTimestampRef.current < TAP_HINT_DEBOUNCE_MS) {
      return;
    }
    lastTapHintTimestampRef.current = now;

    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
    }

    toastProgress.set(withSpring(1, { dampingRatio: 1, duration: 200 }));

    hideTimerRef.current = setTimeout(() => {
      toastProgress.set(withTiming(0, { duration: 300 }));
      hideTimerRef.current = null;
    }, TAP_HINT_VISIBLE_DURATION_MS);
  }, [onUnassignedTap, toastProgress]);

  return (
    <PressableArea
      deadZone={deadZone}
      onDoublePress={handleDoublePress}
      onLongPress={handleLongPress}
      onPress={onPress}
      onUnassignedTap={handleUnassignedTap}
    >
      {children}

      <View
        pointerEvents="none"
        style={StyleSheet.absoluteFill}
        testID="timer-gesture-floating-layer"
      >
        <TimerTapRecoveryPill progress={toastProgress} />
        <TimerAmbientHint />
      </View>
    </PressableArea>
  );
};
