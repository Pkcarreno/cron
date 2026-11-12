import {
  AndroidHaptics,
  ImpactFeedbackStyle,
  NotificationFeedbackType,
} from "expo-haptics";
import React, { useRef } from "react";
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
  withTiming,
} from "react-native-reanimated";

import { colors } from "@/helpers/colors";
import {
  triggerAndroidHaptic,
  triggerHaptic,
  triggerType,
} from "@/helpers/haptics";

const LONG_PRESS_DURATION = 600;
const DEFAULT_DOUBLE_TAP_COOLDOWN_MS = 400;

interface PressableAreaProps {
  children: React.ReactNode;
  deadZone?: number;
  doubleTapCooldownMs?: number;
  onDoublePress?: () => void;
  onLongPress?: () => void;
  onPress?: () => void;
  onUnassignedTap?: () => void;
}

export const PressableArea = ({
  children,
  deadZone = 0,
  doubleTapCooldownMs = DEFAULT_DOUBLE_TAP_COOLDOWN_MS,
  onDoublePress,
  onLongPress,
  onPress,
  onUnassignedTap,
}: PressableAreaProps) => {
  const scale = useSharedValue(1);
  const holdProgress = useSharedValue(0);
  const lastDoubleTapTimestampRef = useRef<number>(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.get() }],
  }));

  const progressAnimatedStyle = useAnimatedStyle(() => {
    const val =
      holdProgress.value ??
      (typeof holdProgress.get === "function" ? holdProgress.get() : 0);
    return {
      width: `${Math.min(100, Math.max(0, val * 100))}%`,
    };
  });

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
      scale.set(withSpring(1, { dampingRatio: 1, duration: 150 }));
      holdProgress.set(0);
      triggerAndroidHaptic(AndroidHaptics.Long_Press, {
        mode: ImpactFeedbackStyle.Heavy,
        type: triggerType.Impact,
      });
      onLongPress?.();
    },
    onBegin: () => {
      scale.set(withSpring(0.98, { dampingRatio: 1, duration: 150 }));
      holdProgress.set(withTiming(1, { duration: LONG_PRESS_DURATION }));
    },
    onFinalize: () => {
      holdProgress.set(withSpring(0, { dampingRatio: 1, duration: 150 }));
      scale.set(withSpring(1, { dampingRatio: 1, duration: 150 }));
    },
    runOnJS: true,
  });

  const singleTap = useTapGesture({
    enabled: Boolean(onPress || onUnassignedTap),
    onActivate: () => {
      if (onPress) {
        triggerHaptic({
          mode: ImpactFeedbackStyle.Medium,
          type: triggerType.Impact,
        });
        onPress();
      } else {
        onUnassignedTap?.();
      }
    },
    requireToFail: [doubleTap, longPress],
    runOnJS: true,
  });

  const composed = useExclusiveGestures(doubleTap, longPress, singleTap);

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.container, animatedStyle]}>
        {children}
      </Animated.View>

      <Animated.View
        pointerEvents="none"
        style={[styles.progressBar, progressAnimatedStyle]}
        testID="pressable-area-progress-bar"
      />

      <View
        pointerEvents="box-none"
        style={[
          StyleSheet.absoluteFill,
          { padding: `${deadZone}%` as DimensionValue },
        ]}
      >
        <GestureDetector gesture={composed}>
          <View collapsable={false} style={styles.container} />
        </GestureDetector>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  progressBar: {
    backgroundColor: colors.neutral[300],
    height: 2.5,
    left: 0,
    position: "absolute",
    top: 0,
  },
});
