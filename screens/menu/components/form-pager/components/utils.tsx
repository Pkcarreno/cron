import { DropdownMenuItem } from '@/components/dropdown-menu';
import { useCallback } from 'react';
import type { GestureResponderEvent, LayoutChangeEvent } from 'react-native';
import { Pressable, View } from 'react-native';

export interface ViewWithIndexOnLayoutType {
  event: LayoutChangeEvent;
  index: number;
}

export interface ViewWithIndexOnLayoutProps extends Omit<
  React.ComponentProps<typeof View>,
  'onLayout'
> {
  index: number;
  onLayout?: (value: ViewWithIndexOnLayoutType) => void;
}

export const ViewWithIndexOnLayout: React.FC<ViewWithIndexOnLayoutProps> = ({
  index,
  onLayout,
  ...rest
}) => {
  const handlePress = useCallback(
    (event: LayoutChangeEvent) => {
      if (onLayout) {
        onLayout({ event, index });
      }
    },
    [index, onLayout]
  );

  return <View onLayout={handlePress} {...rest} />;
};

export interface PressableWithIndexOnActionType {
  event: GestureResponderEvent;
  index: number;
}

export interface PressableWithIndexProps extends React.ComponentProps<
  typeof Pressable
> {
  index: number;
  onAction?: (value: PressableWithIndexOnActionType) => void;
}

export const PressableWithIndex: React.FC<PressableWithIndexProps> = ({
  index,
  onAction,
  ...rest
}) => {
  const handlePress = useCallback(
    (event: GestureResponderEvent) => {
      if (onAction) {
        onAction({ event, index });
      }
    },
    [index, onAction]
  );

  return <Pressable onPress={handlePress} {...rest} />;
};

export interface DropdownMenuItemWithIndexOnActionType {
  event: GestureResponderEvent;
  index: number;
}

export interface DropdownMenuItemWithIndexProps extends React.ComponentProps<
  typeof DropdownMenuItem
> {
  index: number;
  onAction?: (value: DropdownMenuItemWithIndexOnActionType) => void;
}

export const DropdownMenuItemWithIndex: React.FC<
  DropdownMenuItemWithIndexProps
> = ({ index, onAction, ...rest }) => {
  const handlePress = useCallback(
    (event: GestureResponderEvent) => {
      if (onAction) {
        onAction({ event, index });
      }
    },
    [index, onAction]
  );

  return <DropdownMenuItem onPress={handlePress} {...rest} />;
};
