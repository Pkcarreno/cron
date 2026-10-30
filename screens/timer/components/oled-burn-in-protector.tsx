import type { FC, ReactNode } from "react";
import { useEffect } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { StyleSheet } from "react-native";
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import { colors } from "@/helpers/colors";

/** Default orbital micro-translation cadence in milliseconds (90 seconds). */
export const DEFAULT_ORBITAL_INTERVAL_MS = 90_000;

/**
 * 8-step cyclic orbital coordinate path within ±1–2 px bounds.
 * Periodic micro-translations rotate electrical load across adjacent OLED subpixels.
 */
export const DEFAULT_ORBITAL_COORDINATES: readonly {
  readonly x: number;
  readonly y: number;
}[] = [
  { x: 0, y: 2 },
  { x: 1, y: 1 },
  { x: 2, y: 0 },
  { x: 1, y: -1 },
  { x: 0, y: -2 },
  { x: -1, y: -1 },
  { x: -2, y: 0 },
  { x: -1, y: 1 },
];

export interface OledBurnInProtectorProps {
  children: ReactNode;
  coordinates?: readonly { readonly x: number; readonly y: number }[];
  intervalMs?: number;
  onStepChange?: (
    stepIndex: number,
    coordinate: { readonly x: number; readonly y: number }
  ) => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * Active OLED burn-in protector component.
 * Applies subtle cyclic micro-translations along an 8-step orbital path using critically damped springs.
 */
export const OledBurnInProtector: FC<OledBurnInProtectorProps> = ({
  children,
  coordinates = DEFAULT_ORBITAL_COORDINATES,
  intervalMs = DEFAULT_ORBITAL_INTERVAL_MS,
  onStepChange,
  style,
  testID = "oled-burn-in-protector",
}) => {
  const isReducedMotion = useReducedMotion();
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  useEffect(() => {
    if (isReducedMotion || coordinates.length === 0) {
      translateX.set(0);
      translateY.set(0);
      return;
    }

    let stepIndex = 0;

    const intervalId = setInterval(() => {
      stepIndex = (stepIndex + 1) % coordinates.length;
      const target = coordinates[stepIndex];

      translateX.set(
        withSpring(target.x, {
          dampingRatio: 1,
          duration: 800,
          reduceMotion: ReduceMotion.System,
        })
      );
      translateY.set(
        withSpring(target.y, {
          dampingRatio: 1,
          duration: 800,
          reduceMotion: ReduceMotion.System,
        })
      );

      onStepChange?.(stepIndex, target);
    }, intervalMs);

    return () => {
      clearInterval(intervalId);
    };
  }, [
    coordinates,
    intervalMs,
    isReducedMotion,
    onStepChange,
    translateX,
    translateY,
  ]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.get() },
      { translateY: translateY.get() },
    ],
  }));

  return (
    <Animated.View
      collapsable={false}
      style={[styles.container, style, animatedStyle]}
      testID={testID}
    >
      {children}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.black,
    flex: 1,
  },
});
