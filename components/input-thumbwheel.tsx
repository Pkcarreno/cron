import { AndroidHaptics, ImpactFeedbackStyle } from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useEffect, useMemo } from "react";
import type { LayoutChangeEvent } from "react-native";
import { PanResponder, StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDecay,
  withSpring,
} from "react-native-reanimated";

import { colors } from "@/helpers/colors";
import {
  triggerAndroidHaptic,
  triggerHaptic,
  triggerType,
} from "@/helpers/haptics";

import { Text } from "./text";

export const TICK_WIDTH = 20;

export interface InputThumbwheelProps {
  max?: number;
  min?: number;
  onChangeValue?: (value: number) => void;
  step?: number;
  value: number;
}

interface TickProps {
  index: number;
  min: number;
  step: number;
}

const SPRING_CONFIG = {
  damping: 30,
  mass: 1,
  overshootClamping: false,
  restDisplacementThreshold: 0.01,
  restSpeedThreshold: 0.01,
  stiffness: 280,
};

const applyRubberBand = (
  offset: number,
  minTranslate: number,
  maxTranslate: number
) => {
  "worklet";
  if (offset > maxTranslate) {
    const overdrag = offset - maxTranslate;
    return maxTranslate + 35 * Math.log10(1 + overdrag / 35);
  }
  if (offset < minTranslate) {
    const overdrag = minTranslate - offset;
    return minTranslate - 35 * Math.log10(1 + overdrag / 35);
  }
  return offset;
};

export const getIndexForOffset = (
  offset: number,
  width: number,
  totalTicks: number
) => {
  "worklet";
  const rawIndex = (width / 2 - TICK_WIDTH / 2 - offset) / TICK_WIDTH;
  return Math.max(0, Math.min(Math.round(rawIndex), totalTicks - 1));
};

export const getOffsetForIndex = (index: number, width: number) => {
  "worklet";
  return width / 2 - (index * TICK_WIDTH + TICK_WIDTH / 2);
};

const Tick = React.memo(({ index, min, step }: TickProps) => {
  const isMajor = index % 5 === 0;
  const currentValue = min + index * step;

  return (
    <View style={tickStyles.container}>
      <View
        style={[tickStyles.line, isMajor ? tickStyles.major : tickStyles.minor]}
      />
      {isMajor ? (
        <Text
          colorSubtone="800"
          size={10}
          style={tickStyles.label}
          weight="500"
        >
          {currentValue}
        </Text>
      ) : null}
    </View>
  );
});

Tick.displayName = "Tick";

