import type { FC } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import Svg, { Text as SvgText } from "react-native-svg";
import type { FontVariant } from "react-native-svg";

import { colors } from "@/helpers/colors";

export interface MinutesSvgProps {
  fill?: string;
  minutes: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export const MinutesSvg: FC<MinutesSvgProps> = ({
  minutes,
  fill = colors.white,
  style,
  testID = "timer-minutes-svg",
}) => (
  <Svg
    accessibilityLabel={`Minutes: ${minutes}`}
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
      testID="timer-minutes-text"
      textAnchor="middle"
      x="200"
      y="100"
    >
      {minutes}
    </SvgText>
  </Svg>
);
