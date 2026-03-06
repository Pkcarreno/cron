import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  PagerViewOnPageScrollEventData,
  PagerViewOnPageSelectedEvent,
} from 'react-native-pager-view';
import type PagerView from 'react-native-pager-view';
import type { FormTabOption } from './types';
import { useEvent, useSharedValue } from 'react-native-reanimated';
import type {
  DropdownMenuItemWithIndexOnActionType,
  PressableWithIndexOnActionType,
  ViewWithIndexOnLayoutType,
} from './components/utils';
import { triggerAndroidHaptic, triggerType } from '@/helpers/haptics';
import { AndroidHaptics, ImpactFeedbackStyle } from 'expo-haptics';

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

  useEffect(() => {
    if (propIndex >= 0 && propIndex !== currentIndexRef.current) {
      pagerRef.current?.setPage(propIndex);
      currentIndexRef.current = propIndex;
    }
  }, [propIndex, currentIndexRef, pagerRef]);

  const scrollHandler = useEvent(
    (event: PagerViewOnPageScrollEventData) => {
      'worklet';
      scrollPosition.value = event.position + event.offset;
    },
    ['onPageScroll']
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
    ({ index }: PressableWithIndexOnActionType) =>
      pagerRef.current?.setPage(index),
    [pagerRef]
  );

  return {
    allWidthsMeasured,
    handleMeasureOnLayout,
    handleOnDropdownStateChange,
    handleOnPressDropdownMenuItem,
    handleOnPressInactiveTab,
    handlePageSelected,
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
