import React, { useEffect, useRef, useMemo } from 'react';
import type { NativeSyntheticEvent } from 'react-native';
import { View, StyleSheet } from 'react-native';
import type { PagerViewOnPageScrollEventData } from 'react-native-pager-view';
import PagerView from 'react-native-pager-view';
import Animated, {
  useAnimatedStyle,
  interpolate,
  Extrapolation,
  createAnimatedComponent,
  withTiming,
} from 'react-native-reanimated';
import { Text } from '@/components/ui/text';
import { colors } from '@/helpers/colors';
import { CaretDownIcon } from 'phosphor-react-native';
import {
  DropdownMenuItemWithIndex,
  PressableWithIndex,
  ViewWithIndexOnLayout,
} from './components/utils';
import type { FormTabOption } from './types';
import { AnimatedTabWrapper } from './components/animated-tab';
import {
  ICON_SPACE,
  sharedStyles,
  TAB_FONT_SIZE,
  TAB_ICON_SIZE,
} from './shared';
import { useFormPager } from './use-form-pager';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const AnimatedPagerView = createAnimatedComponent(PagerView);

interface FormPagerProps<T extends string> {
  options: FormTabOption<T>[];
  value?: T;
  onValueChange?: (value: T) => void;
}

export const FormPager = <T extends string>({
  value,
  onValueChange,
  options,
}: FormPagerProps<T>) => {
  const {
    pagerRef,
    scrollPosition,
    safeActiveIndex,
    tabWidths,
    tabHeight,
    allWidthsMeasured,
    safeInputRange,
    safeTranslations,
    safePillWidths,
    scrollHandler,
    handlePageSelected,
    handleMeasureOnLayout,
    handleOnPressInactiveTab,
    isDropdownOpen,
    handleOnPressDropdownMenuItem,
    handleOnDropdownStateChange,
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

  const textRowAnimatedStyle = useAnimatedStyle(() => {
    if (!allWidthsMeasured) {
      return { transform: [{ translateX: 0 }] };
    }
    const translateX = interpolate(
      scrollPosition.value,
      safeInputRange,
      safeTranslations,
      Extrapolation.CLAMP
    );
    return { transform: [{ translateX }] };
  }, [allWidthsMeasured, safeInputRange, safeTranslations]);

  const activeZoneAnimatedStyle = useAnimatedStyle(() => {
    if (!allWidthsMeasured) {
      return { width: 0 };
    }
    const width = interpolate(
      scrollPosition.value,
      safeInputRange,
      safePillWidths,
      Extrapolation.CLAMP
    );
    return { width: width + ICON_SPACE };
  }, [allWidthsMeasured, safeInputRange, safePillWidths]);

  const tabBarContainerHeightStyles = useMemo(
    () => ({
      height: tabHeight > 0 ? tabHeight : 26,
    }),
    [tabHeight]
  );
  const tabBarContainerOpacityStyles = useMemo(
    () => ({
      opacity: allWidthsMeasured ? 1 : 0,
    }),
    [allWidthsMeasured]
  );

  const chevronAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      {
        rotate: withTiming(isDropdownOpen.value ? '180deg' : '0deg', {
          duration: 150,
        }),
      },
    ],
  }));

  return (
    <View style={styles.container}>
      <View style={hiddenMeasureStyles.container}>
        {options.map((option, index) => (
          <ViewWithIndexOnLayout
            key={`measure-${option.value || 'undef'}`}
            index={index}
            onLayout={handleMeasureOnLayout}
            style={sharedStyles.pillLayout}
          >
            <Text size={TAB_FONT_SIZE} color="black" weight="500">
              {option.label}
            </Text>
          </ViewWithIndexOnLayout>
        ))}
      </View>

      <View
        style={[
          tabBarStyles.container,
          tabBarContainerHeightStyles,
          tabBarContainerOpacityStyles,
        ]}
      >
        <Animated.View style={[tabBarStyles.movingTrack, textRowAnimatedStyle]}>
          {options.map((option, index) => (
            <PressableWithIndex
              key={`inactive-${option.value || 'undef'}`}
              index={index}
              onAction={handleOnPressInactiveTab}
            >
              <AnimatedTabWrapper
                index={index}
                scrollPosition={scrollPosition}
                baseWidth={tabWidths[index]}
              >
                <Text weight="200" size={TAB_FONT_SIZE}>
                  {option.label}
                </Text>
              </AnimatedTabWrapper>
            </PressableWithIndex>
          ))}
        </Animated.View>

        <Animated.View
          style={[tabBarStyles.activeZone, activeZoneAnimatedStyle]}
        >
          <DropdownMenu onOpenChange={handleOnDropdownStateChange}>
            <DropdownMenuTrigger>
              <Animated.View
                style={[tabBarStyles.textRow, textRowAnimatedStyle]}
              >
                {options.map((option, index) => (
                  <AnimatedTabWrapper
                    key={`active-${option.value || 'undef'}`}
                    index={index}
                    scrollPosition={scrollPosition}
                    baseWidth={tabWidths[index]}
                  >
                    <Text size={TAB_FONT_SIZE} weight="500" color="black">
                      {option.label}
                    </Text>
                  </AnimatedTabWrapper>
                ))}
              </Animated.View>
              <Animated.View
                style={[tabBarStyles.dropdownIcon, chevronAnimatedStyle]}
              >
                <CaretDownIcon color={colors.black} size={TAB_ICON_SIZE} />
              </Animated.View>
            </DropdownMenuTrigger>

            <DropdownMenuContent sideOffset={8}>
              {options.map((option, index) => (
                <DropdownMenuItemWithIndex
                  key={option.value}
                  index={index}
                  disabled={safeActiveIndex === index}
                  onAction={handleOnPressDropdownMenuItem}
                >
                  <DropdownMenuLabel>{option.label}</DropdownMenuLabel>
                </DropdownMenuItemWithIndex>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </Animated.View>
      </View>

      <AnimatedPagerView
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
          <View key={`page-${option.value || 'undef'}`} style={styles.page}>
            {option.content}
          </View>
        ))}
      </AnimatedPagerView>
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

const hiddenMeasureStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    opacity: 0,
    pointerEvents: 'none',
    position: 'absolute',
  },
});

const tabBarStyles = StyleSheet.create({
  activeZone: {
    backgroundColor: colors.white,
    borderRadius: 12,
    height: '100%',
    left: 0,
    overflow: 'hidden',
    position: 'absolute',
    zIndex: 2,
  },
  container: {
    marginHorizontal: 20,
    position: 'relative',
  },
  dropdownIcon: {
    height: '100%',
    justifyContent: 'center',
    position: 'absolute',
    right: 12,
  },
  movingTrack: {
    backgroundColor: colors.neutral[700],
    borderRadius: 12,
    flexDirection: 'row',
    height: '100%',
    left: 0,
    position: 'absolute',
  },
  textRow: {
    flexDirection: 'row',
    height: '100%',
  },
});
