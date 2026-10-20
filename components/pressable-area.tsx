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
      triggerAndroidHaptic(AndroidHaptics.Long_Press, {
        mode: ImpactFeedbackStyle.Heavy,
        type: triggerType.Impact,
      });
      onLongPress?.();
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
    <View style={styles.container}>
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
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
