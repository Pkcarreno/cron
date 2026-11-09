import type { FC } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import Svg, { Path } from "react-native-svg";
import type { SvgProps } from "react-native-svg";

export interface LogoProps extends Omit<
  SvgProps,
  "color" | "width" | "height"
> {
  color?: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
}

export const Logo: FC<LogoProps> = ({
  color = "#ffffff",
  size = 24,
  ...props
}) => (
  <Svg
    width={size}
    height={size}
    viewBox="0 0 27 27.525"
    fill="none"
    {...props}
  >
    <Path
      d="M 13.5 20.925 L 9.45 27.525 L 3.3 23.85 L 7.65 17.625 L 0 17.7 L 0 9.825 L 7.65 9.9 L 3.3 3.675 L 9.45 0 L 13.5 6.675 L 17.55 0 L 23.7 3.675 L 19.35 9.9 L 27 9.825 L 27 17.7 L 19.35 17.625 L 23.7 23.85 L 17.55 27.525 L 13.5 20.925 Z"
      fill={color}
      fillRule="nonzero"
      stroke={color}
      strokeLinecap="round"
      strokeWidth={0.5}
    />
  </Svg>
);
