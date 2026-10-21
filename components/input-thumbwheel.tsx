import { AndroidHaptics, ImpactFeedbackStyle } from "expo-haptics";
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
import { Platform, StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, {
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

const NEEDLE_SPRING_CONFIG = {
  dampingRatio: 0.8,
  duration: 250,
  reduceMotion: ReduceMotion.System,
};

export const getIndexForOffset = (
  offset: number,
  _width?: number,
  totalTicks?: number
) => {
  "worklet";
  if (!Number.isFinite(offset)) {
    return 0;
  }
  const rawIndex = Math.round(offset / TICK_WIDTH);
  if (totalTicks !== undefined && Number.isFinite(totalTicks)) {
    return Math.max(0, Math.min(rawIndex, totalTicks - 1));
  }
  return Math.max(0, rawIndex);
};

export const getOffsetForIndex = (index: number, _width?: number) => {
  "worklet";
  if (!Number.isFinite(index)) {
    return 0;
  }
  return index * TICK_WIDTH;
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
      <View style={styles.strip}>
        {ticks.map((index) => (
          <Tick index={index} key={index} min={min} step={step} />
        ))}
      </View>
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
  const { width: windowWidth } = useWindowDimensions();
  // Assume default sheet horizontal padding of 40 (20 on each side)
  const [containerWidth, setContainerWidth] = useState(() =>
    Math.max(100, windowWidth - 40)
  );

  const totalTicks = useMemo(
    () => Math.floor((max - min) / step) + 1,
    [max, min, step]
  );

  const initialIndex = useMemo(() => {
    const clamped = Math.max(min, Math.min(max, value));
    return Math.round((clamped - min) / step);
  }, [value, min, max, step]);

  const scrollViewRef = useRef<Animated.ScrollView>(null);
  const isMountedRef = useRef(false);

  // Track scroll position and index in refs to avoid redundant re-renders
  const lastOffsetRef = useRef(initialIndex * TICK_WIDTH);
  const lastReportedIndexRef = useRef(initialIndex);
  const lastNotifiedValueRef = useRef(value);
  const lastHapticTimeRef = useRef(0);

  // Needle tactile spring scale
  const needleScale = useSharedValue(1);

  // Batch React state updates with requestAnimationFrame during rapid scroll
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

  const handleLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const { width } = e.nativeEvent.layout;
      if (width > 0 && Math.abs(width - containerWidth) > 0.5) {
        setContainerWidth(width);
      }
    },
    [containerWidth]
  );

  // Trale lead/trail padding: exactly centers index 0 at offset 0 and final index at max offset
  const leadTrailPad = Math.max(0, (containerWidth - TICK_WIDTH) / 2);

  const initialContentOffset = useMemo(
    () => ({ x: initialIndex * TICK_WIDTH, y: 0 }),
    [initialIndex]
  );

  // Synchronize when value changes externally (e.g. steppers, direct typing)
  useEffect(() => {
    if (!isMountedRef.current) {
      isMountedRef.current = true;
      return;
    }
    // Prevent feedback loop when value change was emitted by thumbwheel scroll
    if (value === lastNotifiedValueRef.current) {
      return;
    }
    lastNotifiedValueRef.current = value;

    const targetIndex = Math.max(
      0,
      Math.min(Math.round((value - min) / step), totalTicks - 1)
    );
    lastReportedIndexRef.current = targetIndex;
    const targetOffset = targetIndex * TICK_WIDTH;

    const currentOffset = lastOffsetRef.current;
    const distanceInTicks = Math.abs(targetOffset - currentOffset) / TICK_WIDTH;
    const shouldAnimate = distanceInTicks <= 40;

    scrollViewRef.current?.scrollTo({
      animated: shouldAnimate,
      x: targetOffset,
    });
  }, [value, min, step, totalTicks]);

  useEffect(
    () => () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    },
    []
  );

  const handleScrollBeginDrag = useCallback(() => {
    needleScale.value = withSpring(1.15, NEEDLE_SPRING_CONFIG);
  }, [needleScale]);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetX = event.nativeEvent.contentOffset.x;
      lastOffsetRef.current = offsetX;
      const rawIndex = Math.round(offsetX / TICK_WIDTH);
      const currentIndex = Math.max(0, Math.min(totalTicks - 1, rawIndex));

      if (currentIndex !== lastReportedIndexRef.current) {
        lastReportedIndexRef.current = currentIndex;
        playHaptic(currentIndex);
        scheduleNotify(min + currentIndex * step);
      }
    },
    [min, playHaptic, scheduleNotify, step, totalTicks]
  );

  const handleScrollEndDrag = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const velocityX = Math.abs(event.nativeEvent.velocity?.x ?? 0);
      // If velocity is negligible, momentum scroll will not fire, so settle immediately
      if (velocityX < 0.05) {
        needleScale.value = withSpring(1, NEEDLE_SPRING_CONFIG);
        if (rafIdRef.current !== null) {
          cancelAnimationFrame(rafIdRef.current);
          rafIdRef.current = null;
        }
        const offsetX = event.nativeEvent.contentOffset.x;
        lastOffsetRef.current = offsetX;
        const rawIndex = Math.round(offsetX / TICK_WIDTH);
        const finalIndex = Math.max(0, Math.min(totalTicks - 1, rawIndex));
        if (finalIndex !== lastReportedIndexRef.current) {
          lastReportedIndexRef.current = finalIndex;
          playHaptic(finalIndex);
        }
        const finalValue = min + finalIndex * step;
        notifyChange(finalValue);
      }
    },
    [min, needleScale, notifyChange, playHaptic, step, totalTicks]
  );

  const handleMomentumScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      needleScale.value = withSpring(1, NEEDLE_SPRING_CONFIG);
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      const offsetX = event.nativeEvent.contentOffset.x;
      lastOffsetRef.current = offsetX;
      const rawIndex = Math.round(offsetX / TICK_WIDTH);
      const finalIndex = Math.max(0, Math.min(totalTicks - 1, rawIndex));
      if (finalIndex !== lastReportedIndexRef.current) {
        lastReportedIndexRef.current = finalIndex;
        playHaptic(finalIndex);
      }
      const finalValue = min + finalIndex * step;
      notifyChange(finalValue);
    },
    [min, needleScale, notifyChange, playHaptic, step, totalTicks]
  );

  const handleAccessibilityAction = useCallback(
    (event: { nativeEvent: { actionName: string } }) => {
      const currentVal = value;
      let nextVal = currentVal;
      if (event.nativeEvent.actionName === "increment") {
        nextVal = Math.min(max, currentVal + step);
      } else if (event.nativeEvent.actionName === "decrement") {
        nextVal = Math.max(min, currentVal - step);
      }
      if (nextVal === currentVal) {
        notifyChange(nextVal);
      } else {
        lastNotifiedValueRef.current = nextVal;
        const targetIndex = Math.round((nextVal - min) / step);
        lastReportedIndexRef.current = targetIndex;
        playHaptic(targetIndex);
        notifyChange(nextVal);
        scrollViewRef.current?.scrollTo({
          animated: true,
          x: targetIndex * TICK_WIDTH,
        });
      }
    },
    [value, min, max, step, notifyChange, playHaptic]
  );

  const needleAnimatedStyle = useAnimatedStyle(() => {
    "worklet";
    return {
      transform: [{ scaleY: needleScale.value }],
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
    >
      <Animated.ScrollView
        bounces={true}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingHorizontal: leadTrailPad },
        ]}
        contentOffset={initialContentOffset}
        decelerationRate="fast"
        disableIntervalMomentum={false}
        horizontal={true}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        onScroll={handleScroll}
        onScrollBeginDrag={handleScrollBeginDrag}
        onScrollEndDrag={handleScrollEndDrag}
        overScrollMode="never"
        ref={scrollViewRef}
        scrollEventThrottle={16}
        showsHorizontalScrollIndicator={false}
        snapToAlignment="start"
        snapToInterval={TICK_WIDTH}
        style={styles.scrollView}
      >
        <TickStrip max={max} min={min} step={step} totalTicks={totalTicks} />
      </Animated.ScrollView>

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
  scrollContent: {
    alignItems: "center",
    height: "100%",
  },
  scrollView: {
    height: "100%",
    width: "100%",
  },
  strip: {
    alignItems: "center",
    flexDirection: "row",
    height: "100%",
  },
});
