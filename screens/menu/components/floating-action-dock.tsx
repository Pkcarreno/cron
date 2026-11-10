import { Link } from "expo-router";
import { useAtomValue } from "jotai";
import React, { use } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Button from "@/components/button";
import { GlassSurface } from "@/components/glass-surface";
import { SlidersIcon } from "@/components/icons/sliders-icon";
import { isCurrentTimerValidAtom } from "@/stores/workout";

import { useStartTimer } from "../hooks/use-start-timer";
import { FormPagerContext } from "./form-pager/context";

export interface FloatingActionDockProps {
  style?: StyleProp<ViewStyle>;
}

export const FloatingActionDock = ({ style }: FloatingActionDockProps) => {
  const insets = useSafeAreaInsets();
  const isValid = useAtomValue(isCurrentTimerValidAtom);
  const handleStart = useStartTimer();
  const context = use(FormPagerContext);

  const bottomOffset = Math.max(insets.bottom, 16);

  return (
    <View
      pointerEvents="box-none"
      style={[styles.container, { paddingBottom: bottomOffset }, style]}
    >
      <GlassSurface
        testID="floating-action-dock"
        collapsable={false}
        borderTreatment="full"
        blurTarget={context?.blurTargetRef}
        style={styles.capsule}
      >
        <Link href="/settings" asChild>
          <Button size="icon" icon={SlidersIcon} variant="clear" />
        </Link>

        <Button
          testID="start-timer-button"
          disabled={!isValid}
          style={styles.startButton}
          title="Start"
          onPress={handleStart}
        />
      </GlassSurface>
    </View>
  );
};

const styles = StyleSheet.create({
  capsule: {
    alignItems: "center",
    borderRadius: 14,
    flexDirection: "row",
    gap: 8,
    padding: 6,
  },
  container: {
    paddingHorizontal: 20,
    pointerEvents: "box-none",
  },
  startButton: {
    flex: 1,
  },
});
