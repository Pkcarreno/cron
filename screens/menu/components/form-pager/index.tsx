import React, { useMemo, useRef } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FormPagerContext } from "./context";
import { FormPagerDock } from "./dock";
import { FormPagerHeader } from "./header";
import { computeDeterministicInsets } from "./metrics";
import { FormPagerTabBar } from "./tab-bar";
import type {
  FormInsets,
  FormPagerContextValue,
  FormPagerProps,
} from "./types";
import { useFormPager } from "./use-form-pager";
import { FormPagerViewport } from "./viewport";

export const FormPagerRoot = <T extends string = string>({
  value,
  onValueChange,
  options,
  children,
  testID,
  style,
  insets: overrideInsets,
  blurTargetRef: customBlurTargetRef,
}: FormPagerProps<T>) => {
  const safeAreaInsets = useSafeAreaInsets();
  const internalBlurTargetRef = useRef<React.ComponentRef<typeof View>>(null);
  const blurTargetRef = customBlurTargetRef ?? internalBlurTargetRef;

  const deterministicInsets = useMemo<FormInsets>(() => {
    const computed = computeDeterministicInsets(safeAreaInsets);
    return {
      bottom: overrideInsets?.bottom ?? computed.bottom,
      top: overrideInsets?.top ?? computed.top,
    };
  }, [safeAreaInsets, overrideInsets]);

  const {
    handlePageSelected,
    handleTabPress,
    isImmediateTransition,
    isProgrammaticTransition,
    pagerRef,
    safeActiveIndex,
    scrollHandler,
    scrollPosition,
  } = useFormPager(options, value, onValueChange);

  const contextValue = useMemo<FormPagerContextValue<T>>(
    () => ({
      blurTargetRef,
      bottomInset: deterministicInsets.bottom,
      handlePageSelected,
      handleTabPress,
      insets: deterministicInsets,
      isImmediateTransition,
      isProgrammaticTransition,
      options,
      pagerRef,
      scrollHandler,
      scrollPosition,
      selectedIndex: safeActiveIndex,
      topInset: deterministicInsets.top,
    }),
    [
      blurTargetRef,
      deterministicInsets,
      handlePageSelected,
      handleTabPress,
      isImmediateTransition,
      isProgrammaticTransition,
      options,
      pagerRef,
      scrollHandler,
      scrollPosition,
      safeActiveIndex,
    ]
  );

  return (
    <FormPagerContext.Provider
      value={contextValue as unknown as FormPagerContextValue<string>}
    >
      <View style={[styles.container, style]}>
        {children ?? (
          <>
            <FormPagerTabBar />
            <FormPagerViewport testID={testID} />
          </>
        )}
      </View>
    </FormPagerContext.Provider>
  );
};

export interface FormPagerComponent {
  <T extends string = string>(props: FormPagerProps<T>): React.ReactElement;
  Header: typeof FormPagerHeader;
  TabBar: typeof FormPagerTabBar;
  Viewport: typeof FormPagerViewport;
  Dock: typeof FormPagerDock;
}

export const FormPager: FormPagerComponent = Object.assign(FormPagerRoot, {
  Dock: FormPagerDock,
  Header: FormPagerHeader,
  TabBar: FormPagerTabBar,
  Viewport: FormPagerViewport,
});

export { FormPagerContext, useFormPagerContext } from "./context";
export { FormPagerDock } from "./dock";
export { FormPagerHeader } from "./header";
export {
  computeDeterministicInsets,
  getMenuBottomInset,
  getMenuTopInset,
  MENU_DOCK_METRICS,
  MENU_HEADER_METRICS,
} from "./metrics";
export { FormPagerTabBar } from "./tab-bar";
export * from "./types";
export { useFormPager } from "./use-form-pager";
export { FormPagerViewport } from "./viewport";

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: 12,
  },
});
