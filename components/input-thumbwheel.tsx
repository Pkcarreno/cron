import { AndroidHaptics, ImpactFeedbackStyle } from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useEffect, useMemo, useRef } from "react";
import type { LayoutChangeEvent } from "react-native";
import { PanResponder, Platform, StyleSheet, View } from "react-native";
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
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
  if (!Number.isFinite(offset)) {
    return 0;
  }
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
  if (!Number.isFinite(offset)) {
    return 0;
  }
  const rawIndex = (width / 2 - TICK_WIDTH / 2 - offset) / TICK_WIDTH;
  if (!Number.isFinite(rawIndex)) {
    return 0;
  }
  return Math.max(0, Math.min(Math.round(rawIndex), totalTicks - 1));
};

export const getOffsetForIndex = (index: number, width: number) => {
  "worklet";
  if (!Number.isFinite(index)) {
    return 0;
  }
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

  // Track the last value notified by thumbwheel gestures to avoid feedback loop
  const lastNotifiedValueRef = useRef<number>(value);

  const notifyChange = useCallback(
    (nextVal: number) => {
      if (Number.isFinite(nextVal)) {
        lastNotifiedValueRef.current = nextVal;
        onChangeValue?.(nextVal);
      }
    },
    [onChangeValue]
  );

  const playHaptic = useCallback((index: number) => {
    if (Platform.OS === "android") {
      triggerAndroidHaptic(
        index % 5 === 0 ? AndroidHaptics.Confirm : AndroidHaptics.Clock_Tick
      );
    } else {
      triggerHaptic(
        index % 5 === 0
          ? {
              mode: ImpactFeedbackStyle.Medium,
              type: triggerType.Impact,
            }
          : {
              type: triggerType.Selection,
            }
      );
    }
  }, []);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) => {
          const dx = Math.abs(gestureState.dx || 0);
          const dy = Math.abs(gestureState.dy || 0);
          return dx > 4 && dx > dy;
        },
        onPanResponderGrant: () => {
          cancelAnimation(translateX);
          isDragging.value = true;
          startX.value = translateX.value;
        },
        onPanResponderMove: (_, gestureState) => {
          const width = containerWidth.value > 0 ? containerWidth.value : 300;
          const minTranslate =
            width / 2 - ((totalTicks - 1) * TICK_WIDTH + TICK_WIDTH / 2);
          const maxTranslate = width / 2 - TICK_WIDTH / 2;

          const dx = Number.isFinite(gestureState?.dx) ? gestureState.dx : 0;
          const nextOffset = startX.value + dx;
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

          let targetIndex: number;
          if (translateX.value > maxTranslate) {
            targetIndex = 0;
          } else if (translateX.value < minTranslate) {
            targetIndex = totalTicks - 1;
          } else {
            const vx = Number.isFinite(gestureState?.vx) ? gestureState.vx : 0;
            const isFlick = Math.abs(vx) >= 0.2;
            if (isFlick) {
              const velocity = vx * 1000;
              const maxFling = 5 * TICK_WIDTH;
              const flingDistance = Math.max(
                -maxFling,
                Math.min(maxFling, velocity * 0.12)
              );
              const projectedOffset = translateX.value + flingDistance;
              targetIndex = getIndexForOffset(
                projectedOffset,
                width,
                totalTicks
              );
            } else {
              targetIndex = getIndexForOffset(
                translateX.value,
                width,
                totalTicks
              );
            }
          }

          const targetOffset = getOffsetForIndex(targetIndex, width);
          isDragging.value = false;
          cancelAnimation(translateX);
          translateX.value = withSpring(targetOffset, SPRING_CONFIG);

          if (targetIndex !== lastHapticIndex.value) {
            lastHapticIndex.value = targetIndex;
            playHaptic(targetIndex);
          }
          notifyChange(min + targetIndex * step);
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
          cancelAnimation(translateX);
          translateX.value = withSpring(targetOffset, SPRING_CONFIG);
          notifyChange(min + targetIndex * step);
        },
        onPanResponderTerminationRequest: () => false,
        onStartShouldSetPanResponder: () => false,
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
        cancelAnimation(translateX);
        translateX.value = initialOffset;
        startX.value = initialOffset;
        lastNotifiedValueRef.current = value;
      }
    },
    [containerWidth, isMounted, initialIndex, translateX, startX, value]
  );

  useEffect(() => {
    if (!isMounted.value || containerWidth.value <= 0) {
      return;
    }
    // Prevent feedback loop when value change originated from thumbwheel drag
    if (value === lastNotifiedValueRef.current) {
      return;
    }
    lastNotifiedValueRef.current = value;

    const targetIndex = Math.max(
      0,
      Math.min(Math.round((value - min) / step), totalTicks - 1)
    );
    const targetOffset = getOffsetForIndex(targetIndex, containerWidth.value);
    cancelAnimation(translateX);
    translateX.value = withSpring(targetOffset, SPRING_CONFIG);
    lastHapticIndex.value = targetIndex;
  }, [
    value,
    min,
    step,
    totalTicks,
    containerWidth,
    isMounted,
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
    position: "relative",
    width: TICK_WIDTH,
  },
  label: {
    bottom: 8,
    left: (TICK_WIDTH - 60) / 2,
    position: "absolute",
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
  },
});
