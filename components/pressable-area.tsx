import {
  triggerAndroidHaptic,
  triggerHaptic,
  triggerType,
} from '@/helpers/haptics';
import {
  AndroidHaptics,
  ImpactFeedbackStyle,
  NotificationFeedbackType,
} from 'expo-haptics';
import React from 'react';
import type { DimensionValue } from 'react-native';
import { View, StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

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
  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .enabled(!!onDoublePress)
    .runOnJS(true)
    .onStart(() => {
      triggerHaptic({
        mode: NotificationFeedbackType.Success,
        type: triggerType.Notification,
      });
      onDoublePress?.();
    });

  const longPress = Gesture.LongPress()
    .minDuration(LONG_PRESS_DURATION)
    .enabled(!!onLongPress)
    .runOnJS(true)
    .onStart(() => {
      triggerAndroidHaptic(AndroidHaptics.Long_Press, {
        mode: ImpactFeedbackStyle.Heavy,
        type: triggerType.Impact,
      });
      onLongPress?.();
    });

  const singleTap = Gesture.Tap()
    .requireExternalGestureToFail(doubleTap, longPress)
    .enabled(!!onPress)
    .runOnJS(true)
    .onStart(() => {
      triggerHaptic({
        mode: ImpactFeedbackStyle.Medium,
        type: triggerType.Impact,
      });
      onPress?.();
    });

  const composed = Gesture.Exclusive(doubleTap, longPress, singleTap);

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
