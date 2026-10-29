import { AndroidHaptics, ImpactFeedbackStyle } from "expo-haptics";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  PagerViewOnPageScrollEventData,
  PagerViewOnPageSelectedEvent,
} from "react-native-pager-view";
import type PagerView from "react-native-pager-view";
import { useEvent, useSharedValue } from "react-native-reanimated";

import { triggerAndroidHaptic, triggerType } from "@/helpers/haptics";

import type { FormTabOption } from "./types";

const usePagerState = <T extends string>(
  options: FormTabOption<T>[],
  value?: T
) => {
  const pagerRef = useRef<PagerView>(null);
  const [internalIndex, setInternalIndex] = useState(0);

  const propIndex = useMemo(
    () => (value ? options.findIndex((opt) => opt.value === value) : -1),
    [options, value]
  );

  const safeActiveIndex = propIndex >= 0 ? propIndex : internalIndex;
  const currentIndexRef = useRef(safeActiveIndex);

  return {
    currentIndexRef,
    internalIndex,
    pagerRef,
    propIndex,
    safeActiveIndex,
    setInternalIndex,
  };
};

export const useFormPager = <T extends string>(
  options: FormTabOption<T>[],
  value?: T,
  onValueChange?: (value: T) => void
) => {
  const {
    pagerRef,
    setInternalIndex,
    propIndex,
    safeActiveIndex,
    currentIndexRef,
  } = usePagerState(options, value);

  const scrollPosition = useSharedValue(safeActiveIndex);

  useEffect(() => {
    if (propIndex >= 0 && propIndex !== currentIndexRef.current) {
      pagerRef.current?.setPage(propIndex);
      currentIndexRef.current = propIndex;
    }
  }, [propIndex, currentIndexRef, pagerRef]);

  const scrollHandler = useEvent(
    (event: PagerViewOnPageScrollEventData) => {
      "worklet";
      scrollPosition.value = event.position + event.offset;
    },
    ["onPageScroll"]
  );

  const handlePageSelected = useCallback(
    (e: PagerViewOnPageSelectedEvent) => {
      const newIndex = e.nativeEvent.position;
      if (newIndex !== currentIndexRef.current) {
        currentIndexRef.current = newIndex;
        setInternalIndex(newIndex);
        triggerAndroidHaptic(AndroidHaptics.Segment_Tick, {
          mode: ImpactFeedbackStyle.Soft,
          type: triggerType.Impact,
        });
        onValueChange?.(options[newIndex].value);
      }
    },
    [currentIndexRef, setInternalIndex, onValueChange, options]
  );

  const handleOnPressInactiveTab = useCallback(
    (index: number) => pagerRef.current?.setPage(index),
    [pagerRef]
  );

  return {
    currentIndexRef,
    handleOnPressInactiveTab,
    handlePageSelected,
    pagerRef,
    safeActiveIndex,
    scrollHandler,
    scrollPosition,
  };
};
