import React, { useCallback, useEffect, useMemo, useRef } from "react";
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
  } = useFormPager(options, value, onValueChange);

  const propIndex = useMemo(() => {
    if (value) {
      return options.findIndex((opt) => opt.value === value);
    }
    return -1;
  }, [options, value]);
  const currentIndexRef = useRef(Math.max(propIndex, 0));

  useEffect(() => {
    if (propIndex >= 0 && propIndex !== currentIndexRef.current) {
      pagerRef.current?.setPage(propIndex);
      currentIndexRef.current = propIndex;
    }
  }, [propIndex, pagerRef, currentIndexRef]);

  const handleTabPress = useCallback(
    (index: number) => {
      pagerRef.current?.setPage(index);
    },
    [pagerRef]
  );

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