const InputThumbwheel: React.FC<InputThumbwheelProps> = ({
  value,
  min = 0,
  max = 100,
  step = 1,
  onChangeValue,
}) => {
  const totalTicks = useMemo(
    () => Math.floor((max - min) / step) + 1,
    [max, min, step]
  );

  const initialIndex = useMemo(() => {
    const clamped = Math.max(min, Math.min(max, value));
    return Math.round((clamped - min) / step);
  }, [value, min, max, step]);

  const containerWidth = useSharedValue(0);
  const translateX = useSharedValue(0);
  const startX = useSharedValue(0);
  const isDragging = useSharedValue(false);
  const lastHapticIndex = useSharedValue(initialIndex);
  const isMounted = useSharedValue(false);

  const notifyChange = useCallback(
    (nextVal: number) => {
      onChangeValue?.(nextVal);
    },
    [onChangeValue]
  );

  const playHaptic = useCallback((index: number) => {
    if (index % 5 === 0) {
      triggerHaptic({
        mode: ImpactFeedbackStyle.Medium,
        type: triggerType.Impact,
      });
      triggerAndroidHaptic(AndroidHaptics.Confirm);
    } else {
      triggerHaptic({
        type: triggerType.Selection,
      });
    }
  }, []);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) =>
          Math.abs(gestureState.dx) > 2 &&
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy),
        onMoveShouldSetPanResponderCapture: (_, gestureState) =>
          Math.abs(gestureState.dx) > 2 &&
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy),
        onPanResponderGrant: () => {
          isDragging.value = true;
          startX.value = translateX.value;
        },
        onPanResponderMove: (_, gestureState) => {
          const width = containerWidth.value > 0 ? containerWidth.value : 300;
          const minTranslate =
            width / 2 - ((totalTicks - 1) * TICK_WIDTH + TICK_WIDTH / 2);
          const maxTranslate = width / 2 - TICK_WIDTH / 2;

          const nextOffset = startX.value + gestureState.dx;
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
            playHaptic(currentIndex);
            notifyChange(min + currentIndex * step);
          }
        },
        onPanResponderRelease: (_, gestureState) => {
          const width = containerWidth.value > 0 ? containerWidth.value : 300;
          const minTranslate =
            width / 2 - ((totalTicks - 1) * TICK_WIDTH + TICK_WIDTH / 2);
          const maxTranslate = width / 2 - TICK_WIDTH / 2;

          if (translateX.value > maxTranslate) {
            translateX.value = withSpring(
              maxTranslate,
              SPRING_CONFIG,
              (finished) => {
                if (finished) {
                  isDragging.value = false;
                }
              }
            );
          } else if (translateX.value < minTranslate) {
            translateX.value = withSpring(
              minTranslate,
              SPRING_CONFIG,
              (finished) => {
                if (finished) {
                  isDragging.value = false;
                }
              }
            );
          } else {
            const velocity = (gestureState.vx || 0) * 1000;
            translateX.value = withDecay(
              {
                deceleration: 0.993,
                velocity,
              },
              (finished) => {
                if (finished) {
                  const targetIndex = getIndexForOffset(
                    translateX.value,
                    width,
                    totalTicks
                  );
                  const targetOffset = getOffsetForIndex(targetIndex, width);
                  translateX.value = withSpring(
                    targetOffset,
                    SPRING_CONFIG,
                    (springDone) => {
                      if (springDone) {
                        isDragging.value = false;
                        if (targetIndex !== lastHapticIndex.value) {
                          lastHapticIndex.value = targetIndex;
                          playHaptic(targetIndex);
                          notifyChange(min + targetIndex * step);
                        }
                      }
                    }
                  );
                }
              }
            );
          }
        },
        onPanResponderTerminate: () => {
          isDragging.value = false;
          const width = containerWidth.value > 0 ? containerWidth.value : 300;
          const targetIndex = getIndexForOffset(
            translateX.value,
            width,
            totalTicks
          );
          const targetOffset = getOffsetForIndex(targetIndex, width);
          translateX.value = withSpring(targetOffset, SPRING_CONFIG);
        },
        onPanResponderTerminationRequest: () => false,
        onStartShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => false,
      }),
    [
      totalTicks,
      containerWidth,
      startX,
      translateX,
      lastHapticIndex,
      isDragging,
      notifyChange,
      min,
      step,
      playHaptic,
    ]
  );

  const handleLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const { width } = e.nativeEvent.layout;
      containerWidth.value = width;

      if (!isMounted.value) {
        isMounted.value = true;
        const initialOffset = getOffsetForIndex(initialIndex, width);
        translateX.value = initialOffset;
        startX.value = initialOffset;
      }
    },
    [containerWidth, isMounted, initialIndex, translateX, startX]
  );

  useEffect(() => {
    if (isMounted.value && !isDragging.value && containerWidth.value > 0) {
      const targetIndex = Math.max(
        0,
        Math.min(Math.round((value - min) / step), totalTicks - 1)
      );
      const targetOffset = getOffsetForIndex(targetIndex, containerWidth.value);
      if (Math.abs(translateX.value - targetOffset) > 1) {
        translateX.value = withSpring(targetOffset, SPRING_CONFIG);
        lastHapticIndex.value = targetIndex;
      }
    }
  }, [
    value,
    min,
    step,
    totalTicks,
    containerWidth,
    isMounted,
    isDragging,
    translateX,
    lastHapticIndex,
  ]);

  const handleAccessibilityAction = useCallback(
    (event: { nativeEvent: { actionName: string } }) => {
      const currentVal = value;
      if (event.nativeEvent.actionName === "increment") {
        const nextVal = Math.min(max, currentVal + step);
        notifyChange(nextVal);
      } else if (event.nativeEvent.actionName === "decrement") {
        const nextVal = Math.max(min, currentVal - step);
        notifyChange(nextVal);
      }
    },
    [value, min, max, step, notifyChange]
  );

  const animatedStyle = useAnimatedStyle(() => {
    "worklet";
    return {
      transform: [{ translateX: translateX.value }],
    };
  });

  const needleAnimatedStyle = useAnimatedStyle(() => {
    "worklet";
    return {
      transform: [{ scaleY: isDragging.value ? 1.15 : 1 }],
    };
  });

  const ticks = useMemo(
    () => Array.from({ length: totalTicks }, (_, i) => i),
    [totalTicks]
  );

  return (
    <View
      accessibilityActions={[
        { label: "Increment", name: "increment" },
        { label: "Decrement", name: "decrement" },
      ]}
      accessibilityRole="adjustable"
      accessibilityValue={{ max, min, now: value }}
      accessible={true}
      onAccessibilityAction={handleAccessibilityAction}
      onLayout={handleLayout}
      style={styles.container}
      {...panResponder.panHandlers}
    >
      <LinearGradient
        colors={[colors.neutral[400], "transparent"]}
        end={{ x: 1, y: 0 }}
        pointerEvents="none"
        start={{ x: 0, y: 0 }}
        style={styles.fadeLeft}
      />
      <LinearGradient
        colors={["transparent", colors.neutral[400]]}
        end={{ x: 1, y: 0 }}
        pointerEvents="none"
        start={{ x: 0, y: 0 }}
        style={styles.fadeRight}
      />

      <Animated.View
        pointerEvents="none"
        style={[styles.centerIndicator, needleAnimatedStyle]}
      />

      <Animated.View style={[styles.stripContainer, animatedStyle]}>
        {ticks.map((index) => (
          <Tick index={index} key={index} min={min} step={step} />
        ))}
      </Animated.View>
    </View>
  );
};

