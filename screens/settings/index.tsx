import { NumberPickerSheet } from '@/components/input-number';
import {
  Menu,
  MenuGroup,
  MenuItem,
  MenuItemText,
  MenuPressableItem,
  MenuTopic,
} from '@/components/menu';
import { Switch } from '@/components/switch';
import { Text } from '@/components/text';
import Env from '@/env';
import { colors } from '@/helpers/colors';
import { formatDuration } from '@/helpers/timer/utils/formatter';
import {
  isRawTimerEnabledAtom,
  preparationTimeMsAtom,
} from '@/stores/settings';
import { Link, Stack } from 'expo-router';
import { useAtom } from 'jotai/react';
import { CaretRightIcon } from 'phosphor-react-native';
import { useCallback } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

export const Settings = () => {
  const [isRawTimerEnabled, setIsRawTimerEnabled] = useAtom(
    isRawTimerEnabledAtom
  );
  const [preparationTimeMs, setPreparationTimeMs] = useAtom(
    preparationTimeMsAtom
  );

  const handlePreparationTimeChange = useCallback(
    (value: number) => {
      setPreparationTimeMs(value * 1000);
    },
    [setPreparationTimeMs]
  );

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Settings',
        }}
      />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        contentInsetAdjustmentBehavior="automatic"
      >
        <Menu>
          <MenuTopic>Preferences</MenuTopic>
          <MenuGroup>
            <NumberPickerSheet
              value={preparationTimeMs / 1000}
              min={1}
              max={99}
              valueSuffix="sec"
              onChangeValue={handlePreparationTimeChange}
            >
              {(triggerProps) => (
                <MenuPressableItem {...triggerProps}>
                  <MenuItemText>Preparation</MenuItemText>
                  <MenuItemText colorSubtone="400">
                    {formatDuration(preparationTimeMs)}
                  </MenuItemText>
                </MenuPressableItem>
              )}
            </NumberPickerSheet>
          </MenuGroup>
        </Menu>

        <Menu>
          <MenuTopic>About & Support</MenuTopic>
          <MenuGroup>
            <Link href="https://www.pkcarreno.com/projects/cron" asChild>
              <MenuPressableItem>
                <MenuItemText>About the Project</MenuItemText>
                <CaretRightIcon size={14} color={colors.neutral[300]} />
              </MenuPressableItem>
            </Link>

            <Link href="https://github.com/pkcarreno/cron/issues" asChild>
              <MenuPressableItem>
                <MenuItemText>Report an Issue</MenuItemText>
                <CaretRightIcon size={14} color={colors.neutral[300]} />
              </MenuPressableItem>
            </Link>

            <Link href="https://github.com/pkcarreno/cron" asChild>
              <MenuPressableItem>
                <MenuItemText>Source Code</MenuItemText>
                <CaretRightIcon size={14} color={colors.neutral[300]} />
              </MenuPressableItem>
            </Link>
          </MenuGroup>
        </Menu>

        <Menu>
          <MenuTopic>Developer</MenuTopic>
          <MenuGroup>
            <MenuItem>
              <MenuItemText>Enable Raw Timer</MenuItemText>
              <Switch
                checked={isRawTimerEnabled}
                onCheckedChange={setIsRawTimerEnabled}
              />
            </MenuItem>
          </MenuGroup>
        </Menu>

        <View style={styles.extra}>
          <Text colorSubtone="600" fontType="mono">
            {Env.EXPO_PUBLIC_NAME} v{Env.EXPO_PUBLIC_VERSION}
          </Text>
          <Text colorSubtone="600" fontType="mono">
            by pkcarreno
          </Text>
        </View>
      </ScrollView>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
  },
  contentContainer: {
    gap: 16,
    paddingVertical: 12,
  },
  extra: {
    paddingHorizontal: 12,
  },
});
