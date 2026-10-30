import type { FC } from "react";
import { StyleSheet } from "react-native";
import type { StyleProp, ViewStyle } from "react-native";
import Svg, { Text as SvgText } from "react-native-svg";
import type { FontVariant } from "react-native-svg";

import { colors } from "@/helpers/colors";
import type { ContextFormatType } from "@/screens/timer/types";

export interface ContextBannerSvgProps {
  label?: ContextFormatType["value"];
  labelColor?: ContextFormatType["color"];
  style?: StyleProp<ViewStyle>;
  testID?: string;
  value?: ContextFormatType["value"];
  valueColor?: ContextFormatType["color"];
}

export const ContextBannerSvg: FC<ContextBannerSvgProps> = ({
  label,
  labelColor = colors.neutral[400],
  value,
  valueColor = colors.neutral[400],
  style,
  testID = "timer-context-banner-svg",
}) => {
  const hasLabel =
    label !== undefined && label !== null && String(label).length > 0;
  const hasValue =
    value !== undefined && value !== null && String(value).length > 0;

  const accessibilityLabel = [
    hasLabel ? String(label) : null,
    hasValue ? String(value) : null,
  ]
    .filter(Boolean)
    .join(" ");

  const combinedStyle = style ? [styles.banner, style] : styles.banner;

  return (
    <Svg
      accessibilityLabel={accessibilityLabel || undefined}
      height="100%"
      style={combinedStyle}
      testID={testID}
      viewBox="0 0 1000 160"
      width="100%"
    >
      {hasLabel ? (
        <SvgText
          alignmentBaseline="central"
          fill={labelColor}
          fontFamily="Geist Mono"
          fontSize={100}
          fontVariant={["tabular-nums"] as unknown as FontVariant}
          fontWeight="900"
          testID="context-banner-label"
          textAnchor="start"
          x="32"
          y="80"
        >
          {String(label)}
        </SvgText>
      ) : null}
      {hasValue ? (
        <SvgText
          alignmentBaseline="central"
          fill={valueColor}
          fontFamily="Geist Mono"
          fontSize={90}
          fontVariant={["tabular-nums"] as unknown as FontVariant}
          fontWeight="400"
          testID="context-banner-value"
          textAnchor="end"
          x="968"
          y="80"
        >
          {String(value)}
        </SvgText>
      ) : null}
    </Svg>
  );
};

const styles = StyleSheet.create({
  banner: {
    aspectRatio: 1000 / 160,
    width: "100%",
  },
});
