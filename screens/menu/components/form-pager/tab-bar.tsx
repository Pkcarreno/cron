import { use } from "react";

import { FormPagerContext } from "./context";
import { SegmentedTabBar } from "./segmented-tab-bar";
import type { FormPagerTabBarProps } from "./types";

export const FormPagerTabBar = <T extends string = string>({
  style,
  testID,
  options: overrideOptions,
}: FormPagerTabBarProps<T>) => {
  const context = use(FormPagerContext);
  if (!context) {
    throw new Error(
      "FormPager.TabBar must be rendered within a <FormPager> provider"
    );
  }

  const { handleTabPress, options, scrollPosition, selectedIndex } = context;

  return (
    <SegmentedTabBar
      testID={testID}
      style={style}
      options={overrideOptions ?? options}
      selectedIndex={selectedIndex}
      scrollPosition={scrollPosition}
      onTabPress={handleTabPress}
    />
  );
};
