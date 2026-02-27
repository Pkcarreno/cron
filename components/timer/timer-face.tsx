import { colors } from '@/helpers/colors';
import { TimerPhase } from '@/helpers/timer/strategy';
import type { timerType } from '@/hooks/use-timer';
import type { FC } from 'react';
import { useMemo } from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface Props extends Pick<
  timerType,
  'flags' | 'minutes' | 'seconds' | 'currentRound' | 'phase' | 'modeAbbr'
> {
  currentTime: string;
  isLowBattery: boolean;
}

export const TimerFace: FC<Props> = ({
  minutes,
  seconds,
  modeAbbr,
  currentRound,
  phase,
  currentTime,
  isLowBattery,
  flags,
}) => {
  const insets = useSafeAreaInsets();

  const phaseColor = useMemo(() => {
    if (phase === TimerPhase.REST) {
      return contextInfoStyles.phaseTextColorGreen;
    }
    if (phase === TimerPhase.WORK) {
      return contextInfoStyles.phaseTextColorBlue;
    }

    return contextInfoStyles.phaseTextColorGray;
  }, [phase]);

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
          <Text
            style={[
              statusBarStyles.text,
              statusBarStyles.lowBatAlertText,
              !isLowBattery && styles.hide,
            ]}
          >
            low bat
          </Text>
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
        <View style={contextInfoStyles.container}>
          <View style={contextInfoStyles.phaseStatusWrapper}>
            {flags.showsPhaseIndicator && (
              <Text style={[contextInfoStyles.phaseStatusWorkText, phaseColor]}>
                {phase}
              </Text>
            )}
          </View>
          {flags.showsRoundCounter && (
            <View style={contextInfoStyles.roundCounterWrapper}>
              <Text style={contextInfoStyles.roundCounterText}>
                {currentRound}
              </Text>
            </View>
          )}
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
  lowBatAlertText: {
    color: colors.red,
    opacity: 0.7,
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
  phaseStatusWorkText: {
    fontFamily: 'Geist Mono',
    fontSize: contextFontSize,
    fontWeight: '900',
    lineHeight: contextFontSize,
  },
  phaseStatusWrapper: {},
  phaseTextColorBlue: {
    color: colors.blue,
  },
  phaseTextColorGray: {
    color: colors.neutral[400],
  },
  phaseTextColorGreen: {
    color: colors.green,
  },
  roundCounterText: {
    color: colors.neutral[400],
    fontFamily: 'Geist Mono',
    fontSize: roundFontSize,
    fontWeight: '400',
    lineHeight: roundFontSize,
  },
  roundCounterWrapper: {},
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
