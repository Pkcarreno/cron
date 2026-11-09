import type { FC } from "react";
import Svg, { Polyline } from "react-native-svg";

import type { IconProps } from "./types";

export const CaretRightIcon: FC<IconProps> = ({
  color = "currentColor",
  size = 24,
  ...props
}) => (
  <Svg width={size} height={size} viewBox="0 0 256 256" fill="none" {...props}>
    <Polyline
      points="96 48 176 128 96 208"
      fill="none"
      stroke={color}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={16}
    />
  </Svg>
);
