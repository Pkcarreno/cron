import React, { useRef } from 'react';
import type { DimensionValue } from 'react-native';
import { View, StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';

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
  const hapticTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startHapticBuildup = () => {
    let delay = 150;

    const tick = () => {
      Haptics.selectionAsync();
      delay = Math.max(40, delay - 25);
      hapticTimer.current = setTimeout(tick, delay);
    };

    tick();
  };

  const stopHapticBuildup = () => {
    if (hapticTimer.current) {
      clearTimeout(hapticTimer.current);
      hapticTimer.current = null;
    }
  };

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .enabled(!!onDoublePress)
    .runOnJS(true)
    .onStart(() => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (onDoublePress) {
        onDoublePress();
      }
    });

  const longPress = Gesture.LongPress()
    .minDuration(600)
    .enabled(!!onLongPress)
    .runOnJS(true)
    .onBegin(() => {
      startHapticBuildup();
    })
    .onStart(() => {
      stopHapticBuildup();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      if (onLongPress) {
        onLongPress();
      }
    })
    .onFinalize(() => {
      stopHapticBuildup();
    });

  const singleTap = Gesture.Tap()
    .enabled(!!onPress)
    .requireExternalGestureToFail(doubleTap, longPress)
    .runOnJS(true)
    .onStart(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      if (onPress) {
        onPress();
      }
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
          <View style={styles.container} />
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
