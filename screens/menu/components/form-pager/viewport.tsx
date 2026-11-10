import { BlurTargetView } from "expo-blur";
import { use } from "react";
import type { NativeSyntheticEvent } from "react-native";
import { StyleSheet, View } from "react-native";
import type { PagerViewOnPageScrollEventData } from "react-native-pager-view";
import PagerView from "react-native-pager-view";
import { createAnimatedComponent } from "react-native-reanimated";

import { FormPagerContext } from "./context";
import type { FormPagerViewportProps } from "./types";

const AnimatedPagerView = createAnimatedComponent(PagerView);

export const FormPagerViewport = ({
  pageStyle,
  pagerStyle,
  style,
  testID = "form-pager-view",
}: FormPagerViewportProps) => {
  const context = use(FormPagerContext);
  if (!context) {
    throw new Error(
      "FormPager.Viewport must be rendered within a <FormPager> provider"
    );
  }

  const {
    blurTargetRef,
    handlePageSelected,
    insets,
    options,
    pagerRef,
    scrollHandler,
    selectedIndex,
  } = context;

  return (
    <BlurTargetView
      ref={blurTargetRef}
      collapsable={false}
      style={[styles.viewportWrapper, style]}
    >
      <AnimatedPagerView
        testID={testID}
        collapsable={false}
        ref={pagerRef}
        style={[styles.pagerView, pagerStyle]}
        initialPage={selectedIndex}
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
            style={[styles.page, pageStyle]}
          >
            {typeof option.content === "function"
              ? option.content(insets)
              : option.content}
          </View>
        ))}
      </AnimatedPagerView>
    </BlurTargetView>
  );
};

const styles = StyleSheet.create({
  page: {
    flex: 1,
    paddingHorizontal: 20,
  },
  pagerView: {
    ...StyleSheet.absoluteFill,
    flex: 1,
  },
  viewportWrapper: {
    flex: 1,
  },
});
