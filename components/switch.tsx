import { useEffect } from 'react';
import * as SwitchPrimitives from '@rn-primitives/switch';
import type { StyleProp, ViewStyle } from 'react-native';
import { StyleSheet } from 'react-native';
import {
  createAnimatedComponent,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import type { Ref } from 'react';
import { colors } from '@/helpers/colors';

interface SwitchProps extends SwitchPrimitives.RootProps {
  style?: StyleProp<ViewStyle>;
  ref?: Ref<SwitchPrimitives.RootRef>;
}

const AnimatedRoot = createAnimatedComponent(SwitchPrimitives.Root);
const AnimatedThumb = createAnimatedComponent(SwitchPrimitives.Thumb);

export const Switch = ({ style, ref, ...props }: SwitchProps) => {
  const progress = useSharedValue(props.checked ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(props.checked ? 1 : 0, { duration: 150 });
  }, [props.checked, progress]);

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

  return (
    <AnimatedRoot
      ref={ref}
      style={[
        styles.root,
        props.disabled && styles.disabled,
        rootAnimatedStyle,
        style,
      ]}
      {...props}
    >
      <AnimatedThumb style={[styles.thumb, thumbAnimatedStyle]} />
    </AnimatedRoot>
  );
};

const styles = StyleSheet.create({
  disabled: {
    opacity: 0.5,
  },
  root: {
    alignItems: 'center',
    borderColor: colors.transparent,
    borderRadius: 9999,
    borderWidth: 1,
    display: 'flex',
    elevation: 2,
    flexDirection: 'row',
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