export default InputThumbwheel;

const styles = StyleSheet.create({
  centerIndicator: {
    alignSelf: "center",
    backgroundColor: colors.red,
    borderRadius: 2,
    height: 38,
    position: "absolute",
    top: 7,
    width: 2,
    zIndex: 10,
  },
  container: {
    backgroundColor: colors.neutral[400],
    borderRadius: 16,
    height: 80,
    justifyContent: "center",
    overflow: "hidden",
    position: "relative",
    width: "100%",
  },
  fadeLeft: {
    bottom: 0,
    left: 0,
    position: "absolute",
    top: 0,
    width: 48,
    zIndex: 5,
  },
  fadeRight: {
    bottom: 0,
    position: "absolute",
    right: 0,
    top: 0,
    width: 48,
    zIndex: 5,
  },
  stripContainer: {
    alignItems: "center",
    bottom: 0,
    flexDirection: "row",
    left: 0,
    position: "absolute",
    top: 0,
  },
});

const tickStyles = StyleSheet.create({
  container: {
    alignItems: "center",
    height: "100%",
    paddingTop: 12,
    width: TICK_WIDTH,
  },
  label: {
    marginTop: 6,
    textAlign: "center",
    width: 60,
  },
  line: {
    backgroundColor: colors.neutral[800],
    borderRadius: 1,
    width: 2,
  },
  major: {
    height: 28,
  },
  minor: {
    height: 16,
    opacity: 0.5,
  },
});
