import { AndroidHaptics, ImpactFeedbackStyle } from "expo-haptics";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  PagerViewOnPageScrollEventData,
  PagerViewOnPageSelectedEvent,
} from "react-native-pager-view";
import type PagerView from "react-native-pager-view";
import {
  ReduceMotion,
  useEvent,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import { triggerAndroidHaptic, triggerType } from "@/helpers/haptics";

import type { FormTabOption } from "./types";

export const useFormPager = <T extends string>(
  options: FormTabOption<T>[],
  value?: T,
  onValueChange?: (value: T) => void
) => {
  const pagerRef = useRef<PagerView>(null);
  const [internalIndex, setInternalIndex] = useState(0);

  const propIndex = useMemo(
    () => (value ? options.findIndex((opt) => opt.value === value) : -1),
    [options, value]
  );

  const safeActiveIndex = propIndex >= 0 ? propIndex : internalIndex;
  const currentIndexRef = useRef(safeActiveIndex);
  const isProgrammaticTransition = useSharedValue(false);
  const scrollPosition = useSharedValue(safeActiveIndex);

  // Synchronize pager imperatively when external propIndex updates
  useEffect(() => {
    if (
      propIndex >= 0 &&
      propIndex !== currentIndexRef.current &&
      !isProgrammaticTransition.value
    ) {
      isProgrammaticTransition.value = true;
      currentIndexRef.current = propIndex;
      scrollPosition.value = withSpring(propIndex, {
        dampingRatio: 1,
        duration: 250,
        reduceMotion: ReduceMotion.System,
      });
      pagerRef.current?.setPage(propIndex);
    }
  }, [
    propIndex,
    pagerRef,
    currentIndexRef,
    isProgrammaticTransition,
    scrollPosition,
  ]);

  const scrollHandler = useEvent(
    (event: PagerViewOnPageScrollEventData) => {
      "worklet";
      if (!isProgrammaticTransition.value) {
        scrollPosition.value = event.position + event.offset;
      }
    },
    ["onPageScroll"]
  );

  const handlePageSelected = useCallback(
    (e: PagerViewOnPageSelectedEvent) => {
      const newIndex = e.nativeEvent.position;
      const wasProgrammatic = isProgrammaticTransition.value;

      if (wasProgrammatic) {
        isProgrammaticTransition.value = false;
        scrollPosition.value = newIndex;
      }

      if (newIndex !== currentIndexRef.current) {
        currentIndexRef.current = newIndex;
        if (value === undefined) {
          setInternalIndex(newIndex);
        }
        if (!wasProgrammatic) {
          triggerAndroidHaptic(AndroidHaptics.Segment_Tick, {
            mode: ImpactFeedbackStyle.Soft,
            type: triggerType.Impact,
          });
        }
        const option = options[newIndex];
        if (option) {
          onValueChange?.(option.value);
        }
      }
    },
    [
      currentIndexRef,
      isProgrammaticTransition,
      onValueChange,
      options,
      scrollPosition,
      value,
    ]
  );

  const handleTabPress = useCallback(
    (index: number) => {
      if (index === currentIndexRef.current) {
        return;
      }
      isProgrammaticTransition.value = true;
      pagerRef.current?.setPage(index);
    },
    [currentIndexRef, isProgrammaticTransition, pagerRef]
  );

  return {
    currentIndexRef,
    handlePageSelected,
    handleTabPress,
    isProgrammaticTransition,
    pagerRef,
    safeActiveIndex,
    scrollHandler,
    scrollPosition,
  };
};
