import { LinearGradient } from "expo-linear-gradient";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from "react-native";
import { StyleSheet, View } from "react-native";
import type { SharedValue } from "react-native-reanimated";
import Animated, {
  useAnimatedReaction,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import { colors } from "@/helpers/colors";

import { Text } from "./text";

/** Width of each tick column in pixels. */
export const TICK_WIDTH = 20;

/** Viewport-pruned tick style collapsing opacity and transform to zero. */
export const HIDDEN_TICK_STYLE = {
  opacity: 0,
  transform: [{ scale: 0 }],
};

/** Fully visible tick style for center region. */
export const FULL_TICK_STYLE = {
  opacity: 1,
  transform: [{ scale: 1 }],
};

/** Props for the InputThumbwheel component. */
export interface InputThumbwheelProps {
  value: number;
  onChangeValue?: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  testID?: string;
}

/** Props for the AnimatedTick component. */
export interface AnimatedTickProps {
  index: number;
  min: number;
  step: number;
  scrollX: SharedValue<number>;
  halfWidth: number;
  testID?: string;
}

const getThumbwheelData = (min: number, max: number, step: number) => {
  const totalTicks = Math.round((max - min) / step) + 1;
  return {
    data: Array.from({ length: totalTicks }, (_, i) => i),
    totalTicks,
  };
};

/**
 * Individual tick mark on the thumbwheel.
 * Applies ghost pruning outside 12 units of center and cylindrical perspective falloff.
 */
export const AnimatedTick = React.memo(
  ({ index, min, step, scrollX, halfWidth, testID }: AnimatedTickProps) => {
    const currentValue = min + index * step;
    const isMajor = currentValue % 5 === 0;
    const tickPosition = index * TICK_WIDTH;

    const animatedStyle = useAnimatedStyle(() => {
      "worklet";
      const centerIndex = Math.round(scrollX.get() / TICK_WIDTH);
      if (Math.abs(index - centerIndex) > 12) {
        return HIDDEN_TICK_STYLE;
      }

      if (halfWidth <= 0) {
        return FULL_TICK_STYLE;
      }

      const distance = Math.abs(tickPosition - scrollX.get());

      // If tick is outside the visible half-width, collapse completely to skip paint
      if (distance >= halfWidth) {
        return HIDDEN_TICK_STYLE;
      }

      // Full size and opacity in center 40% zone
      const fadeStart = halfWidth * 0.4;
      if (distance <= fadeStart) {
        return FULL_TICK_STYLE;
      }

      // Smooth falloff towards the edge (outer 60% of halfWidth)
      const progress = (distance - fadeStart) / (halfWidth - fadeStart);
      const factor = Math.max(0, Math.min(1, 1 - progress));
      const scale = factor * factor;

      return {
        opacity: factor,
        transform: [{ scale }],
      };
    }, [tickPosition, halfWidth, index]);

    return (
      <Animated.View
        testID={testID ?? `thumbwheel-tick-${index}`}
        style={[tickStyles.container, animatedStyle]}
      >
        <View
          style={[
            tickStyles.line,
            isMajor ? tickStyles.major : tickStyles.minor,
          ]}
        />
        {isMajor && (
          <Text
            weight="500"
            colorSubtone="800"
            size={11}
            style={tickStyles.label}
          >
            {currentValue}
          </Text>
        )}
      </Animated.View>
    );
  }
);

AnimatedTick.displayName = "AnimatedTick";

const InputThumbwheel: React.FC<InputThumbwheelProps> = React.memo(
  ({ value, onChangeValue, min = 0, max = 200, step = 1, testID }) => {
    const [containerWidth, setContainerWidth] = useState(0);
    const scrollRef = useAnimatedRef<Animated.ScrollView>();

    const safeInitialValue = Math.min(Math.max(value, min), max);
    const initialIndex = Math.round((safeInitialValue - min) / step);

    const scrollX = useSharedValue(initialIndex * TICK_WIDTH);

    const isUserInteracting = useRef(false);
    const isProgrammatic = useRef(false);
    const isInitialMounted = useRef(false);
    const lastReportedIndex = useRef(initialIndex);
    const watchdogTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const { totalTicks, data } = useMemo(
      () => getThumbwheelData(min, max, step),
      [min, max, step]
    );

    const dynamicPadding = useMemo(() => {
      if (containerWidth <= 0) {
        return 0;
      }
      return Math.max(0, containerWidth / 2 - TICK_WIDTH / 2);
    }, [containerWidth]);

    const halfWidth = useMemo(
      () => (containerWidth > 0 ? containerWidth / 2 : 0),
      [containerWidth]
    );

    const handleLayout = useCallback((e: LayoutChangeEvent) => {
      const { width } = e.nativeEvent.layout;
      if (width > 0) {
        setContainerWidth(width);
      }
    }, []);

    const clearWatchdog = useCallback(() => {
      if (watchdogTimerRef.current) {
        clearTimeout(watchdogTimerRef.current);
        watchdogTimerRef.current = null;
      }
    }, []);

    // Settle cleanly on integer mark when momentum or drag ends
    const settleToNearest = useCallback(
      (offsetX: number) => {
        const closestIndex = Math.max(
          0,
          Math.min(Math.round(offsetX / TICK_WIDTH), totalTicks - 1)
        );

        if (closestIndex !== lastReportedIndex.current) {
          lastReportedIndex.current = closestIndex;
          const finalValue = Number((min + closestIndex * step).toFixed(2));
          onChangeValue?.(finalValue);
        }
      },
      [totalTicks, min, step, onChangeValue]
    );

    const resetWatchdog = useCallback(
      (targetOffset: number) => {
        clearWatchdog();
        watchdogTimerRef.current = setTimeout(() => {
          isUserInteracting.current = false;
          watchdogTimerRef.current = null;
          settleToNearest(targetOffset);
        }, 150);
      },
      [clearWatchdog, settleToNearest]
    );

    // Emits discrete integer change back to React runtime
    const emitValueChange = useCallback(
      (newIndex: number) => {
        if (isProgrammatic.current) {
          return;
        }
        if (newIndex !== lastReportedIndex.current) {
          lastReportedIndex.current = newIndex;
          const newValue = Number((min + newIndex * step).toFixed(2));
          onChangeValue?.(newValue);
        }
      },
      [min, step, onChangeValue]
    );

    // Pure 120fps UI runtime scroll tracking: ZERO bridge traffic inside onScroll
    const scrollHandler = useAnimatedScrollHandler({
      onBeginDrag: () => {
        "worklet";
        // User started direct interaction
      },
      onScroll: (event) => {
        "worklet";
        scrollX.set(event.contentOffset.x);
      },
    });

    // Reactive integer change on UI thread: only schedules to RN when integer changes
    useAnimatedReaction(
      () => {
        "worklet";
        const rawIndex = scrollX.get() / TICK_WIDTH;
        return Math.max(0, Math.min(Math.round(rawIndex), totalTicks - 1));
      },
      (currentIndex, previousIndex) => {
        "worklet";
        if (previousIndex !== null && currentIndex !== previousIndex) {
          scheduleOnRN(emitValueChange, currentIndex);
        }
      },
      [totalTicks, emitValueChange]
    );

    // Handle external value changes (e.g. +5, -10 buttons or initial mount)
    useEffect(() => {
      if (isUserInteracting.current || dynamicPadding <= 0) {
        return;
      }

      const safeValue = Math.min(Math.max(value, min), max);
      const targetIndex = Math.round((safeValue - min) / step);

      if (
        isInitialMounted.current &&
        targetIndex === lastReportedIndex.current
      ) {
        return;
      }

      isProgrammatic.current = true;
      lastReportedIndex.current = targetIndex;

      const shouldAnimate = isInitialMounted.current;
      isInitialMounted.current = true;

      scrollRef.current?.scrollTo({
        animated: shouldAnimate,
        x: targetIndex * TICK_WIDTH,
      });

      // Reset programmatic flag after smooth transition finishes
      if (shouldAnimate) {
        const timer = setTimeout(() => {
          isProgrammatic.current = false;
        }, 350);
        return () => clearTimeout(timer);
      }
      isProgrammatic.current = false;
    }, [value, min, max, step, dynamicPadding, scrollRef]);

    useEffect(
      () => () => {
        clearWatchdog();
      },
      [clearWatchdog]
    );

    const handleScrollBeginDrag = useCallback(() => {
      clearWatchdog();
      isUserInteracting.current = true;
      isProgrammatic.current = false;
    }, [clearWatchdog]);

    const handleScrollEndDrag = useCallback(
      (e: NativeSyntheticEvent<NativeScrollEvent>) => {
        clearWatchdog();
        const velocityX = e.nativeEvent.velocity?.x ?? 0;
        const offsetX = e.nativeEvent.contentOffset.x;
        const maxOffset = (totalTicks - 1) * TICK_WIDTH;

        // If drag release was with near-zero velocity, settle immediately
        if (Math.abs(velocityX) < 0.05) {
          isUserInteracting.current = false;
          settleToNearest(offsetX);
          return;
        }

        // Android drops onMomentumScrollEnd when clamping to boundaries (min / max).
        // If released at boundary or heading towards it, arm 150 ms debounce watchdog to release lock.
        const isAtMinBoundary =
          offsetX <= 0 || (offsetX <= TICK_WIDTH && velocityX < 0);
        const isAtMaxBoundary =
          offsetX >= maxOffset ||
          (offsetX >= maxOffset - TICK_WIDTH && velocityX > 0);

        if (isAtMinBoundary || isAtMaxBoundary) {
          const fallbackOffset = isAtMinBoundary ? 0 : maxOffset;
          resetWatchdog(fallbackOffset);
        }
      },
      [clearWatchdog, resetWatchdog, settleToNearest, totalTicks]
    );

    const handleMomentumScrollEnd = useCallback(
      (e: NativeSyntheticEvent<NativeScrollEvent>) => {
        clearWatchdog();
        isUserInteracting.current = false;
        settleToNearest(e.nativeEvent.contentOffset.x);
      },
      [clearWatchdog, settleToNearest]
    );

    // Memoize ticks so React reconciliation takes 0ms when parent re-renders value
    const renderedTicks = useMemo(
      () =>
        data.map((itemIndex) => (
          <AnimatedTick
            key={itemIndex}
            index={itemIndex}
            min={min}
            step={step}
            scrollX={scrollX}
            halfWidth={halfWidth}
          />
        )),
      [data, min, step, scrollX, halfWidth]
    );

    return (
      <View
        style={styles.container}
        testID={testID ?? "thumbwheel-picker"}
        collapsable={false}
        onLayout={handleLayout}
      >
        <View style={styles.centerIndicator} pointerEvents="none" />

        {/* Lateral edge fade masks */}
        <LinearGradient
          colors={[colors.neutral[400], "transparent"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.leftFadeMask}
          pointerEvents="none"
        />
        <LinearGradient
          colors={["transparent", colors.neutral[400]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.rightFadeMask}
          pointerEvents="none"
        />

        {dynamicPadding > 0 && (
          <Animated.ScrollView
            ref={scrollRef}
            testID={`${testID ?? "thumbwheel-picker"}-scroll-view`}
            horizontal
            showsHorizontalScrollIndicator={false}
            nestedScrollEnabled={true}
            snapToInterval={TICK_WIDTH}
            decelerationRate="fast"
            bounces={true}
            overScrollMode="never"
            scrollEventThrottle={1}
            contentContainerStyle={{ paddingHorizontal: dynamicPadding }}
            onScroll={scrollHandler}
            onScrollBeginDrag={handleScrollBeginDrag}
            onScrollEndDrag={handleScrollEndDrag}
            onMomentumScrollEnd={handleMomentumScrollEnd}
          >
            {renderedTicks}
          </Animated.ScrollView>
        )}
      </View>
    );
  }
);

InputThumbwheel.displayName = "InputThumbwheel";

export default InputThumbwheel;

const styles = StyleSheet.create({
  centerIndicator: {
    backgroundColor: colors.red,
    borderRadius: 8,
    height: 48,
    left: "50%",
    marginLeft: -1.5,
    position: "absolute",
    width: 3,
    zIndex: 10,
  },
  container: {
    backgroundColor: colors.neutral[400],
    borderRadius: 16,
    height: 84,
    justifyContent: "center",
    overflow: "hidden",
    position: "relative",
    width: "100%",
  },
  leftFadeMask: {
    bottom: 0,
    left: 0,
    position: "absolute",
    top: 0,
    width: 44,
    zIndex: 5,
  },
  rightFadeMask: {
    bottom: 0,
    position: "absolute",
    right: 0,
    top: 0,
    width: 44,
    zIndex: 5,
  },
});

const tickStyles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 12,
    width: TICK_WIDTH,
  },
  label: {
    bottom: 4,
    fontVariant: ["tabular-nums"],
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
    height: 36,
    width: 2.5,
  },
  minor: {
    backgroundColor: colors.neutral[700],
    height: 22,
    opacity: 0.6,
  },
});
