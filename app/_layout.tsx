import { PortalHost } from "@rn-primitives/portal";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { colors } from "@/helpers/colors";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <GestureHandlerRootView style={styles.container}>
      <SafeAreaProvider>
        {/* oxlint-disable react/style-prop-object */}
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            contentStyle: styles.contentStyle,
            headerShown: false,
            headerStyle: {
              backgroundColor: colors.neutral[950],
            },
            headerTintColor: colors.neutral[400],
            headerTitleStyle: {
              fontFamily: "Geist",
              fontWeight: "600",
            },
          }}
        />

        <PortalHost />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentStyle: {
    backgroundColor: colors.black,
  },
});
