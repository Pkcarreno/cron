import { useAtomValue } from "jotai";
import type { FC } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors } from "@/helpers/colors";
import { timerModeAbbrAtom } from "@/screens/timer/atoms";
import { LocalClock } from "@/screens/timer/components/local-clock";

export interface TimerHeaderProps {
  style?: StyleProp<ViewStyle>;
}

export const TimerHeader: FC<TimerHeaderProps> = ({ style }) => {
  const insets = useSafeAreaInsets();
  const modeAbbr = useAtomValue(timerModeAbbrAtom);

  return (
    <View
      style={[
        statusBarStyles.container,
        {
          height: insets.top,
          paddingLeft: insets.left,
          paddingRight: insets.right,
        },
        style,
      ]}
    >
      <View style={statusBarStyles.leftWrapper}>
        <Text style={statusBarStyles.text}>{modeAbbr}</Text>
      </View>
      <View style={statusBarStyles.rightWrapper}>
        <LocalClock style={statusBarStyles.localTimeText} />
      </View>
    </View>
  );
};

const statusBarStyles = StyleSheet.create({
  container: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-around",
    width: "100%",
  },
  leftWrapper: {
    flex: 1,
    flexDirection: "row",
    gap: 8,
    justifyContent: "flex-start",
    paddingLeft: 16,
  },
  localTimeText: {
    color: colors.neutral[400],
  },
  rightWrapper: {
    flex: 1,
    flexDirection: "row",
    gap: 8,
    justifyContent: "flex-end",
    paddingRight: 16,
  },
  text: {
    color: colors.neutral[400],
    fontFamily: "Geist Mono",
    fontSize: 18,
    fontWeight: "300",
  },
});
