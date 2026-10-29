/* oxlint-disable react/capitalized-calls */
import * as Haptics from "expo-haptics";
import React, { useCallback, useMemo } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { Dimensions, Pressable, StyleSheet, View } from "react-native";
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
  containerWidth?: number;
}

export const SegmentedTabBar = <T extends string>({
  options,
  selectedIndex = 0,
  scrollPosition: externalScrollPosition,
  onTabPress,
  onValueChange,
  testID,
  style,
  containerWidth: externalContainerWidth,
}: SegmentedTabBarProps<T>) => {
  const defaultContainerWidth = useMemo(() => {
    try {
      return Dimensions.get("window").width - 40;
    } catch {
      return 350;
    }
  }, []);

  const containerWidth = externalContainerWidth ?? defaultContainerWidth;

  const internalScrollPosition = useSharedValue(selectedIndex);
  const scrollPosition = externalScrollPosition ?? internalScrollPosition;

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

  const { centers, indices, offsets, totalWidth, widths } = useMemo(() => {
    const count = geometries.length;
    const safeCount = Math.max(count, 2);
    const ind = Array.from({ length: safeCount }, (_, i) => i);
    const off = geometries.map((g) => g.offset);
    const w = geometries.map((g) => g.width);
    const c = geometries.map((g) => g.center);
    const tot = geometries.reduce((sum, g) => sum + g.width, 0);

    while (off.length < safeCount) {
      off.push(off.at(-1) ?? 0);
      w.push(w.at(-1) ?? 64);
      c.push(c.at(-1) ?? 32);
    }

    return {
      centers: c,
      indices: ind,
      offsets: off,
      totalWidth: tot,
      widths: w,
    };
  }, [geometries]);

  const trackShifts = useMemo(() => {
    if (totalWidth <= containerWidth) {
      return indices.map(() => 0);
    }
    const maxShift = -(totalWidth - containerWidth);
    return geometries.map((geom) => {
      const desiredShift = containerWidth / 2 - geom.center;
      return Math.max(maxShift, Math.min(0, desiredShift));
    });
  }, [containerWidth, totalWidth, indices, geometries]);

  const safeTrackShifts = useMemo(() => {
    const list = [...trackShifts];
    while (list.length < indices.length) {
      list.push(list.at(-1) ?? 0);
    }
    return list;
  }, [trackShifts, indices.length]);

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
          activeDetentShared.value = Math.max(
            0,
            Math.min(options.length - 1, Math.round(scrollPosition.value))
          );
        })
        .onUpdate((event) => {
          "worklet";
          const newPos = computePositionFromTouchX(event.x, centers);
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
          const velocityInfluence = (event.velocityX / 1000) * 0.4;
          const projected = scrollPosition.value + velocityInfluence;
          const targetIndex = Math.max(
            0,
            Math.min(options.length - 1, Math.round(projected))
          );

          scrollPosition.value = withSpring(targetIndex, {
            dampingRatio: 0.8,
            duration: 300,
            reduceMotion: ReduceMotion.System,
            velocity: event.velocityX / 100,
          });

          scheduleOnRN(handleCommitChange, targetIndex);
        }),
    [
      centers,
      handleCommitChange,
      options.length,
      scrollPosition,
      activeDetentShared,
    ]
  );

  const tapGesture = useMemo(
    () =>
      Gesture.Tap()
        .maxDuration(250)
        .onEnd((event) => {
          "worklet";
          const targetIndex = computeTabIndexFromTouchX(
            event.x,
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
    [handleCommitChange, offsets, scrollPosition, widths]
  );

  const composedGesture = useMemo(
    () => Gesture.Race(panGesture, tapGesture),
    [panGesture, tapGesture]
  );

  const pillAnimatedStyle = useAnimatedStyle(() => {
    const translateX = interpolate(
      scrollPosition.value,
      indices,
      offsets,
      Extrapolation.CLAMP
    );
    const width = interpolate(
      scrollPosition.value,
      indices,
      widths,
      Extrapolation.CLAMP
    );
    return {
      transform: [{ translateX }],
      width,
    };
  });

  const innerTextRowAnimatedStyle = useAnimatedStyle(() => {
    const translateX = interpolate(
      scrollPosition.value,
      indices,
      offsets,
      Extrapolation.CLAMP
    );
    return {
      transform: [{ translateX: -translateX }],
    };
  });

  const trackAnimatedStyle = useAnimatedStyle(() => {
    if (totalWidth <= containerWidth) {
      return { transform: [{ translateX: 0 }] };
    }
    const translateX = interpolate(
      scrollPosition.value,
      indices,
      safeTrackShifts,
      Extrapolation.CLAMP
    );
    return {
      transform: [{ translateX }],
    };
  });

  return (
    <View style={[styles.outerContainer, style]}>
      <View
        accessible={true}
        role="tablist"
        accessibilityRole="tablist"
        style={[styles.trackClippingContainer, { width: containerWidth }]}
        testID={testID ?? "segmented-tab-bar"}
      >
        <GestureDetector gesture={composedGesture}>
          <Animated.View
            style={[
              styles.movingTrack,
              { width: totalWidth },
              trackAnimatedStyle,
            ]}
          >
            {/* Background inactive track */}
            <View style={[styles.staticTrackRow, { width: totalWidth }]}>
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
            </View>

            {/* Absolute selection indicator pill with pure 1:1 linear tracking */}
            <Animated.View
              testID="segmented-tab-bar-pill"
              style={[styles.indicatorPill, pillAnimatedStyle]}
            >
              <Animated.View
                style={[
                  styles.innerActiveTextRow,
                  { width: totalWidth },
                  innerTextRowAnimatedStyle,
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
            <View
              style={[
                styles.staticTrackRow,
                styles.touchTargetsRow,
                { width: totalWidth },
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
            </View>
          </Animated.View>
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
    left: 0,
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
  movingTrack: {
    backgroundColor: colors.neutral[700],
    borderRadius: 12,
    height: TAB_CONTAINER_HEIGHT,
    position: "relative",
  },
  outerContainer: {
    marginHorizontal: 20,
    position: "relative",
  },
  staticTrackRow: {
    height: "100%",
    left: 0,
    position: "absolute",
    top: 0,
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
  trackClippingContainer: {
    height: TAB_CONTAINER_HEIGHT,
    overflow: "hidden",
    position: "relative",
  },
});
