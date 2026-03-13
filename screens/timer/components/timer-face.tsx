import { colors } from '@/helpers/colors';
import { useIsLowBattery } from '@/hooks/use-is-low-battery';
import type { timerType } from '@/hooks/use-timer';
import { useKeepAwake } from 'expo-keep-awake';
import type { FC } from 'react';
import { useMemo } from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ContextFormatType } from '@/screens/timer/types';

interface Props extends Pick<
  timerType,
  'flags' | 'hours' | 'minutes' | 'seconds' | 'modeAbbr'
> {
  lap: number | undefined;
  split: number | undefined;
  currentTime: string;
  contextLabel: ContextFormatType['value'];
  contextLabelColor?: ContextFormatType['color'];
  contextValue: ContextFormatType['value'];
  contextValueColor?: ContextFormatType['color'];
}

export const TimerFace: FC<Props> = ({
  hours,
  minutes,
  seconds,
  modeAbbr,
  contextLabel,
  contextLabelColor,
  contextValue,
  contextValueColor,
  currentTime,
  lap,
  split,
  flags,
}) => {
  const insets = useSafeAreaInsets();
  const isLowBattery = useIsLowBattery();

  const contextLabelTextExternalStyles = useMemo(() => {
    if (contextLabelColor) {
      return {
        color: contextLabelColor,
      };
    }

    return {};
  }, [contextLabelColor]);

  const contextValueTextExternalStyles = useMemo(() => {
    if (contextValueColor) {
      return {
        color: contextValueColor,
      };
    }

    return {};
  }, [contextValueColor]);

  const quickAccessInfo = useMemo(
    () =>
      [
        isLowBattery ? '[BAT LOW]' : null,
        hours ? `${hours}H` : null,
        lap && lap > 0 ? `L${lap.toString().padStart(2, '0')}` : null,
        split && split > 0 ? `+${(split / 1000).toFixed(3)}s` : null,
      ].filter(Boolean),
    [hours, lap, split, isLowBattery]
  );

  useKeepAwake();

  return (
    <View style={styles.container}>
      <View
        style={[
          statusBarStyles.container,
          {
            height: insets.top,
            paddingLeft: insets.left,
            paddingRight: insets.right,
          },
        ]}
      >
        <View style={statusBarStyles.leftWrapper}>
          <Text style={statusBarStyles.text}>{modeAbbr}</Text>
        </View>
        <View style={statusBarStyles.rightWrapper}>
          <Text style={[statusBarStyles.text, statusBarStyles.localTimeText]}>
            {currentTime}
          </Text>
        </View>
      </View>

      <View
        style={[
          styles.contentWrapper,
          {
            paddingBottom: insets.bottom,
            paddingLeft: insets.left,
            paddingRight: insets.right,
          },
        ]}
      >
        {!flags.isPreparing && (
          <View style={quickAccessStyles.container}>
            {quickAccessInfo.map((data, index) => (
              <View key={data} style={quickAccessStyles.itemWrapper}>
                <Text style={statusBarStyles.text}>{data}</Text>

                {index < quickAccessInfo.length - 1 && (
                  <Text style={statusBarStyles.text}> | </Text>
                )}
              </View>
            ))}
          </View>
        )}

        <View style={contextInfoStyles.container}>
          <View style={contextInfoStyles.labelWrapper}>
            <Text
              style={[
                contextInfoStyles.labelText,
                contextLabelTextExternalStyles,
              ]}
            >
              {contextLabel}
            </Text>
          </View>
          <View style={contextInfoStyles.valueWrapper}>
            <Text
              style={[
                contextInfoStyles.valueText,
                contextValueTextExternalStyles,
              ]}
            >
              {contextValue}
            </Text>
          </View>
        </View>

        <View style={timeStyles.container}>
          <View
            style={[
              timeStyles.digitsWrapper,
              !flags.showsMinuteDigits && styles.hide,
            ]}
          >
            <Text
              style={timeStyles.digits}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {minutes}
            </Text>
          </View>
          <View style={timeStyles.digitsWrapper}>
            <Text
              style={timeStyles.digits}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {seconds}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
};

const { width } = Dimensions.get('window');
const giantFontSize = width * 0.75;
const contextFontSize = width * 0.25;
const roundFontSize = width * 0.22;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentWrapper: {
    flex: 1,
  },
  hide: {
    opacity: 0,
  },
});

const statusBarStyles = StyleSheet.create({
  container: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
  },
  leftWrapper: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'flex-start',
    paddingLeft: 16,
  },
  localTimeText: {
    color: colors.neutral[500],
  },
  rightWrapper: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'flex-end',
    paddingRight: 16,
  },
  text: {
    color: colors.neutral[400],
    fontFamily: 'Geist Mono',
    fontSize: 18,
    fontWeight: '300',
  },
});

const contextInfoStyles = StyleSheet.create({
  container: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    width: '100%',
  },
  labelText: {
    color: colors.neutral[400],
    fontFamily: 'Geist Mono',
    fontSize: contextFontSize,
    fontWeight: '900',
    lineHeight: contextFontSize,
  },
  labelWrapper: {},
  valueText: {
    color: colors.neutral[400],
    fontFamily: 'Geist Mono',
    fontSize: roundFontSize,
    fontWeight: '400',
    lineHeight: roundFontSize,
  },
  valueWrapper: {},
});

const quickAccessStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 16,
  },
  itemWrapper: {
    flexDirection: 'row',
    gap: 8,
  },
});

const timeStyles = StyleSheet.create({
  container: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  digits: {
    color: colors.white,
    fontFamily: 'Geist Mono',
    fontSize: giantFontSize,
    fontWeight: '700',
    includeFontPadding: false,
    lineHeight: giantFontSize,
    textAlign: 'center',
    textAlignVertical: 'center',
    width: '100%',
  },
  digitsWrapper: {
    justifyContent: 'center',
    overflow: 'visible',
    width: '100%',
  },
});
