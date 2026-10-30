import type { FC } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import Svg, { Text as SvgText } from "react-native-svg";
import type { FontVariant } from "react-native-svg";

import { colors } from "@/helpers/colors";

export interface SecondsSvgProps {
  fill?: string;
  seconds: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export const SecondsSvg: FC<SecondsSvgProps> = ({
  seconds,
  fill = colors.white,
  style,
  testID = "timer-seconds-svg",
}) => (
  <Svg
    accessibilityLabel={`Seconds: ${seconds}`}
    height="100%"
    style={style}
    testID={testID}
    viewBox="0 0 400 200"
    width="100%"
  >
    <SvgText
      alignmentBaseline="central"
      fill={fill}
      fontFamily="Geist Mono"
      fontSize={175}
      fontVariant={["tabular-nums"] as unknown as FontVariant}
      fontWeight="700"
      testID="timer-seconds-text"
      textAnchor="middle"
      x="200"
      y="100"
    >
      {seconds}
    </SvgText>
  </Svg>
);
