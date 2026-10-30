import type { FC } from "react";
import type { StyleProp, ViewStyle } from "react-native";

import { TimerDigitsSvg } from "@/screens/timer/components/svg/timer-digits-svg";

export interface SecondsSvgProps {
  fill?: string;
  seconds: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export const SecondsSvg: FC<SecondsSvgProps> = ({
  seconds,
  fill,
  style,
  testID = "timer-seconds-svg",
}) => (
  <TimerDigitsSvg
    accessibilityLabel={`Seconds: ${seconds}`}
    digits={seconds}
    fill={fill}
    style={style}
    testID={testID}
    textTestID="timer-seconds-text"
  />
);
