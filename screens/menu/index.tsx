import { useAtom } from "jotai";
import React, { useRef } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { GlassSurface } from "@/components/glass-surface";
import { Logo } from "@/components/logo";
import { Text } from "@/components/text";
import { activeTimerModeAtom } from "@/stores/workout";

import { FloatingActionDock } from "./components/floating-action-dock";
import { FormPager } from "./components/form-pager";
import { MENU_HEADER_METRICS } from "./components/form-pager/metrics";
import { MENU_PAGES } from "./pages";

export const Menu = () => {
  const [currentMode, setCurrentMode] = useAtom(activeTimerModeAtom);
  const inset = useSafeAreaInsets();
  const blurTargetRef = useRef<React.ComponentRef<typeof View>>(null);

  return (
    <View testID="menu-screen" collapsable={false} style={styles.container}>
      <FormPager
        value={currentMode}
        onValueChange={setCurrentMode}
        options={MENU_PAGES}
        blurTargetRef={blurTargetRef}
        style={StyleSheet.absoluteFill}
      >
        <FormPager.Viewport style={StyleSheet.absoluteFill} />

        <FormPager.Header
          testID="menu-floating-header"
          pointerEvents="box-none"
          style={styles.floatingHeaderContainer}
        >
          <GlassSurface
            testID="menu-header-glass"
            borderTreatment="bottom"
            blurTarget={blurTargetRef}
            pointerEvents="box-none"
            style={[styles.headerGlass, { paddingTop: inset.top }]}
          >
            <View style={styles.header}>
              <Text weight="700" color="white" size={48}>
                Cron
              </Text>
              <Logo />
            </View>
            <Text weight="200" size={14} style={styles.contentHeading}>
              Job
            </Text>
            <FormPager.TabBar />
          </GlassSurface>
        </FormPager.Header>

        <FormPager.Dock
          testID="menu-floating-dock"
          pointerEvents="box-none"
          style={styles.floatingDockContainer}
        >
          <FloatingActionDock />
        </FormPager.Dock>
      </FormPager>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentHeading: {
    marginBottom: MENU_HEADER_METRICS.jobMarginBottom,
    paddingLeft: 28,
  },
  floatingDockContainer: {
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
  },
  floatingHeaderContainer: {
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
    zIndex: 10,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: MENU_HEADER_METRICS.headerMarginBottom,
    paddingHorizontal: 20,
  },
  headerGlass: {
    paddingBottom: MENU_HEADER_METRICS.tabBarMarginBottom,
  },
});
