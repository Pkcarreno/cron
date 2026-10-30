import type { FC } from "react";
import type { StyleProp, ViewStyle } from "react-native";

import { TimerDigitsSvg } from "@/screens/timer/components/svg/timer-digits-svg";

export interface MinutesSvgProps {
  fill?: string;
  minutes: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export const MinutesSvg: FC<MinutesSvgProps> = ({
  minutes,
  fill,
  style,
  testID = "timer-minutes-svg",
}) => (
  <TimerDigitsSvg
    accessibilityLabel={`Minutes: ${minutes}`}
    digits={minutes}
    fill={fill}
    style={style}
    testID={testID}
    textTestID="timer-minutes-text"
  />
);
