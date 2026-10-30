import type { FC } from "react";
import { useEffect, useState } from "react";
import type { StyleProp, TextStyle } from "react-native";
import { StyleSheet, Text } from "react-native";

import { colors } from "@/helpers/colors";

export interface LocalClockProps {
  style?: StyleProp<TextStyle>;
}

const formatWallClock = (date: Date): string =>
  date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

export const LocalClock: FC<LocalClockProps> = ({ style }) => {
  const [formattedTime, setFormattedTime] = useState(() =>
    formatWallClock(new Date())
  );

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;

    const scheduleNextMinute = () => {
      const now = new Date();
      // Calculate remaining milliseconds until the next clean minute boundary
      const msUntilNextMinute =
        (60 - now.getSeconds()) * 1000 - now.getMilliseconds();

      timeoutId = setTimeout(
        () => {
          setFormattedTime(formatWallClock(new Date()));
          scheduleNextMinute();
        },
        Math.max(msUntilNextMinute, 1)
      );
    };

    scheduleNextMinute();

    return () => {
      clearTimeout(timeoutId);
    };
  }, []);

  return <Text style={[styles.text, style]}>{formattedTime}</Text>;
};

const styles = StyleSheet.create({
  text: {
    color: colors.neutral[400],
    fontFamily: "Geist Mono",
    fontSize: 18,
    fontWeight: "300",
  },
});
