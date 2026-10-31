import { useAtomValue } from "jotai";
import type { FC } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors } from "@/helpers/colors";
import {
  timerContextBannerAtom,
  timerFlagsAtom,
  timerMinutesStrAtom,
  timerQuickAccessInfoAtom,
  timerSecondsStrAtom,
} from "@/screens/timer/atoms";
import { ContextBannerSvg } from "@/screens/timer/components/svg/context-banner-svg";
import { MinutesSvg } from "@/screens/timer/components/svg/minutes-svg";
import { SecondsSvg } from "@/screens/timer/components/svg/seconds-svg";

export const TimerMinutes: FC = () => {
  const minutes = useAtomValue(timerMinutesStrAtom);
  return <MinutesSvg minutes={minutes} />;
};

export const TimerSeconds: FC = () => {
  const seconds = useAtomValue(timerSecondsStrAtom);
  return <SecondsSvg seconds={seconds} />;
};

export const TimerContextBanner: FC = () => {
  const banner = useAtomValue(timerContextBannerAtom);

  return (
    <View
      style={contextBannerStyles.container}
      testID="context-label"
      collapsable={false}
    >
      <ContextBannerSvg
        label={banner.label}
        labelColor={banner.labelColor}
        value={banner.value}
        valueColor={banner.valueColor}
      />
    </View>
  );
};

export const TimerQuickAccess: FC = () => {
  const quickAccessInfo = useAtomValue(timerQuickAccessInfoAtom);
  const flags = useAtomValue(timerFlagsAtom);

  return (
    <View
      style={[quickAccessStyles.container, flags.isPreparing && styles.hide]}
      testID="timer-quick-access-info"
      collapsable={false}
    >
      {quickAccessInfo.length > 0 ? (
        quickAccessInfo.map((badge, index) => (
          <View key={badge} style={quickAccessStyles.itemWrapper}>
            <Text style={quickAccessStyles.text}>{badge}</Text>

            {index < quickAccessInfo.length - 1 && (
              <Text style={quickAccessStyles.text}> | </Text>
            )}
          </View>
        ))
      ) : (
        <View style={quickAccessStyles.itemWrapper}>
          <Text style={quickAccessStyles.text}>{"\u2003"}</Text>
        </View>
      )}
    </View>
  );
};

export interface TimerDisplayProps {
  children?: React.ReactNode;
}

export const TimerDisplay: FC<TimerDisplayProps> = ({ children }) => {
  const insets = useSafeAreaInsets();
  const flags = useAtomValue(timerFlagsAtom);

  return (
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
      {children ?? (
        <>
          <TimerQuickAccess />
          <TimerContextBanner />

          <View
            style={timeStyles.container}
            testID="timer-display"
            collapsable={false}
          >
            <View
              style={[timeStyles.slot, !flags.showsMinuteDigits && styles.hide]}
              testID="timer-minutes-slot"
              collapsable={false}
            >
              <TimerMinutes />
            </View>
            <View
              style={timeStyles.slot}
              testID="timer-seconds-slot"
              collapsable={false}
            >
              <TimerSeconds />
            </View>
          </View>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  contentWrapper: {
    flex: 1,
    overflow: "hidden",
  },
  hide: {
    opacity: 0,
  },
});

const contextBannerStyles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 6,
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
  text: {
    color: colors.neutral[400],
    fontFamily: "Geist Mono",
    fontSize: 18,
    fontWeight: "300",
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
    justifyContent: "center",
    width: "100%",
  },
});
