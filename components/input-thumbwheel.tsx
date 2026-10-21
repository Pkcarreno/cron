import { AndroidHaptics, ImpactFeedbackStyle } from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useEffect, useMemo } from "react";
import type { LayoutChangeEvent } from "react-native";
import { View, StyleSheet } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDecay,
  withSpring,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import { colors } from "@/helpers/colors";
import {
  triggerAndroidHaptic,
  triggerHaptic,
  triggerType,
} from "@/helpers/haptics";

import { Text } from "./text";

const TICK_WIDTH = 20;

export interface InputThumbwheelProps {
  value: number;
  onChangeValue?: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
}

interface TickProps {
  index: number;
  min: number;
  step: number;
}

const buildPanGesture = () => Gesture.Pan();

const fireHaptic = (
  newValue: number,
  min: number,
  max: number,
  velocity = 0
) => {
  const isLimit = newValue === min || newValue === max;
  const isMajor = Math.abs(newValue % 5) < 0.001;

  if (isLimit) {
    triggerHaptic({
      mode: ImpactFeedbackStyle.Rigid,
      type: triggerType.Impact,
    });
    return;
  }

  // Fast flick filter: only trigger on major ticks when velocity is high to prevent actuator saturation
  if (Math.abs(velocity) > 1200) {
    if (isMajor) {
      triggerAndroidHaptic(AndroidHaptics.Segment_Tick, {
        mode: ImpactFeedbackStyle.Light,
        type: triggerType.Impact,
      });
    }
    return;
  }

  if (isMajor) {
    triggerAndroidHaptic(AndroidHaptics.Segment_Tick, {
      mode: ImpactFeedbackStyle.Light,
      type: triggerType.Impact,
    });
  } else {
    triggerAndroidHaptic(AndroidHaptics.Segment_Frequent_Tick, {
      type: triggerType.Selection,
    });
  }
};

const applyRubberBand = (
  offset: number,
  minBound: number,
  maxBound: number
) => {
  "worklet";
  if (offset > maxBound) {
    const over = offset - maxBound;
    return maxBound + over * 0.35;
  }
  if (offset < minBound) {
    const over = minBound - offset;
    return minBound - over * 0.35;
  }
  return offset;
};

const getIndexForOffset = (
  offset: number,
  width: number,
  totalTicks: number
) => {
  "worklet";
  const rawIndex = (width / 2 - offset) / TICK_WIDTH;
  return Math.max(0, Math.min(Math.round(rawIndex), totalTicks - 1));
};

const getOffsetForIndex = (index: number, width: number) => {
  "worklet";
  return width / 2 - index * TICK_WIDTH;
};

const Tick = React.memo(({ index, min, step }: TickProps) => {
  const currentValue = min + index * step;
  const isMajor = Math.abs(currentValue % 5) < 0.001;

  return (
    <View style={tickStyles.container}>
      <View
        style={[tickStyles.line, isMajor ? tickStyles.major : tickStyles.minor]}
      />
      {isMajor && (
        <Text
          weight="400"
          colorSubtone="800"
          size={10}
          style={tickStyles.label}
        >
          {currentValue}
        </Text>
      )}
    </View>
  );
});

Tick.displayName = "Tick";

