import { LinearGradient } from "expo-linear-gradient";
import { useAtom } from "jotai";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Logo } from "@/components/logo";
import { Text } from "@/components/text";
import { activeTimerModeAtom } from "@/stores/workout";

import { FloatingActionDock } from "./components/floating-action-dock";
import { FormPager } from "./components/form-pager";
import { MENU_PAGES } from "./pages";

export const Menu = () => {
  const [currentMode, setCurrentMode] = useAtom(activeTimerModeAtom);
  const inset = useSafeAreaInsets();

  return (
    <View
      testID="menu-screen"
      collapsable={false}
      style={[styles.container, { paddingTop: inset.top }]}
    >
      <View style={styles.header}>
        <Text weight="700" color="white" size={48}>
          Cron
        </Text>
        <Logo />
      </View>
      <View style={styles.content}>
        <Text weight="200" size={14} style={styles.contentHeading}>
          Job
        </Text>
        <FormPager
          value={currentMode}
          onValueChange={setCurrentMode}
          options={MENU_PAGES}
        />
      </View>
      <LinearGradient
        pointerEvents="box-none"
        style={styles.floatingDockGradient}
        colors={[
          "transparent",
          "rgba(0, 0, 0, 0.6)",
          "rgba(0, 0, 0, 0.8)",
          "black",
        ]}
        locations={[0, 0.08, 0.16, 1]}
      >
        <FloatingActionDock style={{ paddingBottom: inset.bottom + 12 }} />
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: 16,
    justifyContent: "center",
  },
  content: {
    flex: 1,
  },
  contentHeading: {
    paddingLeft: 28,
  },
  floatingDockGradient: {
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 20,
  },
});
