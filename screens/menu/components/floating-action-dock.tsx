import { Link } from "expo-router";
import { useAtomValue } from "jotai";
import { SlidersIcon } from "phosphor-react-native";
import type { StyleProp, ViewStyle } from "react-native";
import { StyleSheet, View } from "react-native";

import Button from "@/components/button";
import { isCurrentTimerValidAtom } from "@/stores/workout";

import { useStartTimer } from "../hooks/use-start-timer";

export interface FloatingActionDockProps {
  style?: StyleProp<ViewStyle>;
}

export const FloatingActionDock = ({ style }: FloatingActionDockProps) => {
  const isValid = useAtomValue(isCurrentTimerValidAtom);
  const handleStart = useStartTimer();

  return (
    <View testID="floating-action-dock" style={[styles.container, style]}>
      <Link href="/settings" asChild>
        <Button size="icon" icon={SlidersIcon} variant="ghost" />
      </Link>

      <Button
        testID="start-timer-button"
        disabled={!isValid}
        style={styles.fullSpace}
        title="Start"
        onPress={handleStart}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  fullSpace: {
    flex: 1,
  },
});
