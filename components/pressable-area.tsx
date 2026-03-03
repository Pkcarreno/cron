import React, { useRef } from 'react';
import type { DimensionValue } from 'react-native';
import { View, StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Haptics } from 'react-native-nitro-haptics';

const LONG_PRESS_DURATION = 600;
const BUILDUP_DELAY = 250;
const TICK_INTERVAL = 60;
const MAX_TICKS = 5;

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

  const playTick = () => {
    Haptics.selection();
  };

  const playExplosion = () => {
    Haptics.impact('heavy');
  };

  const startHapticBuildup = () => {
    let currentTick = 0;

    const tick = () => {
      if (currentTick >= MAX_TICKS) {
        return;
      }

      playTick();
      currentTick += 1;

      hapticTimer.current = setTimeout(tick, TICK_INTERVAL);
    };

    hapticTimer.current = setTimeout(tick, BUILDUP_DELAY);
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
      Haptics.notification('success');
      onDoublePress?.();
    });

  const longPress = Gesture.LongPress()
    .minDuration(LONG_PRESS_DURATION)
    .enabled(!!onLongPress)
    .runOnJS(true)
    .onBegin(() => {
      startHapticBuildup();
    })
    .onStart(() => {
      stopHapticBuildup();
      playExplosion();
      onLongPress?.();
    })
    .onFinalize(() => {
      stopHapticBuildup();
    });

  const singleTap = Gesture.Tap()
    .requireExternalGestureToFail(doubleTap, longPress)
    .enabled(!!onPress)
    .runOnJS(true)
    .onStart(() => {
      Haptics.impact('light');
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
