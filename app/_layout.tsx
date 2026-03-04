import { StyleSheet } from 'react-native';
import { colors } from '@/helpers/colors';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { PortalHost } from '@rn-primitives/portal';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <GestureHandlerRootView>
      {/* oxlint-disable react/style-prop-object */}
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          contentStyle: styles.contentStyle,
          headerShown: false,
        }}
      />

      <PortalHost />
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  contentStyle: {
    backgroundColor: colors.black,
  },
});
