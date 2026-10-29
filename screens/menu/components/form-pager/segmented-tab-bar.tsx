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
 * with 16px total horizontal padding (paddingHorizontal: 8) plus safety margin
 * to prevent subpixel text truncation and line wrapping on high-density displays.
 */
export const DEFAULT_TAB_WIDTHS: Record<string, number> = {
  [TimerMode.FOR_TIME]: 110,
  [TimerMode.AMRAP]: 86,
  [TimerMode.INTERVAL]: 109,
  [TimerMode.EMOM]: 78,
  [TimerMode.STOP_WATCH]: 145,
  "FOR TIME": 104,
  "STOP WATCH": 140,
};

export interface TabGeometry {
  center: number;
  offset: number;
  width: number;
}

export const DEFAULT_TAB_GEOMETRIES: Record<TimerMode, TabGeometry> = {
  [TimerMode.FOR_TIME]: { center: 55, offset: 0, width: 110 },
  [TimerMode.AMRAP]: { center: 153, offset: 110, width: 86 },
  [TimerMode.INTERVAL]: { center: 250.5, offset: 196, width: 109 },
  [TimerMode.EMOM]: { center: 344, offset: 305, width: 78 },
  [TimerMode.STOP_WATCH]: { center: 455.5, offset: 383, width: 145 },
};

export const TAB_CONTAINER_HEIGHT = 36;
export const LEFT_INSET = 20;

/**
 * Calculates continuous position [0, count - 1] from a touch X coordinate
 * relative to the tab track using precomputed tab centers.
 */
export const computePositionFromTouchX = (
  touchPositionX: number,
  tabCenters: readonly number[]
): number => {
  "worklet";
  const centerCount = tabCenters.length;
  if (centerCount <= 1) {
    return 0;
  }
  if (touchPositionX <= tabCenters[0]) {
    return 0;
  }
  if (touchPositionX >= tabCenters[centerCount - 1]) {
    return centerCount - 1;
  }
  for (let i = 0; i < centerCount - 1; i += 1) {
    if (
      touchPositionX >= tabCenters[i] &&
      touchPositionX <= tabCenters[i + 1]
    ) {
      const distanceBetweenCenters = tabCenters[i + 1] - tabCenters[i];
      if (distanceBetweenCenters <= 0) {
        return i;
      }
      return i + (touchPositionX - tabCenters[i]) / distanceBetweenCenters;
    }
  }
  return 0;
};

/**
 * Identifies the tab index corresponding to a discrete touch X coordinate.
 */
