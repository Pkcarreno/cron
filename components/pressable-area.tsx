import {
  AndroidHaptics,
  ImpactFeedbackStyle,
  NotificationFeedbackType,
} from "expo-haptics";
import React from "react";
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

interface PressableAreaProps {
  children: React.ReactNode;
  onPress?: () => void;
  onDoublePress?: () => void;
  onLongPress?: () => void;
  deadZone?: number;
}

export const PressableArea = ({
  children,
  onPress,
  onDoublePress,
  onLongPress,
  deadZone = 0,
}: PressableAreaProps) => {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.get() }],
  }));

  const doubleTap = useTapGesture({
    enabled: Boolean(onDoublePress),
    numberOfTaps: 2,
    onActivate: () => {
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
      triggerHaptic({
        type: triggerType.Selection,
      });
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
