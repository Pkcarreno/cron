import { useAtomValue } from "jotai";
import type { FC } from "react";
import { useEffect } from "react";
import { StyleSheet } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors } from "@/helpers/colors";
import {
  timerCheckpointsLoggedCountAtom,
  timerFlagsAtom,
  timerSuccessfulPausesCountAtom,
} from "@/screens/timer/atoms";

export const AMBIENT_HINT_DISMISS_COUNT = 3;
export const AMBIENT_HINT_DURATION_MS = 3200;

export interface TimerAmbientHintProps {
  maxCheckpointsCount?: number;
  maxPausesCount?: number;
}

export const TimerAmbientHint: FC<TimerAmbientHintProps> = ({
  maxCheckpointsCount = AMBIENT_HINT_DISMISS_COUNT,
  maxPausesCount = AMBIENT_HINT_DISMISS_COUNT,
}) => {
  const insets = useSafeAreaInsets();
  const flags = useAtomValue(timerFlagsAtom);
  const successfulPausesCount = useAtomValue(timerSuccessfulPausesCountAtom);
  const checkpointsLoggedCount = useAtomValue(timerCheckpointsLoggedCountAtom);
  const opacity = useSharedValue(0);

  const needsPauseHint = successfulPausesCount < maxPausesCount;
  const needsCheckpointHint =
    flags.hasCheckpointsBehavior &&
    checkpointsLoggedCount < maxCheckpointsCount;

  const shouldRender = needsPauseHint || needsCheckpointHint;

  useEffect(() => {
    if (!shouldRender) {
      return;
    }

    opacity.set(withTiming(0.8, { duration: 300 }));

    const timer = setTimeout(() => {
      opacity.set(withTiming(0, { duration: 500 }));
    }, AMBIENT_HINT_DURATION_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [opacity, shouldRender]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.get(),
  }));

  if (!shouldRender) {
    return null;
  }

  let hintText = "HOLD ANYWHERE TO PAUSE";
  if (flags.hasCheckpointsBehavior) {
    if (needsPauseHint && needsCheckpointHint) {
      hintText = "HOLD TO PAUSE | DOUBLE-TAP FOR LAP";
    } else if (needsCheckpointHint) {
      hintText = "DOUBLE-TAP TO RECORD LAP";
    }
  }

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.container,
        { bottom: Math.max(insets.bottom, 16) + 16 },
        animatedStyle,
      ]}
      testID="timer-ambient-hint"
    >
      <Animated.Text style={styles.text}>{hintText}</Animated.Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    left: 0,
    position: "absolute",
    right: 0,
  },
  text: {
    color: colors.neutral[500],
    fontFamily: "Geist Mono",
    fontSize: 11,
    letterSpacing: 1.2,
    textAlign: "center",
  },
});
