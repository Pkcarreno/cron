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

/**
 * Passive pager synchronization hook for FormPager and SegmentedTabBar.
 *
 * Coordinates unidirectional scroll offset streaming from native `PagerView`
 * (`ViewPager2` / `UIPageViewController`) to Reanimated `scrollPosition` on the
 * UI runtime without triggering React component re-renders during active gestures.
 *
 * Architectural Invariants:
 * 1. Echo Loop Elimination: Synchronizes external prop changes imperatively while
 *    preventing re-entrant `setPage` commands upon `onPageSelected` commit.
 * 2. Pure 1:1 Indicator Interpolation: Derives pill translation linearly from
 *    `onPageScroll` without synthetic secondary spring loops.
 * 3. Programmatic Transition Lock: Suppresses concurrent `setPage` commands during
 *    active animated transitions.
 *
 * @param options - Available form tab options.
 * @param value - Optional controlled active mode identifier.
 * @param onValueChange - Callback invoked strictly upon gesture completion.
 * @returns Controlled refs, handlers, and shared values for PagerView and SegmentedTabBar.
 */
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

  // Synchronize pager imperatively when external propIndex updates, guarding
  // against re-entrant command loops while programmatic transitions are in-flight.
  useEffect(() => {
    if (
      propIndex >= 0 &&
      propIndex !== currentIndexRef.current &&
      !isProgrammaticTransition.value
    ) {
      isProgrammaticTransition.value = true;
      currentIndexRef.current = propIndex;
      pagerRef.current?.setPage(propIndex);
    }
  }, [propIndex, pagerRef, currentIndexRef, isProgrammaticTransition]);

  const scrollHandler = useEvent(
    (event: PagerViewOnPageScrollEventData) => {
      "worklet";
      scrollPosition.value = event.position + event.offset;
    },
    ["onPageScroll"]
  );

  const handlePageSelected = useCallback(
    (event: PagerViewOnPageSelectedEvent) => {
      const newIndex = event.nativeEvent.position;
      isProgrammaticTransition.value = false;
      scrollPosition.value = newIndex;

      if (newIndex !== currentIndexRef.current) {
        currentIndexRef.current = newIndex;
        if (value === undefined) {
          setInternalIndex(newIndex);
        }
        triggerAndroidHaptic(AndroidHaptics.Segment_Tick, {
          mode: ImpactFeedbackStyle.Soft,
          type: triggerType.Impact,
        });
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
      if (index === currentIndexRef.current || isProgrammaticTransition.value) {
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