export const computeTabIndexFromTouchX = (
  touchPositionX: number,
  tabOffsets: readonly number[],
  tabWidths: readonly number[]
): number => {
  "worklet";
  const count = tabOffsets.length;
  for (let i = 0; i < count; i += 1) {
    if (
      touchPositionX >= tabOffsets[i] &&
      touchPositionX < tabOffsets[i] + tabWidths[i]
    ) {
      return i;
    }
  }
  if (touchPositionX < tabOffsets[0]) {
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
  const startTrackOffsetShared = useSharedValue(0);

  const calculatedGeometries: TabGeometry[] = useMemo(() => {
    const tabGeometries: TabGeometry[] = [];
    let currentOffset = 0;

    for (const option of options) {
      const width =
        DEFAULT_TAB_WIDTHS[option.value] ??
        DEFAULT_TAB_WIDTHS[option.label] ??
        Math.max(64, option.label.length * 10 + 16);

      tabGeometries.push({
        center: currentOffset + width / 2,
        offset: currentOffset,
        width,
      });

      currentOffset += width;
    }

    return tabGeometries;
  }, [options]);

  const { tabIndices, tabOffsets, totalTrackWidth, tabWidths } = useMemo(() => {
    const count = calculatedGeometries.length;
    const safeCount = Math.max(count, 2);
    const indicesList = Array.from({ length: safeCount }, (_, index) => index);
    const offsetsList = calculatedGeometries.map((geometry) => geometry.offset);
    const widthsList = calculatedGeometries.map((geometry) => geometry.width);
    const totalWidthValue = calculatedGeometries.reduce(
      (accumulatedWidth, geometry) => accumulatedWidth + geometry.width,
      0
    );

    while (offsetsList.length < safeCount) {
      offsetsList.push(offsetsList.at(-1) ?? 0);
      widthsList.push(widthsList.at(-1) ?? 64);
    }

    return {
      tabIndices: indicesList,
      tabOffsets: offsetsList,
      tabWidths: widthsList,
      totalTrackWidth: totalWidthValue,
    };
  }, [calculatedGeometries]);

  // Negative offsets translate the track so the active tab stays pinned to the left margin
  const trackTranslations = useMemo(
    () => tabOffsets.map((offset) => -offset),
    [tabOffsets]
  );

  const activeDetentIndexShared = useSharedValue(selectedIndex);

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
          startTrackOffsetShared.value = interpolate(
            scrollPosition.value,
            tabIndices,
            tabOffsets,
            Extrapolation.CLAMP
          );
          activeDetentIndexShared.value = Math.max(
            0,
            Math.min(options.length - 1, Math.round(scrollPosition.value))
          );
        })
        .onUpdate((event) => {
          "worklet";
          // Moving finger left scrubs forward along the tab track without geometry drift
          const targetTrackOffset =
            startTrackOffsetShared.value - event.translationX;
          const nextScrollPosition = interpolate(
            targetTrackOffset,
            tabOffsets,
            tabIndices,
            Extrapolation.CLAMP
          );
          scrollPosition.value = nextScrollPosition;

          const currentDetentIndex = Math.max(
            0,
            Math.min(options.length - 1, Math.round(nextScrollPosition))
          );
          if (currentDetentIndex !== activeDetentIndexShared.value) {
            activeDetentIndexShared.value = currentDetentIndex;
            scheduleOnRN(Haptics.selectionAsync);
          }
        })
        .onEnd((event) => {
          "worklet";
          const currentTrackOffset = interpolate(
            scrollPosition.value,
            tabIndices,
            tabOffsets,
            Extrapolation.CLAMP
          );
          // Velocity influence projected in track pixel space, then mapped to resting index
          const velocityPixelOffset = -(event.velocityX / 1000) * 30;
          const projectedTrackOffset = currentTrackOffset + velocityPixelOffset;
          const projectedScrollPosition = interpolate(
            projectedTrackOffset,
            tabOffsets,
            tabIndices,
            Extrapolation.CLAMP
          );
          const targetTabIndex = Math.max(
            0,
            Math.min(options.length - 1, Math.round(projectedScrollPosition))
          );

          scrollPosition.value = withSpring(targetTabIndex, {
            dampingRatio: 0.8,
            duration: 300,
            reduceMotion: ReduceMotion.System,
            velocity: -event.velocityX / 100,
          });

          scheduleOnRN(handleCommitChange, targetTabIndex);
        }),
    [
      handleCommitChange,
      options.length,
      scrollPosition,
      activeDetentIndexShared,
      startTrackOffsetShared,
      tabIndices,
      tabOffsets,
    ]
  );

  const tapGesture = useMemo(
    () =>
      Gesture.Tap()
        .maxDuration(250)
        .onEnd((event) => {
          "worklet";
          const currentTrackTranslationX = interpolate(
            scrollPosition.value,
            tabIndices,
            trackTranslations,
            Extrapolation.CLAMP
          );
          const touchTrackCoordinateX =
            event.x - LEFT_INSET - currentTrackTranslationX;
          const targetTabIndex = computeTabIndexFromTouchX(
            touchTrackCoordinateX,
            tabOffsets,
            tabWidths
          );

          scrollPosition.value = withSpring(targetTabIndex, {
            dampingRatio: 1,
            duration: 250,
            reduceMotion: ReduceMotion.System,
          });

          scheduleOnRN(Haptics.selectionAsync);
          scheduleOnRN(handleCommitChange, targetTabIndex);
        }),
    [
      handleCommitChange,
      tabIndices,
      tabOffsets,
      scrollPosition,
      trackTranslations,
      tabWidths,
    ]
  );

  const composedGesture = useMemo(
    () => Gesture.Race(panGesture, tapGesture),
    [panGesture, tapGesture]
  );

  // The white pill is pinned to the left margin (LEFT_INSET); its width continuously morphs
  const pillAnimatedStyle = useAnimatedStyle(() => {
    const indicatorPillWidth = interpolate(
      scrollPosition.value,
      tabIndices,
      tabWidths,
      Extrapolation.CLAMP
    );
    return {
      width: indicatorPillWidth,
    };
  });

  // Track translates so the active tab stays pinned to the left margin
  const trackAnimatedStyle = useAnimatedStyle(() => {
    const trackTranslateX = interpolate(
      scrollPosition.value,
      tabIndices,
      trackTranslations,
      Extrapolation.CLAMP
    );
    return {
      transform: [{ translateX: trackTranslateX }],
    };
  });

  return (
    <View style={[styles.outerContainer, style]}>
      {/* Tab bar clipping viewport across the screen with transparent background */}
      <View
        accessible={true}
        collapsable={false}
        role="tablist"
        accessibilityRole="tablist"
        style={styles.viewportContainer}
        testID={testID ?? "segmented-tab-bar"}
      >
        <GestureDetector gesture={composedGesture}>
          <View style={styles.interactiveContainer}>
            {/* Background moving track with rounded corners containing inactive tabs */}
            <Animated.View
              collapsable={false}
              testID="segmented-tab-bar-track"
              style={[
                styles.movingTrack,
                styles.trackBackground,
                { width: totalTrackWidth },
                trackAnimatedStyle,
              ]}
            >
              {options.map((option, index) => {
                const geom = calculatedGeometries[index];
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
                    <Text
                      weight="200"
                      size={TAB_FONT_SIZE}
                      color="neutral"
                      numberOfLines={1}
                    >
                      {option.label}
                    </Text>
                  </View>
                );
              })}
            </Animated.View>

            {/* Absolute selection indicator pill pinned to the left margin */}
            <Animated.View
              collapsable={false}
              testID="segmented-tab-bar-pill"
              style={[styles.indicatorPill, pillAnimatedStyle]}
            >
              <Animated.View
                style={[
                  styles.innerActiveTextRow,
                  { width: totalTrackWidth },
                  trackAnimatedStyle,
                ]}
              >
                {options.map((option, index) => {
                  const geom = calculatedGeometries[index];
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
                      <Text
                        size={TAB_FONT_SIZE}
                        weight="500"
                        color="black"
                        numberOfLines={1}
                      >
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
                { width: totalTrackWidth },
                trackAnimatedStyle,
              ]}
            >
              {options.map((option, index) => {
                const geom = calculatedGeometries[index];
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
