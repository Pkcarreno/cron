import type React from "react";
import type { StyleProp, View, ViewProps, ViewStyle } from "react-native";
import type { PagerViewOnPageSelectedEvent } from "react-native-pager-view";
import type PagerView from "react-native-pager-view";
import type { SharedValue } from "react-native-reanimated";

export interface TabTransitionOptions {
  animated?: boolean;
}

export interface FormInsets {
  top: number;
  bottom: number;
}

export interface FormTabOption<T extends string> {
  value: T;
  label: string;
  content: React.ReactNode | ((insets: FormInsets) => React.ReactNode);
}

export interface FormPagerContextValue<T extends string = string> {
  options: FormTabOption<T>[];
  selectedIndex: number;
  scrollPosition: SharedValue<number>;
  isProgrammaticTransition: SharedValue<boolean>;
  isImmediateTransition: SharedValue<boolean>;
  pagerRef: React.RefObject<PagerView | null>;
  blurTargetRef: React.RefObject<React.ComponentRef<typeof View> | null>;
  insets: FormInsets;
  topInset: number;
  bottomInset: number;
  handlePageSelected: (event: PagerViewOnPageSelectedEvent) => void;
  handleTabPress: (
    index: number,
    optionOrTransitionOptions?: FormTabOption<T> | TabTransitionOptions,
    transitionOptions?: TabTransitionOptions
  ) => void;
  scrollHandler: unknown;
}

export interface FormPagerProps<T extends string = string> {
  options: FormTabOption<T>[];
  value?: T;
  onValueChange?: (value: T) => void;
  insets?: Partial<FormInsets>;
  children?: React.ReactNode;
  testID?: string;
  style?: StyleProp<ViewStyle>;
  blurTargetRef?: React.RefObject<React.ComponentRef<typeof View> | null>;
}

export interface FormPagerHeaderProps extends ViewProps {
  children?: React.ReactNode;
}

export interface FormPagerTabBarProps<T extends string = string> {
  style?: StyleProp<ViewStyle>;
  testID?: string;
  options?: FormTabOption<T>[];
}

export interface FormPagerViewportProps {
  testID?: string;
  style?: StyleProp<ViewStyle>;
  pageStyle?: StyleProp<ViewStyle>;
  pagerStyle?: StyleProp<ViewStyle>;
}

export interface FormPagerDockProps extends ViewProps {
  children?: React.ReactNode;
}
