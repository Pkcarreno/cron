import type { FC } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { SharedValue } from "react-native-reanimated";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors } from "@/helpers/colors";

export interface TimerTapRecoveryPillProps {
  progress: SharedValue<number>;
}

export const TimerTapRecoveryPill: FC<TimerTapRecoveryPillProps> = ({
  progress,
}) => {
  const insets = useSafeAreaInsets();

  const animatedStyle = useAnimatedStyle(() => {
    const val =
      progress.value ??
      (typeof progress.get === "function" ? progress.get() : 0);
    return {
      opacity: val,
      transform: [{ translateY: (1 - val) * -8 }],
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.wrapper, { top: insets.top + 10 }, animatedStyle]}
      testID="timer-tap-recovery-pill"
    >
      <View style={styles.pill}>
        <Text style={styles.text}>Hold to pause</Text>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  pill: {
    backgroundColor: colors.neutral[900],
    borderColor: colors.neutral[800],
    borderRadius: 9999,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 7,
  },
  text: {
    color: colors.neutral[200],
    fontFamily: "Geist Mono",
    fontSize: 12,
    fontWeight: "500",
  },
  wrapper: {
    alignItems: "center",
    left: 0,
    position: "absolute",
    right: 0,
  },
});
