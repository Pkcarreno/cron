import {
  AndroidHaptics,
  ImpactFeedbackStyle,
  NotificationFeedbackType,
} from "expo-haptics";
import React, { useEffect, useRef } from "react";
import type { DimensionValue } from "react-native";
import { StyleSheet, View } from "react-native";
import {
  GestureDetector,
  useExclusiveGestures,
  useLongPressGesture,
  useTapGesture,
} from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import {
  triggerAndroidHaptic,
  triggerHaptic,
  triggerType,
} from "@/helpers/haptics";

const LONG_PRESS_DURATION = 600;
const DEFAULT_HOLD_THRESHOLD_MS = 80;
const DEFAULT_DOUBLE_TAP_COOLDOWN_MS = 400;

export type PressableHapticMode = "delayed-press" | "commit-only";

interface PressableAreaProps {
  children: React.ReactNode;
  deadZone?: number;
  doubleTapCooldownMs?: number;
  hapticMode?: PressableHapticMode;
  holdThresholdMs?: number;
  onDoublePress?: () => void;
  onLongPress?: () => void;
  onPress?: () => void;
}

export const PressableArea = ({
  children,
  deadZone = 0,
  doubleTapCooldownMs = DEFAULT_DOUBLE_TAP_COOLDOWN_MS,
  hapticMode = "delayed-press",
  holdThresholdMs = DEFAULT_HOLD_THRESHOLD_MS,
  onDoublePress,
  onLongPress,
  onPress,
}: PressableAreaProps) => {
  const scale = useSharedValue(1);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastDoubleTapTimestampRef = useRef<number>(0);

  useEffect(
    () => () => {
      if (holdTimerRef.current) {
        clearTimeout(holdTimerRef.current);
        holdTimerRef.current = null;
      }
    },
    []
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.get() }],
  }));

  const doubleTap = useTapGesture({
    enabled: Boolean(onDoublePress),
    maxDelay: 250,
    numberOfTaps: 2,
    onActivate: () => {
      const now = Date.now();
      if (now - lastDoubleTapTimestampRef.current < doubleTapCooldownMs) {
        return;
      }
      lastDoubleTapTimestampRef.current = now;

      triggerHaptic({
        mode: NotificationFeedbackType.Success,
        type: triggerType.Notification,
      });
      onDoublePress?.();
    },
    runOnJS: true,
  });

  const longPress = useLongPressGesture({
    enabled: Boolean(onLongPress),
    minDuration: LONG_PRESS_DURATION,
    onActivate: () => {
      if (holdTimerRef.current) {
        clearTimeout(holdTimerRef.current);
        holdTimerRef.current = null;
      }
      scale.set(withSpring(1, { dampingRatio: 1, duration: 150 }));
      triggerAndroidHaptic(AndroidHaptics.Long_Press, {
        mode: ImpactFeedbackStyle.Heavy,
        type: triggerType.Impact,
      });
      onLongPress?.();
    },
    onBegin: () => {
      scale.set(withSpring(0.98, { dampingRatio: 1, duration: 150 }));
      if (hapticMode === "delayed-press") {
        if (holdThresholdMs === 0) {
          triggerHaptic({
            type: triggerType.Selection,
          });
        } else {
          holdTimerRef.current = setTimeout(() => {
            triggerHaptic({
              type: triggerType.Selection,
            });
            holdTimerRef.current = null;
          }, holdThresholdMs);
        }
      }
    },
    onFinalize: () => {
      if (holdTimerRef.current) {
        clearTimeout(holdTimerRef.current);
        holdTimerRef.current = null;
      }
      scale.set(withSpring(1, { dampingRatio: 1, duration: 150 }));
    },
    runOnJS: true,
  });

  const singleTap = useTapGesture({
    enabled: Boolean(onPress),
    onActivate: () => {
      triggerHaptic({
        mode: ImpactFeedbackStyle.Medium,
        type: triggerType.Impact,
      });
      onPress?.();
    },
    requireToFail: [doubleTap, longPress],
    runOnJS: true,
  });

  const composed = useExclusiveGestures(doubleTap, longPress, singleTap);

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      {children}

      <View
        style={[
          StyleSheet.absoluteFill,
          { padding: `${deadZone}%` as DimensionValue },
        ]}
        pointerEvents="box-none"
      >
        <GestureDetector gesture={composed}>
          <View collapsable={false} style={styles.container} />
        </GestureDetector>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
