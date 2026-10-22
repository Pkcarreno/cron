import type React from "react";
import { View } from "react-native";

import {
  ICON_SPACE,
  sharedStyles,
} from "@/screens/menu/components/form-pager/shared";

interface AnimatedTabWrapperProps extends React.PropsWithChildren {
  index: number;
  baseWidth: number;
}

export const AnimatedTabWrapper: React.FC<AnimatedTabWrapperProps> = ({
  baseWidth,
  children,
}) => (
  <View
    style={[
      sharedStyles.pillLayout,
      baseWidth > 0 ? { width: baseWidth + ICON_SPACE } : undefined,
    ]}
  >
    {children}
  </View>
);
