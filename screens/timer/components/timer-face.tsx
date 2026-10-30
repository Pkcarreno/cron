import { useKeepAwake } from "expo-keep-awake";
import type { FC } from "react";
import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors } from "@/helpers/colors";
import { formatDuration } from "@/helpers/timer/utils/formatter";
import { useIsLowBattery } from "@/hooks/use-is-low-battery";
import type { timerType } from "@/hooks/use-timer";
import { ContextBannerSvg } from "@/screens/timer/components/svg/context-banner-svg";
import { MinutesSvg } from "@/screens/timer/components/svg/minutes-svg";
import { SecondsSvg } from "@/screens/timer/components/svg/seconds-svg";
import type { ContextFormatType } from "@/screens/timer/types";

interface Props extends Pick<
  timerType,
  "flags" | "hours" | "minutes" | "seconds" | "modeAbbr"
> {
  currentTime: string;
  delta: number | undefined;
  lap: number | undefined;
  contextLabel: ContextFormatType["value"];
  contextLabelColor?: ContextFormatType["color"];
  contextValue: ContextFormatType["value"];
  contextValueColor?: ContextFormatType["color"];
}

export const TimerFace: FC<Props> = ({
  hours,
  minutes,
  seconds,
  modeAbbr,
  contextLabel,
  contextLabelColor,
  contextValue,
  contextValueColor,
  currentTime,
  lap,
  delta,
  flags,
}) => {
  const insets = useSafeAreaInsets();
  const isLowBattery = useIsLowBattery();

  const quickAccessInfo = useMemo(
    () =>
      [
        isLowBattery ? "[BAT LOW]" : null,
        hours ? `${hours}H` : null,
        lap && lap > 0 ? `L${lap.toString().padStart(2, "0")}` : null,
        delta ? formatDuration(delta, true) : null,
      ].filter(Boolean),
    [hours, lap, delta, isLowBattery]
  );

  useKeepAwake();

  return (
    <View style={styles.container} testID="timer-screen" collapsable={false}>
      <View
        style={[
          statusBarStyles.container,
          {
            height: insets.top,
            paddingLeft: insets.left,
            paddingRight: insets.right,
          },
        ]}
      >
        <View style={statusBarStyles.leftWrapper}>
          <Text style={statusBarStyles.text}>{modeAbbr}</Text>
        </View>
        <View style={statusBarStyles.rightWrapper}>
          <Text style={[statusBarStyles.text, statusBarStyles.localTimeText]}>
            {currentTime}
          </Text>
        </View>
      </View>

      <View
        style={[
          styles.contentWrapper,
          {
            paddingBottom: insets.bottom,
            paddingLeft: insets.left,
            paddingRight: insets.right,
          },
        ]}
      >
        {!flags.isPreparing && (
          <View style={quickAccessStyles.container}>
            {quickAccessInfo.length > 0 ? (
              quickAccessInfo.map((data, index) => (
                <View key={data} style={quickAccessStyles.itemWrapper}>
                  <Text style={statusBarStyles.text}>{data}</Text>

                  {index < quickAccessInfo.length - 1 && (
                    <Text style={statusBarStyles.text}> | </Text>
                  )}
                </View>
              ))
            ) : (
              <View style={quickAccessStyles.itemWrapper}>
                <Text style={statusBarStyles.text}>{"\u2003"}</Text>
              </View>
            )}
          </View>
        )}

        <View
          style={contextBannerStyles.container}
          testID="context-label"
          collapsable={false}
        >
          <ContextBannerSvg
            label={contextLabel}
            labelColor={contextLabelColor}
            value={contextValue}
            valueColor={contextValueColor}
          />
        </View>

        <View style={timeStyles.container} testID="timer-display">
          <View
            style={[timeStyles.slot, !flags.showsMinuteDigits && styles.hide]}
            testID="timer-minutes-slot"
          >
            <MinutesSvg minutes={minutes} />
          </View>
          <View style={timeStyles.slot} testID="timer-seconds-slot">
            <SecondsSvg seconds={seconds} />
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.black,
    flex: 1,
  },
  contentWrapper: {
    flex: 1,
  },
  hide: {
    opacity: 0,
  },
});

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
    color: colors.neutral[500],
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

const contextBannerStyles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    width: "100%",
  },
});

const quickAccessStyles = StyleSheet.create({
  container: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 16,
  },
  itemWrapper: {
    flexDirection: "row",
    gap: 8,
  },
});

const timeStyles = StyleSheet.create({
  container: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    width: "100%",
  },
  slot: {
    alignItems: "center",
    flex: 1,
    height: "50%",
    justifyContent: "center",
    width: "100%",
  },
});
