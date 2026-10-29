/* oxlint-disable react/capitalized-calls */
import * as Haptics from "expo-haptics";
import React, { useCallback, useMemo } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { Pressable, StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import type { SharedValue } from "react-native-reanimated";
import Animated, {
  Extrapolation,
  interpolate,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import { Text } from "@/components/text";
import { colors } from "@/helpers/colors";
import { TimerMode } from "@/helpers/timer/factory";

import { TAB_FONT_SIZE } from "./shared";
import type { FormTabOption } from "./types";

/**
 * Precomputed static typography widths derived from Geist 18px medium metrics
 * with 16px total horizontal padding (paddingHorizontal: 8).
 */
export const DEFAULT_TAB_WIDTHS: Record<string, number> = {
  [TimerMode.FOR_TIME]: 105,
  [TimerMode.AMRAP]: 81,
  [TimerMode.INTERVAL]: 103,
  [TimerMode.EMOM]: 73,
  [TimerMode.STOP_WATCH]: 139,
  "FOR TIME": 99,
  "STOP WATCH": 133,
};

export interface TabGeometry {
  center: number;
  offset: number;
  width: number;
}

export const DEFAULT_TAB_GEOMETRIES: Record<TimerMode, TabGeometry> = {
  [TimerMode.FOR_TIME]: { center: 52.5, offset: 0, width: 105 },
  [TimerMode.AMRAP]: { center: 145.5, offset: 105, width: 81 },
  [TimerMode.INTERVAL]: { center: 237.5, offset: 186, width: 103 },
  [TimerMode.EMOM]: { center: 325.5, offset: 289, width: 73 },
  [TimerMode.STOP_WATCH]: { center: 431.5, offset: 362, width: 139 },
};

export const TAB_CONTAINER_HEIGHT = 36;
export const LEFT_INSET = 20;

/**
 * Calculates continuous position [0, count - 1] from a touch X coordinate
 * relative to the tab track using precomputed tab centers.
 */
export const computePositionFromTouchX = (
  touchX: number,
  centers: readonly number[]
): number => {
  "worklet";
  const count = centers.length;
  if (count <= 1) {
    return 0;
  }
  if (touchX <= centers[0]) {
    return 0;
  }
  if (touchX >= centers[count - 1]) {
    return count - 1;
  }
  for (let i = 0; i < count - 1; i += 1) {
    if (touchX >= centers[i] && touchX <= centers[i + 1]) {
      const span = centers[i + 1] - centers[i];
      if (span <= 0) {
        return i;
      }
      return i + (touchX - centers[i]) / span;
    }
  }
  return 0;
};

/**
 * Identifies the tab index corresponding to a discrete touch X coordinate.
 */
export const computeTabIndexFromTouchX = (
  touchX: number,
  offsets: readonly number[],
  widths: readonly number[]
): number => {
  "worklet";
  const count = offsets.length;
  for (let i = 0; i < count; i += 1) {
    if (touchX >= offsets[i] && touchX < offsets[i] + widths[i]) {
      return i;
    }
  }
  if (touchX < offsets[0]) {
    return 0;
  }
  return count - 1;
};

export interface SegmentedTabBarProps<T extends string = string> {
  options: readonly FormTabOption<T>[];
  selectedIndex?: number;
  scrollPosition?: SharedValue<number>;
  onTabPress?: (index: number, option: FormTabOption<T>) => void;
  onValueChange?: (value: T) => void;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

export const SegmentedTabBar = <T extends string>({
  options,
  selectedIndex = 0,
  scrollPosition: externalScrollPosition,
  onTabPress,
  onValueChange,
  testID,
  style,
}: SegmentedTabBarProps<T>) => {
  const internalScrollPosition = useSharedValue(selectedIndex);
  const scrollPosition = externalScrollPosition ?? internalScrollPosition;
  const startScrollPosition = useSharedValue(selectedIndex);

  const geometries: TabGeometry[] = useMemo(() => {
    const list: TabGeometry[] = [];
    let currentOffset = 0;

    for (const option of options) {
      const width =
        DEFAULT_TAB_WIDTHS[option.value] ??
        DEFAULT_TAB_WIDTHS[option.label] ??
        Math.max(64, option.label.length * 10 + 16);

      list.push({
        center: currentOffset + width / 2,
        offset: currentOffset,
        width,
      });

      currentOffset += width;
    }

    return list;
  }, [options]);

  const { indices, offsets, totalWidth, widths } = useMemo(() => {
    const count = geometries.length;
    const safeCount = Math.max(count, 2);
    const ind = Array.from({ length: safeCount }, (_, i) => i);
    const off = geometries.map((g) => g.offset);
    const w = geometries.map((g) => g.width);
    const tot = geometries.reduce((sum, g) => sum + g.width, 0);

    while (off.length < safeCount) {
      off.push(off.at(-1) ?? 0);
      w.push(w.at(-1) ?? 64);
    }

    return {
      indices: ind,
      offsets: off,
      totalWidth: tot,
      widths: w,
    };
  }, [geometries]);

  // Negative offsets translate the track so the active tab stays pinned to the left margin
  const trackTranslations = useMemo(
    () => offsets.map((off) => -off),
    [offsets]
  );

  const activeDetentShared = useSharedValue(selectedIndex);

  const handleCommitChange = useCallback(
    (index: number) => {
      const selectedOption = options[index];
      if (selectedOption) {
        onTabPress?.(index, selectedOption);
        onValueChange?.(selectedOption.value);
      }
    },
    [options, onTabPress, onValueChange]
  );

  const handlePressTab = useCallback(
    (index: number) => {
      scrollPosition.value = withSpring(index, {
        dampingRatio: 1,
        duration: 250,
        reduceMotion: ReduceMotion.System,
      });
      Haptics.selectionAsync();
      handleCommitChange(index);
    },
    [handleCommitChange, scrollPosition]
  );

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-5, 5])
        .onStart(() => {
          "worklet";
          startScrollPosition.value = scrollPosition.value;
          activeDetentShared.value = Math.max(
            0,
            Math.min(options.length - 1, Math.round(scrollPosition.value))
          );
        })
        .onUpdate((event) => {
          "worklet";
          // Direct scrub along the bar: moving finger left brings subsequent tabs to the left margin
          const avgTabWidth = 90;
          const deltaIndex = -event.translationX / avgTabWidth;
          const newPos = Math.max(
            0,
            Math.min(options.length - 1, startScrollPosition.value + deltaIndex)
          );
          scrollPosition.value = newPos;

          const currentDetent = Math.max(
            0,
            Math.min(options.length - 1, Math.round(newPos))
          );
          if (currentDetent !== activeDetentShared.value) {
            activeDetentShared.value = currentDetent;
            scheduleOnRN(Haptics.selectionAsync);
          }
        })
        .onEnd((event) => {
          "worklet";
          const velocityInfluence = -(event.velocityX / 1000) * 0.3;
          const projected = scrollPosition.value + velocityInfluence;
          const targetIndex = Math.max(
            0,
            Math.min(options.length - 1, Math.round(projected))
          );

          scrollPosition.value = withSpring(targetIndex, {
            dampingRatio: 0.8,
            duration: 300,
            reduceMotion: ReduceMotion.System,
            velocity: -event.velocityX / 100,
          });

          scheduleOnRN(handleCommitChange, targetIndex);
        }),
    [
      handleCommitChange,
      options.length,
      scrollPosition,
      activeDetentShared,
      startScrollPosition,
    ]
  );

  const tapGesture = useMemo(
    () =>
      Gesture.Tap()
        .maxDuration(250)
        .onEnd((event) => {
          "worklet";
          const currentShift = interpolate(
            scrollPosition.value,
            indices,
            trackTranslations,
            Extrapolation.CLAMP
          );
          const touchXOnTrack = event.x - LEFT_INSET - currentShift;
          const targetIndex = computeTabIndexFromTouchX(
            touchXOnTrack,
            offsets,
            widths
          );

          scrollPosition.value = withSpring(targetIndex, {
            dampingRatio: 1,
            duration: 250,
            reduceMotion: ReduceMotion.System,
          });

          scheduleOnRN(Haptics.selectionAsync);
          scheduleOnRN(handleCommitChange, targetIndex);
        }),
    [
      handleCommitChange,
      indices,
      offsets,
      scrollPosition,
      trackTranslations,
      widths,
    ]
  );

  const composedGesture = useMemo(
    () => Gesture.Race(panGesture, tapGesture),
    [panGesture, tapGesture]
  );

  // The white pill is pinned to the left margin (LEFT_INSET); its width continuously morphs
  const pillAnimatedStyle = useAnimatedStyle(() => {
    const width = interpolate(
      scrollPosition.value,
      indices,
      widths,
      Extrapolation.CLAMP
    );
    return {
      width,
    };
  });

  // Track translates so the active tab stays pinned to the left margin
  const trackAnimatedStyle = useAnimatedStyle(() => {
    const translateX = interpolate(
      scrollPosition.value,
      indices,
      trackTranslations,
      Extrapolation.CLAMP
    );
    return {
      transform: [{ translateX }],
    };
  });

  return (
    <View style={[styles.outerContainer, style]}>
      {/* Tab bar clipping viewport across the screen with transparent background */}
      <View
        accessible={true}
        role="tablist"
        accessibilityRole="tablist"
        style={styles.viewportContainer}
        testID={testID ?? "segmented-tab-bar"}
      >
        <GestureDetector gesture={composedGesture}>
          <View style={styles.interactiveContainer}>
            {/* Background moving track with rounded corners containing inactive tabs */}
            <Animated.View
              testID="segmented-tab-bar-track"
              style={[
                styles.movingTrack,
                styles.trackBackground,
                { width: totalWidth },
                trackAnimatedStyle,
              ]}
            >
              {options.map((option, index) => {
                const geom = geometries[index];
                return (
                  <View
                    key={`inactive-${option.value}`}
                    style={[
                      styles.tabPill,
                      {
                        left: geom?.offset ?? 0,
                        width: geom?.width ?? 64,
                      },
                    ]}
                  >
                    <Text weight="200" size={TAB_FONT_SIZE} color="neutral">
                      {option.label}
                    </Text>
                  </View>
                );
              })}
            </Animated.View>

            {/* Absolute selection indicator pill pinned to the left margin */}
            <Animated.View
              testID="segmented-tab-bar-pill"
              style={[styles.indicatorPill, pillAnimatedStyle]}
            >
              <Animated.View
                style={[
                  styles.innerActiveTextRow,
                  { width: totalWidth },
                  trackAnimatedStyle,
                ]}
              >
                {options.map((option, index) => {
                  const geom = geometries[index];
                  return (
                    <View
                      key={`active-${option.value}`}
                      style={[
                        styles.tabPill,
                        {
                          left: geom?.offset ?? 0,
                          width: geom?.width ?? 64,
                        },
                      ]}
                    >
                      <Text size={TAB_FONT_SIZE} weight="500" color="black">
                        {option.label}
                      </Text>
                    </View>
                  );
                })}
              </Animated.View>
            </Animated.View>

            {/* Accessible interactive touch targets for screen readers and taps */}
            <Animated.View
              style={[
                styles.movingTrack,
                styles.touchTargetsRow,
                { width: totalWidth },
                trackAnimatedStyle,
              ]}
            >
              {options.map((option, index) => {
                const geom = geometries[index];
                const isSelected = selectedIndex === index;
                return (
                  <Pressable
                    key={`hit-${option.value}`}
                    testID={`menu-tab-${option.value}`}
                    collapsable={false}
                    role="tab"
                    accessibilityRole="tab"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={option.label}
                    onPress={() => handlePressTab(index)}
                    style={[
                      styles.tabPressable,
                      {
                        left: geom?.offset ?? 0,
                        width: geom?.width ?? 64,
                      },
                    ]}
                  />
                );
              })}
            </Animated.View>
          </View>
        </GestureDetector>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  indicatorPill: {
    backgroundColor: colors.white,
    borderRadius: 12,
    bottom: 0,
    left: LEFT_INSET,
    overflow: "hidden",
    position: "absolute",
    top: 0,
    zIndex: 2,
  },
  innerActiveTextRow: {
    height: "100%",
    left: 0,
    position: "absolute",
    top: 0,
  },
  interactiveContainer: {
    height: "100%",
    position: "relative",
    width: "100%",
  },
  movingTrack: {
    height: "100%",
    left: LEFT_INSET,
    position: "absolute",
    top: 0,
  },
  outerContainer: {
    position: "relative",
    width: "100%",
  },
  tabPill: {
    alignItems: "center",
    height: "100%",
    justifyContent: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    position: "absolute",
    top: 0,
  },
  tabPressable: {
    height: "100%",
    position: "absolute",
    top: 0,
  },
  touchTargetsRow: {
    zIndex: 3,
  },
  trackBackground: {
    backgroundColor: colors.neutral[700],
    borderRadius: 12,
    overflow: "hidden",
  },
  viewportContainer: {
    height: TAB_CONTAINER_HEIGHT,
    overflow: "hidden",
    position: "relative",
    width: "100%",
  },
});
