/* oxlint-disable react/capitalized-calls */
import { AndroidHaptics, ImpactFeedbackStyle } from "expo-haptics";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Gesture } from "react-native-gesture-handler";
import type {
  PageScrollStateChangedNativeEvent,
  PagerViewOnPageScrollEventData,
  PagerViewOnPageSelectedEvent,
} from "react-native-pager-view";
import type PagerView from "react-native-pager-view";
import { useEvent, useSharedValue, withSpring } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import { triggerAndroidHaptic, triggerType } from "@/helpers/haptics";

import type {
  DropdownMenuItemWithIndexOnActionType,
  PressableWithIndexOnActionType,
  ViewWithIndexOnLayoutType,
} from "./components/utils";
import type { FormTabOption } from "./types";

const usePagerState = <T extends string>(
  options: FormTabOption<T>[],
  value?: T
) => {
  const pagerRef = useRef<PagerView>(null);
  const [internalIndex, setInternalIndex] = useState(0);
  const scrollStateRef = useRef<"idle" | "dragging" | "settling">("idle");

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
    scrollStateRef,
    setInternalIndex,
  };
};

const useTabMeasurements = (optionsLength: number) => {
  const [tabWidths, setTabWidths] = useState<number[]>(
    Array.from({ length: optionsLength }, () => 0)
  );
  const [tabHeight, setTabHeight] = useState(0);
  const allWidthsMeasured = tabWidths.every((w) => w > 0);

  const handleMeasureOnLayout = useCallback(
    ({ event, index }: ViewWithIndexOnLayoutType) => {
      const { width, height } = event.nativeEvent.layout;
      setTabWidths((prev) => {
        const next = [...prev];
        next[index] = width;
        return next;
      });
      setTabHeight((prev) => Math.max(prev, height));
    },
    []
  );

  return { allWidthsMeasured, handleMeasureOnLayout, tabHeight, tabWidths };
};

const usePagerMath = (optionsLength: number, tabWidths: number[]) => {
  const translations = useMemo(() => {
    const trans = [0];
    for (let i = 1; i < tabWidths.length; i += 1) {
      trans.push(trans[i - 1] - tabWidths[i - 1]);
    }
    return trans;
  }, [tabWidths]);

  const safeInputRange = useMemo(
    () =>
      optionsLength > 1
        ? Array.from({ length: optionsLength }, (_, i) => i)
        : [0, 1],
    [optionsLength]
  );
  const safeTranslations = useMemo(
    () =>
      optionsLength > 1
        ? translations
        : [translations[0] || 0, translations[0] || 0],
    [translations, optionsLength]
  );
  const safePillWidths = useMemo(
    () =>
      optionsLength > 1 ? tabWidths : [tabWidths[0] || 0, tabWidths[0] || 0],
    [tabWidths, optionsLength]
  );

  return { safeInputRange, safePillWidths, safeTranslations };
};

