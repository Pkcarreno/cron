import { NativeOnlyAnimatedView } from '@/components/native-only-animated-view';
import { colors } from '@/helpers/colors';
import { triggerAndroidHaptic, triggerType } from '@/helpers/haptics';
import * as DropdownMenuPrimitive from '@rn-primitives/dropdown-menu';
import { AndroidHaptics, ImpactFeedbackStyle } from 'expo-haptics';
import * as React from 'react';
import { Platform, StyleSheet } from 'react-native';
import type { GestureResponderEvent, StyleProp, ViewStyle } from 'react-native';
import { FadeIn } from 'react-native-reanimated';
import { FullWindowOverlay as RNFullWindowOverlay } from 'react-native-screens';

const DropdownMenu = DropdownMenuPrimitive.Root;

const DropdownMenuGroup = DropdownMenuPrimitive.Group;

const DropdownMenuSub = DropdownMenuPrimitive.Sub;

const DropdownMenuTrigger = ({
  onPress,
  ...props
}: DropdownMenuPrimitive.TriggerProps &
  React.RefAttributes<DropdownMenuPrimitive.TriggerRef>) => {
  const handlePress = React.useCallback(
    (e: GestureResponderEvent) => {
      triggerAndroidHaptic(AndroidHaptics.Context_Click, {
        mode: ImpactFeedbackStyle.Light,
        type: triggerType.Impact,
      });
      onPress?.(e);
    },
    [onPress]
  );

  return <DropdownMenuPrimitive.Trigger onPress={handlePress} {...props} />;
};

const FullWindowOverlay =
  Platform.OS === 'ios' ? RNFullWindowOverlay : React.Fragment;

const DropdownMenuContent = ({
  style,
  overlayStyle,
  portalHost,
  ...props
}: DropdownMenuPrimitive.ContentProps &
  React.RefAttributes<DropdownMenuPrimitive.ContentRef> & {
    overlayStyle?: StyleProp<ViewStyle>;
    portalHost?: string;
  }) => (
  <DropdownMenuPrimitive.Portal hostName={portalHost}>
    <FullWindowOverlay>
      <DropdownMenuPrimitive.Overlay
        style={
          overlayStyle
            ? StyleSheet.flatten([StyleSheet.absoluteFill, overlayStyle])
            : StyleSheet.absoluteFill
        }
      >
        <NativeOnlyAnimatedView entering={FadeIn.duration(150)}>
          <DropdownMenuPrimitive.Content
            style={StyleSheet.flatten([styles.content, style])}
            {...props}
          />
        </NativeOnlyAnimatedView>
      </DropdownMenuPrimitive.Overlay>
    </FullWindowOverlay>
  </DropdownMenuPrimitive.Portal>
);

const DropdownMenuItem = ({
  style,
  disabled,
  ...props
}: DropdownMenuPrimitive.ItemProps &
  React.RefAttributes<DropdownMenuPrimitive.ItemRef>) => (
  <DropdownMenuPrimitive.Item
    disabled={disabled}
    style={StyleSheet.flatten([
      styles.item,
      disabled && styles.disabled,
      style,
    ])}
    {...props}
  />
);

const DropdownMenuLabel = ({
  style,
  ...props
}: DropdownMenuPrimitive.LabelProps &
  React.RefAttributes<DropdownMenuPrimitive.LabelRef>) => (
  <DropdownMenuPrimitive.Label style={[styles.label, style]} {...props} />
);

const DropdownMenuSeparator = ({
  style,
  ...props
}: DropdownMenuPrimitive.SeparatorProps &
  React.RefAttributes<DropdownMenuPrimitive.SeparatorRef>) => (
  <DropdownMenuPrimitive.Separator
    style={[styles.separator, style]}
    {...props}
  />
);

const styles = StyleSheet.create({
  content: {
    backgroundColor: colors.black,
    borderRadius: 12,
    gap: 2,
    minWidth: 128,
    overflow: 'hidden',
  },
  disabled: {
    opacity: 0.7,
  },
  item: {
    alignItems: 'center',
    backgroundColor: colors.neutral[700],
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  label: {
    color: colors.white,
    fontFamily: 'Geist',
    fontSize: 16,
    fontWeight: '400',
  },
  separator: {},
});

export {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuTrigger,
};
