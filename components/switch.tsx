import type { ComponentRef } from "react";
import { useCallback, useEffect } from "react";
import type {
  GestureResponderEvent,
  PressableProps,
  StyleProp,
  ViewStyle,
} from "react-native";
import { Pressable, StyleSheet } from "react-native";
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { colors } from "@/helpers/colors";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface SwitchProps extends Omit<
  PressableProps,
  "style" | "onPress" | "children"
> {
  checked: boolean;
  onCheckedChange?: (checked: boolean) => void;
  style?: StyleProp<ViewStyle>;
  ref?: React.Ref<ComponentRef<typeof Pressable>>;
}

export const Switch = ({
  checked,
  onCheckedChange,
  disabled,
  style,
  ref,
  accessibilityRole = "switch",
  accessibilityState,
  ...props
}: SwitchProps) => {
  const progress = useSharedValue(checked ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(checked ? 1 : 0, { duration: 150 });
  }, [checked, progress]);

  const rootAnimatedStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      [colors.neutral[500], colors.green]
    ),
  }));

  const thumbAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * 14 }],
  }));

  const handlePress = useCallback(
    (_event: GestureResponderEvent) => {
      if (disabled) {
        return;
      }
      onCheckedChange?.(!checked);
    },
    [checked, disabled, onCheckedChange]
  );

  return (
    <AnimatedPressable
      ref={ref}
      accessibilityRole={accessibilityRole}
      accessibilityState={{
        checked,
        disabled: Boolean(disabled),
        ...accessibilityState,
      }}
      aria-checked={checked}
      aria-disabled={Boolean(disabled)}
      disabled={disabled}
      onPress={handlePress}
      role="switch"
      style={[
        styles.root,
        disabled && styles.disabled,
        rootAnimatedStyle,
        style,
      ]}
      {...props}
    >
      <Animated.View style={[styles.thumb, thumbAnimatedStyle]} />
    </AnimatedPressable>
  );
};

const styles = StyleSheet.create({
  disabled: {
    opacity: 0.5,
  },
  root: {
    alignItems: "center",
    borderColor: colors.transparent,
    borderRadius: 9999,
    borderWidth: 1,
    display: "flex",
    elevation: 2,
    flexDirection: "row",
    flexShrink: 0,
    height: 18.4,
    shadowColor: colors.neutral[500],
    shadowOffset: { height: 1, width: 0 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    width: 32,
  },
  thumb: {
    backgroundColor: colors.neutral[100],
    borderRadius: 9999,
    height: 16,
    width: 16,
  },
});
