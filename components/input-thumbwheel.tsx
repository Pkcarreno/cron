import { AndroidHaptics, ImpactFeedbackStyle } from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useEffect, useMemo, useRef } from "react";
import type { LayoutChangeEvent } from "react-native";
import { PanResponder, Platform, StyleSheet, View } from "react-native";
import Animated, {
  cancelAnimation,
  ReduceMotion,
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

// Apple-calibrated spring parameters as recommended in animate-expo
const SNAP_SPRING_CONFIG = {
  dampingRatio: 0.8,
  duration: 350,
  reduceMotion: ReduceMotion.System,
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

const majorLineStyle = StyleSheet.flatten([tickStyles.line, tickStyles.major]);
const minorLineStyle = StyleSheet.flatten([tickStyles.line, tickStyles.minor]);

const Tick = React.memo(({ index, min, step }: TickProps) => {
  const isMajor = index % 5 === 0;
  const currentValue = min + index * step;

  return (
    <View style={tickStyles.container}>
      <View style={isMajor ? majorLineStyle : minorLineStyle} />
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

interface TickStripProps {
  max: number;
  min: number;
  step: number;
  totalTicks: number;
}

const TickStrip = React.memo<TickStripProps>(
  ({ totalTicks, min, step }) => {
    const ticks = useMemo(
      () => Array.from({ length: totalTicks }, (_, i) => i),
      [totalTicks]
    );

    return (
      <>
        {ticks.map((index) => (
          <Tick index={index} key={index} min={min} step={step} />
        ))}
      </>
    );
  },
  (prev, next) =>
    prev.totalTicks === next.totalTicks &&
    prev.min === next.min &&
    prev.step === next.step
);

TickStrip.displayName = "TickStrip";

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

  // Keep JS-only values in React refs to eliminate cross-thread Reanimated syncs per frame
  const containerWidthRef = useRef(0);
  const startXRef = useRef(0);
  const lastHapticIndexRef = useRef(initialIndex);
  const lastHapticTimeRef = useRef(0);

  // Shared values that drive GPU animations on the UI thread
  const translateX = useSharedValue(0);
  const isDragging = useSharedValue(false);
  const isMounted = useSharedValue(false);

  // Track the last value notified by thumbwheel gestures to avoid feedback loop
  const lastNotifiedValueRef = useRef<number>(value);

  // Batch React state updates with requestAnimationFrame during rapid drag
  const pendingValueRef = useRef<number | null>(null);
  const rafIdRef = useRef<number | null>(null);

  const notifyChange = useCallback(
    (nextVal: number) => {
      if (Number.isFinite(nextVal)) {
        lastNotifiedValueRef.current = nextVal;
        onChangeValue?.(nextVal);
      }
    },
    [onChangeValue]
  );

  const scheduleNotify = useCallback(
    (nextVal: number) => {
      pendingValueRef.current = nextVal;
      if (rafIdRef.current === null) {
        rafIdRef.current = requestAnimationFrame(() => {
          rafIdRef.current = null;
          if (pendingValueRef.current !== null) {
            notifyChange(pendingValueRef.current);
            pendingValueRef.current = null;
          }
        });
      }
    },
    [notifyChange]
  );

  // Throttle haptics to the physical hardware rate (min 25ms between triggers)
  const playHaptic = useCallback((index: number) => {
    const now = Date.now();
    if (now - lastHapticTimeRef.current < 25) {
      return;
    }
    lastHapticTimeRef.current = now;

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
          startXRef.current = translateX.value;
        },
        onPanResponderMove: (_, gestureState) => {
          const width =
            containerWidthRef.current > 0 ? containerWidthRef.current : 300;
          const minTranslate =
            width / 2 - ((totalTicks - 1) * TICK_WIDTH + TICK_WIDTH / 2);
          const maxTranslate = width / 2 - TICK_WIDTH / 2;

          const dx = Number.isFinite(gestureState?.dx) ? gestureState.dx : 0;
          const nextOffset = startXRef.current + dx;
          const offset = applyRubberBand(
            nextOffset,
            minTranslate,
            maxTranslate
          );
          translateX.value = offset;

          const currentIndex = getIndexForOffset(offset, width, totalTicks);

          if (currentIndex !== lastHapticIndexRef.current) {
            lastHapticIndexRef.current = currentIndex;
            playHaptic(currentIndex);
            scheduleNotify(min + currentIndex * step);
          }
        },
        onPanResponderRelease: (_, gestureState) => {
          if (rafIdRef.current !== null) {
            cancelAnimationFrame(rafIdRef.current);
            rafIdRef.current = null;
          }

          const width =
            containerWidthRef.current > 0 ? containerWidthRef.current : 300;
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
          translateX.value = withSpring(targetOffset, SNAP_SPRING_CONFIG);

          if (targetIndex !== lastHapticIndexRef.current) {
            lastHapticIndexRef.current = targetIndex;
            playHaptic(targetIndex);
          }
          notifyChange(min + targetIndex * step);
        },
        onPanResponderTerminate: () => {
          if (rafIdRef.current !== null) {
            cancelAnimationFrame(rafIdRef.current);
            rafIdRef.current = null;
          }

          isDragging.value = false;
          const width =
            containerWidthRef.current > 0 ? containerWidthRef.current : 300;
          const targetIndex = getIndexForOffset(
            translateX.value,
            width,
            totalTicks
          );
          const targetOffset = getOffsetForIndex(targetIndex, width);
          cancelAnimation(translateX);
          translateX.value = withSpring(targetOffset, SNAP_SPRING_CONFIG);
          notifyChange(min + targetIndex * step);
        },
        onPanResponderTerminationRequest: () => false,
        onStartShouldSetPanResponder: () => false,
        onStartShouldSetPanResponderCapture: () => false,
      }),
    [
      totalTicks,
      translateX,
      isDragging,
      notifyChange,
      scheduleNotify,
      min,
      step,
      playHaptic,
    ]
  );

  const handleLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const { width } = e.nativeEvent.layout;
      containerWidthRef.current = width;

      if (!isMounted.value) {
        isMounted.value = true;
        const initialOffset = getOffsetForIndex(initialIndex, width);
        cancelAnimation(translateX);
        translateX.value = initialOffset;
        startXRef.current = initialOffset;
        lastNotifiedValueRef.current = value;
      }
    },
    [initialIndex, isMounted, translateX, value]
  );

  useEffect(
    () => () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    },
    []
  );

  useEffect(() => {
    if (!isMounted.value || containerWidthRef.current <= 0) {
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
    const targetOffset = getOffsetForIndex(
      targetIndex,
      containerWidthRef.current
    );
    cancelAnimation(translateX);
    translateX.value = withSpring(targetOffset, SNAP_SPRING_CONFIG);
    lastHapticIndexRef.current = targetIndex;
  }, [
    value,
    min,
    step,
    totalTicks,
    isMounted,
    translateX,
    containerWidthRef,
    lastHapticIndexRef,
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
        <TickStrip max={max} min={min} step={step} totalTicks={totalTicks} />
      </Animated.View>
    </View>
  );
};

export default React.memo(InputThumbwheel);

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
