import React, {
  useRef,
  useEffect,
  useCallback,
  useState,
  useMemo,
} from 'react';
import type {
  NativeSyntheticEvent,
  NativeScrollEvent,
  LayoutChangeEvent,
} from 'react-native';
import { View, StyleSheet } from 'react-native';
import { FlatList } from 'react-native-gesture-handler';
import { colors } from '@/helpers/colors';
import { Text } from './text';
import { AndroidHaptics, ImpactFeedbackStyle } from 'expo-haptics';
import {
  triggerAndroidHaptic,
  triggerHaptic,
  triggerType,
} from '@/helpers/haptics';

const TICK_WIDTH = 16;

export interface InputThumbwheelProps {
  value: number;
  onChangeValue?: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
}

interface TickProps {
  index: number;
  min: number;
  step: number;
}

const keyExtractor = (item: number) => item.toString();

const getItemLayout = (_: unknown, index: number) => ({
  index,
  length: TICK_WIDTH,
  offset: TICK_WIDTH * index,
});

const getThumbwheelData = (min: number, max: number, step: number) => {
  const totalTicks = Math.round((max - min) / step) + 1;
  return {
    data: Array.from({ length: totalTicks }, (_, i) => i),
    totalTicks,
  };
};

const getScrollMetrics = (offsetX: number, totalTicks: number) => {
  const rawIndex = Math.max(0, offsetX) / TICK_WIDTH;
  const closestIndex = Math.max(
    0,
    Math.min(Math.round(rawIndex), totalTicks - 1)
  );
  return { closestIndex, distanceToCenter: Math.abs(rawIndex - closestIndex) };
};

interface ScrollState {
  isScrolling: boolean;
  isProgrammatic: boolean;
  isInitialMount: boolean;
  lastHapticTime: number;
}

const processHaptics = (
  newValue: number,
  min: number,
  max: number,
  scrollState: React.RefObject<ScrollState>
) => {
  const now = Date.now();
  const isLimit = newValue === min || newValue === max;
  const isMajor = Math.abs(newValue % 5) < 0.001;

  if (now - scrollState.current.lastHapticTime > 40 || isLimit || isMajor) {
    if (isLimit) {
      triggerHaptic({
        mode: ImpactFeedbackStyle.Rigid,
        type: triggerType.Impact,
      });
    } else if (isMajor) {
      triggerAndroidHaptic(AndroidHaptics.Segment_Tick, {
        mode: ImpactFeedbackStyle.Light,
        type: triggerType.Impact,
      });
    } else {
      triggerAndroidHaptic(AndroidHaptics.Segment_Frequent_Tick, {
        type: triggerType.Selection,
      });
    }
    scrollState.current.lastHapticTime = now;
  }
};

const getUpdatedValue = (
  closestIndex: number,
  lastIndex: number,
  distance: number,
  params: { min: number; step: number }
) => {
  const isNearCenter = distance < 0.3;
  const isFastScroll = Math.abs(closestIndex - lastIndex) > 1;

  if (isNearCenter || isFastScroll) {
    return Number.parseFloat(
      (params.min + closestIndex * params.step).toFixed(2)
    );
  }
  return null;
};