const useDropdownChevronManager = (
  pagerRef: React.RefObject<PagerView | null>
) => {
  const isDropdownOpen = useSharedValue(false);

  const handleOnDropdownStateChange = useCallback(
    (open: boolean) => {
      isDropdownOpen.value = open;
    },
    [isDropdownOpen]
  );

  const handleOnPressDropdownMenuItem = useCallback(
    ({ index }: DropdownMenuItemWithIndexOnActionType) => {
      pagerRef.current?.setPage(index);
    },
    [pagerRef]
  );

  return {
    handleOnDropdownStateChange,
    handleOnPressDropdownMenuItem,
    isDropdownOpen,
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
    scrollStateRef,
  } = usePagerState(options, value);
  const { tabWidths, tabHeight, allWidthsMeasured, handleMeasureOnLayout } =
    useTabMeasurements(options.length);
  const { safeInputRange, safeTranslations, safePillWidths } = usePagerMath(
    options.length,
    tabWidths
  );
  const {
    isDropdownOpen,
    handleOnDropdownStateChange,
    handleOnPressDropdownMenuItem,
  } = useDropdownChevronManager(pagerRef);

  const scrollPosition = useSharedValue(safeActiveIndex);
  const dragStartPosition = useSharedValue(0);
  const headerScaleX = useSharedValue(1);

  useEffect(() => {
    if (
      propIndex >= 0 &&
      propIndex !== currentIndexRef.current &&
      scrollStateRef.current === "idle"
    ) {
      pagerRef.current?.setPage(propIndex);
      currentIndexRef.current = propIndex;
    }
  }, [propIndex, currentIndexRef, pagerRef, scrollStateRef]);

  const scrollHandler = useEvent(
    (event: PagerViewOnPageScrollEventData) => {
      "worklet";
      scrollPosition.value = event.position + event.offset;
    },
    ["onPageScroll"]
  );

  const handlePageScrollStateChanged = useCallback(
    (e: PageScrollStateChangedNativeEvent) => {
      scrollStateRef.current = e.nativeEvent.pageScrollState;
    },
    [scrollStateRef]
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
    ({ index }: PressableWithIndexOnActionType) => {
      pagerRef.current?.setPage(index);
      currentIndexRef.current = index;
      setInternalIndex(index);
      if (options[index]?.value) {
        onValueChange?.(options[index].value);
      }
    },
    [pagerRef, currentIndexRef, setInternalIndex, options, onValueChange]
  );

  const onGestureEndOnRN = useCallback(
    (targetIndex: number) => {
      pagerRef.current?.setPage(targetIndex);
      currentIndexRef.current = targetIndex;
      setInternalIndex(targetIndex);
      triggerAndroidHaptic(AndroidHaptics.Segment_Tick, {
        mode: ImpactFeedbackStyle.Light,
        type: triggerType.Impact,
      });
      if (options[targetIndex]?.value) {
        onValueChange?.(options[targetIndex].value);
      }
    },
    [pagerRef, currentIndexRef, setInternalIndex, options, onValueChange]
  );

  const headerPanGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-10, 10])
        .failOffsetY([-15, 15])
        .onStart(() => {
          dragStartPosition.value = scrollPosition.value;
        })
        .onUpdate((event) => {
          const stepWidth = 80;
          const deltaIndex = -event.translationX / stepWidth;
          let target = dragStartPosition.value + deltaIndex;
          const maxIndex = options.length - 1;
          if (target < 0) {
            target *= 0.35;
          } else if (target > maxIndex) {
            target = maxIndex + (target - maxIndex) * 0.35;
          }
          scrollPosition.value = target;

          const stretch = Math.min(
            1.15,
            Math.max(1, 1 + Math.abs(event.velocityX) / 4000)
          );
          headerScaleX.value = stretch;
        })
        .onEnd((event) => {
          const stepWidth = 80;
          const velocityIndex = -event.velocityX / (stepWidth * 8);
          const projected = scrollPosition.value + velocityIndex;
          const maxIndex = options.length - 1;
          const clampedTarget = Math.max(
            0,
            Math.min(maxIndex, Math.round(projected))
          );

          scrollPosition.value = withSpring(clampedTarget, {
            damping: 20,
            stiffness: 300,
          });
          headerScaleX.value = withSpring(1, {
            damping: 20,
            stiffness: 320,
          });

          scheduleOnRN(onGestureEndOnRN, clampedTarget);
        }),
    [
      dragStartPosition,
      scrollPosition,
      headerScaleX,
      options.length,
      onGestureEndOnRN,
    ]
  );

  return {
    allWidthsMeasured,
    handleMeasureOnLayout,
    handleOnDropdownStateChange,
    handleOnPressDropdownMenuItem,
    handleOnPressInactiveTab,
    handlePageScrollStateChanged,
    handlePageSelected,
    headerPanGesture,
    headerScaleX,
    isDropdownOpen,
    pagerRef,
    safeActiveIndex,
    safeInputRange,
    safePillWidths,
    safeTranslations,
    scrollHandler,
    scrollPosition,
    tabHeight,
    tabWidths,
  };
};
