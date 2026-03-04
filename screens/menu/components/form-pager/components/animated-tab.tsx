import type { SharedValue } from 'react-native-reanimated';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
} from 'react-native-reanimated';
import {
  ICON_SPACE,
  sharedStyles,
} from '@/screens/menu/components/form-pager/shared';

interface AnimatedTabWrapperProps extends React.PropsWithChildren {
  index: number;
  scrollPosition: SharedValue<number>;
  baseWidth: number;
}

export const AnimatedTabWrapper: React.FC<AnimatedTabWrapperProps> = ({
  index,
  scrollPosition,
  baseWidth,
  children,
}) => {
  const animatedWidthStyle = useAnimatedStyle(() => {
    if (!baseWidth) {
      return { width: 0 };
    }
    const extraWidth = interpolate(
      scrollPosition.value,
      [index - 1, index, index + 1],
      [0, ICON_SPACE, 0],
      Extrapolation.CLAMP
    );
    return { width: baseWidth + extraWidth };
  }, [baseWidth, index]);

  return (
    <Animated.View style={[sharedStyles.pillLayout, animatedWidthStyle]}>
      {children}
    </Animated.View>
  );
};