const useThumbwheelLogic = (
  value: number,
  min: number,
  max: number,
  step: number,
  onChangeValue?: (value: number) => void
) => {
  const [dynamicPadding, setDynamicPadding] = useState(0);
  const flatListRef = useRef<FlatList<number>>(null);

  const initialIndex = Math.round(
    (Math.max(min, Math.min(value, max)) - min) / step
  );
  const lastReportedIndex = useRef<number>(initialIndex);

  const scrollState = useRef({
    isInitialMount: true,
    isProgrammatic: false,
    isScrolling: false,
    lastHapticTime: 0,
  });

  const { totalTicks, data } = useMemo(
    () => getThumbwheelData(min, max, step),
    [min, max, step]
  );

  useEffect(() => {
    if (!scrollState.current.isScrolling && flatListRef.current) {
      const safeValue = Math.min(Math.max(value, min), max);
      const index = Math.round((safeValue - min) / step);

      if (
        !scrollState.current.isInitialMount &&
        index === lastReportedIndex.current
      ) {
        return;
      }

      scrollState.current.isProgrammatic = true;
      lastReportedIndex.current = index;

      setTimeout(() => {
        flatListRef.current?.scrollToOffset({
          animated: !scrollState.current.isInitialMount,
          offset: index * TICK_WIDTH,
        });
        scrollState.current.isInitialMount = false;
      }, 50);
    }
  }, [value, min, max, step, dynamicPadding]);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { closestIndex, distanceToCenter } = getScrollMetrics(
        event.nativeEvent.contentOffset.x,
        totalTicks
      );

      if (closestIndex === lastReportedIndex.current) {
        return;
      }

      const newValue = getUpdatedValue(
        closestIndex,
        lastReportedIndex.current,
        distanceToCenter,
        { min, step }
      );

      if (newValue !== null) {
        lastReportedIndex.current = closestIndex;
        if (!scrollState.current.isProgrammatic) {
          processHaptics(newValue, min, max, scrollState);
          onChangeValue?.(newValue);
        }
      }
    },
    [min, max, step, totalTicks, onChangeValue]
  );

  const scrollHandlers = useMemo(
    () => ({
      onMomentumScrollEnd: () => {
        scrollState.current.isScrolling = false;
      },
      onScrollAnimationEnd: () => {
        scrollState.current.isProgrammatic = false;
      },
      onScrollBeginDrag: () => {
        scrollState.current.isScrolling = true;
        scrollState.current.isProgrammatic = false;
      },
      onScrollEndDrag: (e: NativeSyntheticEvent<NativeScrollEvent>) => {
        if (e.nativeEvent.velocity?.x === 0) {
          scrollState.current.isScrolling = false;
        }
      },
    }),
    []
  );

  return {
    data,
    dynamicPadding,
    flatListRef,
    handleScroll,
    scrollHandlers,
    setDynamicPadding,
  };
};

const InputThumbwheel: React.FC<InputThumbwheelProps> = ({
  value,
  onChangeValue,
  min = 0,
  max = 200,
  step = 1,
}) => {
  const {
    dynamicPadding,
    setDynamicPadding,
    flatListRef,
    data,
    handleScroll,
    scrollHandlers,
  } = useThumbwheelLogic(value, min, max, step, onChangeValue);

  const handleLayout = useCallback(
    (e: LayoutChangeEvent) => {
      setDynamicPadding(e.nativeEvent.layout.width / 2 - TICK_WIDTH / 2);
    },
    [setDynamicPadding]
  );

  const renderItem = useCallback(
    ({ item: index }: { item: number }) => (
      <Tick index={index} min={min} step={step} />
    ),
    [min, step]
  );

  return (
    <View style={styles.container} onLayout={handleLayout}>
      <View style={styles.centerIndicator} pointerEvents="none" />

      {dynamicPadding > 0 && (
        <FlatList
          ref={flatListRef}
          horizontal
          data={data}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          showsHorizontalScrollIndicator={false}
          snapToInterval={TICK_WIDTH}
          decelerationRate="fast"
          bounces={false}
          scrollEventThrottle={16}
          nestedScrollEnabled={true}
          contentContainerStyle={{ paddingHorizontal: dynamicPadding }}
          onScroll={handleScroll}
          getItemLayout={getItemLayout}
          {...scrollHandlers}
        />
      )}
    </View>
  );
};

export default InputThumbwheel;

const Tick = React.memo(({ index, min, step }: TickProps) => {
  const currentValue = min + index * step;
  const isMajor = currentValue % 5 === 0;

  return (
    <View style={tickStyles.container}>
      <View
        style={[tickStyles.line, isMajor ? tickStyles.major : tickStyles.minor]}
      />
      {isMajor && (
        <Text
          weight="400"
          colorSubtone="800"
          size={10}
          style={tickStyles.label}
        >
          {currentValue}
        </Text>
      )}
    </View>
  );
});

Tick.displayName = 'Tick';

const styles = StyleSheet.create({
  centerIndicator: {
    backgroundColor: colors.red,
    borderRadius: 8,
    height: 44,
    left: '50%',
    marginLeft: -1.5,
    marginTop: -12,
    position: 'absolute',
    width: 3,
    zIndex: 10,
  },
  container: {
    backgroundColor: colors.neutral[400],
    borderRadius: 16,
    height: 80,
    justifyContent: 'center',
    overflow: 'hidden',
  },
});

const tickStyles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 10,
    width: TICK_WIDTH,
  },
  label: {
    bottom: 5,
    left: (TICK_WIDTH - 60) / 2,
    position: 'absolute',
    textAlign: 'center',
    width: 60,
  },
  line: {
    backgroundColor: colors.neutral[800],
    borderRadius: 8,
    width: 1.5,
  },
  major: {
    height: 34,
    width: 2,
  },
  minor: {
    height: 24,
    opacity: 0.5,
  },
});
