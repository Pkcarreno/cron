import type { FC } from "react";
import { StyleSheet, View } from "react-native";
import type { StyleProp, ViewStyle } from "react-native";
import Svg, { Text as SvgText } from "react-native-svg";
import type { FontVariant } from "react-native-svg";

import { colors } from "@/helpers/colors";

export interface TimerDigitsSvgProps {
  accessibilityLabel: string;
  digits: string;
  fill?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  textTestID?: string;
}

export const TimerDigitsSvg: FC<TimerDigitsSvgProps> = ({
  accessibilityLabel,
  digits,
  fill = colors.white,
  style,
  testID = "timer-digits-svg",
  textTestID = "timer-digits-text",
}) => (
  <View style={style ? [styles.container, style] : styles.container}>
    <Svg
      accessibilityLabel={accessibilityLabel}
      height="100%"
      preserveAspectRatio="xMidYMid meet"
      testID={testID}
      viewBox="0 0 260 190"
      width="100%"
    >
      <SvgText
        alignmentBaseline="central"
        fill={fill}
        fontFamily="Geist Mono"
        fontSize={210}
        fontVariant={["tabular-nums"] as unknown as FontVariant}
        fontWeight="700"
        testID={textTestID}
        textAnchor="middle"
        x="130"
        y="95"
      >
        {digits}
      </SvgText>
    </Svg>
  </View>
);

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    height: "100%",
    justifyContent: "center",
    width: "100%",
  },
});
