import type { StyleProp, ViewStyle } from "react-native";
import type { SvgProps } from "react-native-svg";

export interface IconProps extends Omit<
  SvgProps,
  "color" | "width" | "height"
> {
  color?: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
}