const InputThumbwheel: React.FC<InputThumbwheelProps> = ({
  value,
  onChangeValue,
  min = 0,
  max = 200,
  step = 1,
}) => {
  const totalTicks = Math.round((max - min) / step) + 1;
  const safeInitialValue = Math.min(Math.max(value, min), max);
  const initialIndex = Math.round((safeInitialValue - min) / step);

  const containerWidth = useSharedValue(0);
  const translateX = useSharedValue(0);
  const startX = useSharedValue(0);
  const isDragging = useSharedValue(false);
  const lastHapticIndex = useSharedValue(initialIndex);
  const needleScaleY = useSharedValue(1);

  const handleIndexChanged = useCallback(
    (index: number, velocity = 0) => {
      const newValue = Number((min + index * step).toFixed(2));
      fireHaptic(newValue, min, max, velocity);
      onChangeValue?.(newValue);
    },
    [min, step, max, onChangeValue]
  );

  // Synchronize when external value prop changes (e.g. +5, -10 buttons)
  useEffect(() => {
    if (!isDragging.get()) {
      const width = containerWidth.get() > 0 ? containerWidth.get() : 300;
      const targetIndex = Math.round(
        (Math.max(min, Math.min(value, max)) - min) / step
      );
      const targetOffset = getOffsetForIndex(targetIndex, width);

      translateX.set(
        containerWidth.get() > 0
          ? withSpring(targetOffset, {
              dampingRatio: 0.8,
              duration: 300,
            })
          : targetOffset
      );
      lastHapticIndex.set(targetIndex);
    }
  }, [
    value,
    min,
    max,
    step,
    isDragging,
    containerWidth,
    translateX,
    lastHapticIndex,
  ]);

  const panGesture = useMemo(
    () =>
      buildPanGesture()
        .activeOffsetX([-8, 8])
        .failOffsetY([-12, 12])
        .onBegin(() => {
          isDragging.value = true;
          startX.value = translateX.value;
        })
        .onUpdate((event) => {
          const width = containerWidth.value > 0 ? containerWidth.value : 300;
          const minTranslate = width / 2 - (totalTicks - 1) * TICK_WIDTH;
          const maxTranslate = width / 2;

          const nextOffset = startX.value + event.translationX;
          translateX.value = applyRubberBand(
            nextOffset,
            minTranslate,
            maxTranslate
          );

          const currentIndex = getIndexForOffset(
            translateX.value,
            width,
            totalTicks
          );
          if (currentIndex !== lastHapticIndex.value) {
            lastHapticIndex.value = currentIndex;
            needleScaleY.value = 0.92;
            needleScaleY.value = withSpring(1, {
              dampingRatio: 0.8,
              duration: 120,
            });
            scheduleOnRN(handleIndexChanged, currentIndex, event.velocityX);
          }
        })
        .onEnd((event) => {
          const width = containerWidth.value > 0 ? containerWidth.value : 300;
          const minTranslate = width / 2 - (totalTicks - 1) * TICK_WIDTH;
          const maxTranslate = width / 2;

          if (translateX.value > maxTranslate) {
            translateX.value = withSpring(
              maxTranslate,
              { dampingRatio: 0.8, duration: 250 },
              (finished) => {
                if (finished) {
                  isDragging.value = false;
                  scheduleOnRN(handleIndexChanged, 0, 0);
                }
              }
            );
          } else if (translateX.value < minTranslate) {
            translateX.value = withSpring(
              minTranslate,
              { dampingRatio: 0.8, duration: 250 },
              (finished) => {
                if (finished) {
                  isDragging.value = false;
                  scheduleOnRN(handleIndexChanged, totalTicks - 1, 0);
                }
              }
            );
          } else {
            translateX.value = withDecay(
              {
                clamp: [minTranslate, maxTranslate],
                deceleration: 0.994,
                velocity: event.velocityX,
              },
              (finished) => {
                if (finished) {
                  isDragging.value = false;
                  const finalIndex = getIndexForOffset(
                    translateX.value,
                    width,
                    totalTicks
                  );
                  const targetOffset = getOffsetForIndex(finalIndex, width);
                  translateX.value = withSpring(
                    targetOffset,
                    { dampingRatio: 1, duration: 150 },
                    (snapFinished) => {
                      if (snapFinished) {
                        scheduleOnRN(handleIndexChanged, finalIndex, 0);
                      }
                    }
                  );
                }
              }
            );
          }
        }),
    [
      totalTicks,
      handleIndexChanged,
      isDragging,
      startX,
      translateX,
      containerWidth,
      lastHapticIndex,
      needleScaleY,
    ]
  );

  const handleLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const { width } = e.nativeEvent.layout;
      containerWidth.set(width);
      const targetIndex = Math.round(
        (Math.max(min, Math.min(value, max)) - min) / step
      );
      translateX.set(getOffsetForIndex(targetIndex, width));
    },
    [min, max, step, value, containerWidth, translateX]
  );

  const handleAccessibilityAction = useCallback(
    (event: { nativeEvent: { actionName: string } }) => {
      if (event.nativeEvent.actionName === "increment") {
        const nextValue = Math.min(max, value + step);
        onChangeValue?.(nextValue);
      } else if (event.nativeEvent.actionName === "decrement") {
        const nextValue = Math.max(min, value - step);
        onChangeValue?.(nextValue);
      }
    },
    [max, min, onChangeValue, step, value]
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const needleAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scaleY: needleScaleY.value }],
  }));

  const ticks = useMemo(
    () => Array.from({ length: totalTicks }, (_, i) => i),
    [totalTicks]
  );

  return (
    <View
      accessible={true}
      accessibilityRole="adjustable"
      accessibilityValue={{ max, min, now: value }}
      accessibilityActions={[
        { label: "Increment", name: "increment" },
        { label: "Decrement", name: "decrement" },
      ]}
      onAccessibilityAction={handleAccessibilityAction}
      style={styles.container}
      onLayout={handleLayout}
    >
      <LinearGradient
        colors={[colors.neutral[400], "transparent"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.fadeLeft}
        pointerEvents="none"
      />
      <LinearGradient
        colors={["transparent", colors.neutral[400]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.fadeRight}
        pointerEvents="none"
      />

      <Animated.View
        style={[styles.centerIndicator, needleAnimatedStyle]}
        pointerEvents="none"
      />

      <GestureDetector gesture={panGesture}>
        <Animated.View style={[styles.stripContainer, animatedStyle]}>
          {ticks.map((index) => (
            <Tick key={index} index={index} min={min} step={step} />
          ))}
        </Animated.View>
      </GestureDetector>
    </View>
  );
};

export default InputThumbwheel;

const styles = StyleSheet.create({
  centerIndicator: {
    backgroundColor: colors.red,
    borderRadius: 8,
    height: 44,
    left: "50%",
    marginLeft: -1.5,
    marginTop: -12,
    position: "absolute",
    width: 3,
    zIndex: 10,
  },
  container: {
    backgroundColor: colors.neutral[400],
    borderRadius: 16,
    height: 80,
    justifyContent: "center",
    overflow: "hidden",
    position: "relative",
  },
  fadeLeft: {
    bottom: 0,
    left: 0,
    position: "absolute",
    top: 0,
    width: 24,
    zIndex: 5,
  },
  fadeRight: {
    bottom: 0,
    position: "absolute",
    right: 0,
    top: 0,
    width: 24,
    zIndex: 5,
  },
  stripContainer: {
    alignItems: "center",
    flexDirection: "row",
    height: "100%",
  },
});

const tickStyles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 10,
    width: TICK_WIDTH,
  },
  label: {
    bottom: 5,
    left: (TICK_WIDTH - 60) / 2,
    position: "absolute",
    textAlign: "center",
    width: 60,
  },
  line: {
    backgroundColor: colors.neutral[800],
    borderRadius: 8,
    width: 1.5,
  },
  major: {
    height: 34,
    width: 2,
  },
  minor: {
    height: 24,
    opacity: 0.5,
  },
});
