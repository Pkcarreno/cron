import type React from "react";
import type { SharedValue } from "react-native-reanimated";
import Animated from "react-native-reanimated";

import { sharedStyles } from "@/screens/menu/components/form-pager/shared";

interface AnimatedTabWrapperProps extends React.PropsWithChildren {
  index: number;
  scrollPosition?: SharedValue<number>;
  baseWidth: number;
}

export const AnimatedTabWrapper: React.FC<AnimatedTabWrapperProps> = ({
  baseWidth,
  children,
}) => (
  <Animated.View
    style={[
      sharedStyles.pillLayout,
      baseWidth > 0 ? { width: baseWidth } : undefined,
    ]}
  >
    {children}
  </Animated.View>
);
