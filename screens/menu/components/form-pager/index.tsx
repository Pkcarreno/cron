import React from "react";
import type { NativeSyntheticEvent } from "react-native";
import { StyleSheet, View } from "react-native";
import type { PagerViewOnPageScrollEventData } from "react-native-pager-view";
import PagerView from "react-native-pager-view";
import { createAnimatedComponent } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SegmentedTabBar } from "./segmented-tab-bar";
import type { FormTabOption } from "./types";
import { useFormPager } from "./use-form-pager";

const AnimatedPagerView = createAnimatedComponent(PagerView);

interface FormPagerProps<T extends string> extends React.PropsWithChildren {
  options: FormTabOption<T>[];
  value?: T;
  onValueChange?: (value: T) => void;
  testID?: string;
}

export const FormPager = <T extends string>({
  value,
  onValueChange,
  options,
  children,
  testID,
}: FormPagerProps<T>) => {
  const insets = useSafeAreaInsets();
  const formPaddingBottom = Math.max(96, 72 + insets.bottom);

  const {
    pagerRef,
    scrollPosition,
    safeActiveIndex,
    scrollHandler,
    handlePageSelected,
    handleTabPress,
  } = useFormPager(options, value, onValueChange);

  return (
    <View style={styles.container}>
      <SegmentedTabBar
        options={options}
        selectedIndex={safeActiveIndex}
        scrollPosition={scrollPosition}
        onTabPress={handleTabPress}
      />

      <AnimatedPagerView
        testID={testID ?? "form-pager-view"}
        collapsable={false}
        ref={pagerRef}
        style={styles.pagerView}
        initialPage={safeActiveIndex}
        overdrag={true}
        onPageScroll={
          scrollHandler as unknown as (
            e: NativeSyntheticEvent<PagerViewOnPageScrollEventData>
          ) => void
        }
        onPageSelected={handlePageSelected}
      >
        {options.map((option) => (
          <View
            key={`page-${option.value || "undef"}`}
            collapsable={false}
            style={styles.page}
          >
            {typeof option.content === "function"
              ? option.content({ bottom: formPaddingBottom })
              : option.content}
          </View>
        ))}
      </AnimatedPagerView>

      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: 12,
  },
  page: {
    flex: 1,
    paddingHorizontal: 20,
  },
  pagerView: {
    flex: 1,
  },
});
