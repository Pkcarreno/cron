import { setVisibilityAsync } from 'expo-navigation-bar';
import { Stack, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { Platform } from 'react-native';

export const HideNavigationBar = () => {
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS === 'android') {
        setVisibilityAsync('hidden');
      }

      return () => {
        if (Platform.OS === 'android') {
          setVisibilityAsync('visible');
        }
      };
    }, [])
  );
  return <Stack.Screen options={{ autoHideHomeIndicator: true }} />;
};
