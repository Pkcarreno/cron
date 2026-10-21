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

export const TICK_WIDTH = 20;

export interface InputThumbwheelProps {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChangeValue?: (value: number) => void;
}

interface TickProps {
  index: number;
  min: number;
  step: number;
}

const buildPanGesture = () => Gesture.Pan();

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
          weight="500"
          colorSubtone="800"
          size={10}
          style={tickStyles.label}
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

  const panGesture = useMemo(
    () =>
      buildPanGesture()
        .activeOffsetX([-4, 4])
        .onBegin(() => {
          isDragging.value = true;
          startX.value = translateX.value;
        })
        .onUpdate((event) => {
          const width = containerWidth.value > 0 ? containerWidth.value : 300;
          const minTranslate =
            width / 2 - ((totalTicks - 1) * TICK_WIDTH + TICK_WIDTH / 2);
          const maxTranslate = width / 2 - TICK_WIDTH / 2;

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
            scheduleOnRN(playHaptic, currentIndex);
            scheduleOnRN(notifyChange, min + currentIndex * step);
          }
        })
        .onEnd((event) => {
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
            translateX.value = withDecay(
              {
                deceleration: 0.993,
                velocity: event.velocityX,
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
                          scheduleOnRN(playHaptic, targetIndex);
                          scheduleOnRN(notifyChange, min + targetIndex * step);
                        }
                      }
                    }
                  );
                }
              }
            );
          }
        })
        .onFinalize(() => {
          isDragging.value = false;
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

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const needleAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scaleY: isDragging.value ? 1.15 : 1 }],
  }));

  const ticks = useMemo(
    () => Array.from({ length: totalTicks }, (_, i) => i),
    [totalTicks]
  );

  return (
    <GestureDetector gesture={panGesture}>
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

        <Animated.View style={[styles.stripContainer, animatedStyle]}>
          {ticks.map((index) => (
            <Tick key={index} index={index} min={min} step={step} />
          ))}
        </Animated.View>
      </View>
    </GestureDetector>
  );
};

export default InputThumbwheel;

const styles = StyleSheet.create({
  centerIndicator: {
    backgroundColor: colors.red,
    borderRadius: 8,
    height: 38,
    left: "50%",
    marginLeft: -1.5,
    position: "absolute",
    top: 7,
    width: 3,
    zIndex: 10,
  },
  container: {
    alignItems: "center",
    backgroundColor: colors.neutral[950],
    borderColor: colors.neutral[800],
    borderRadius: 16,
    borderWidth: 1,
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
    flexDirection: "row",
    height: "100%",
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
    backgroundColor: colors.neutral[600],
    borderRadius: 1,
    width: 1.5,
  },
  major: {
    height: 28,
    width: 2,
  },
  minor: {
    height: 16,
    opacity: 0.5,
  },
});
