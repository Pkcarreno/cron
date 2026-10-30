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
} from "react-native-reanimated";

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
}

export const PressableArea = ({
  children,
  deadZone = 0,
  doubleTapCooldownMs = DEFAULT_DOUBLE_TAP_COOLDOWN_MS,
  onDoublePress,
  onLongPress,
  onPress,
}: PressableAreaProps) => {
  const scale = useSharedValue(1);
  const lastDoubleTapTimestampRef = useRef<number>(0);

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
      scale.set(withSpring(1, { dampingRatio: 1, duration: 150 }));
      triggerAndroidHaptic(AndroidHaptics.Long_Press, {
        mode: ImpactFeedbackStyle.Heavy,
        type: triggerType.Impact,
      });
      onLongPress?.();
    },
    onBegin: () => {
      scale.set(withSpring(0.98, { dampingRatio: 1, duration: 150 }));
    },
    onFinalize: () => {
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
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
