import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '@/components/text';
import Button from '@/components/button';
import { TimerMode } from '@/helpers/timer/factory';
import {
  formatDuration,
  formatFullTimeToString,
} from '@/helpers/timer/utils/formatter';
import { Logo } from '@/components/logo';
import type { UIWorkoutSummary } from '@/hooks/use-timer';
import { colors } from '@/helpers/colors';
import { Col, Grid, Row } from '@/components/grid';

interface Props {
  summary: UIWorkoutSummary | undefined;
  mode: TimerMode;
  handleEndSession: () => void;
  handleResumeSession: () => void;
}

export const SummaryFace: React.FC<Props> = ({
  summary,
  mode,
  handleEndSession,
  handleResumeSession,
}) => {
  const formattedStartTime = summary?.startedAt?.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
  const formattedEndTime = summary?.endedAt?.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.info}>
          <Text>session summary</Text>
          <Text colorSubtone="200" weight="600" size={24}>
            {mode}
          </Text>
          <Text size={12}>
            {formattedStartTime} - {formattedEndTime}
          </Text>
        </View>
        <Logo />
      </View>

      <View style={styles.content}>
        <RenderData summary={summary} />

        <RenderCheckpoints
          summary={summary}
          lapLabel={TimerMode.AMRAP === mode ? 'Round' : 'Lap'}
        />

        <View style={styles.mention}>
          <Text colorSubtone="600" size={12}>
            with cron timer
          </Text>
        </View>
      </View>

      <View style={styles.footer}>
        {!summary?.fullyCompleted && (
          <Button
            title="Resume workout"
            variant="secondary"
            onPress={handleResumeSession}
          />
        )}
        <Button title="Back to menu" onPress={handleEndSession} />
      </View>
    </SafeAreaView>
  );
};

type RenderDataProps = Pick<Props, 'summary'>;

const RenderData: React.FC<RenderDataProps> = ({ summary }) => {
  if (!summary) {
    return (
      <View style={styles.data}>
        <Text size={16}>No data to show</Text>
      </View>
    );
  }

  const totalTime = formatFullTimeToString(summary.totalSessionTimeMs);
  const activeTime = formatFullTimeToString(summary.activeWorkoutTimeMs);

  return (
    <View style={styles.dataWrapper}>
      <View style={styles.data}>
        <Text size={16}>Total Time</Text>
        <Text
          style={styles.numberText}
          colorSubtone="200"
          weight="600"
          size={16}
        >
          {totalTime}
        </Text>
      </View>

      <View style={styles.data}>
        <Text size={16}>Active Time</Text>
        <Text
          style={styles.numberText}
          colorSubtone="200"
          weight="600"
          size={16}
        >
          {activeTime}
        </Text>
      </View>

      {summary.roundsCompleted > 1 && (
        <View style={styles.data}>
          <Text size={16}>Rounds</Text>
          <Text
            style={styles.numberText}
            colorSubtone="200"
            weight="600"
            size={16}
          >
            {summary.roundsCompleted}
          </Text>
        </View>
      )}
    </View>
  );
};

interface RenderCheckpointsProps {
  summary?: UIWorkoutSummary;
  lapLabel: string;
}

const RenderCheckpoints: React.FC<RenderCheckpointsProps> = ({
  summary,
  lapLabel,
}) => {
  if (!summary || summary.checkpoints.length === 0) {
    return;
  }

  return (
    <ScrollView stickyHeaderIndices={[0]} style={checkpointsStyle.container}>
      <Grid
        columns={4}
        gap={8}
        style={[checkpointsStyle.header, checkpointsStyle.containerPadding]}
      >
        <Row>
          <Col style={checkpointsStyle.gridColumnLeft}>
            <Text colorSubtone="300" weight="600">
              {lapLabel}
            </Text>
          </Col>
          <Col style={checkpointsStyle.gridColumnCenter}>
            <Text colorSubtone="300" weight="600">
              Time
            </Text>
          </Col>
          <Col style={checkpointsStyle.gridColumnCenter}>
            <Text colorSubtone="300" weight="600">
              Duration
            </Text>
          </Col>
          <Col style={checkpointsStyle.gridColumnRight}>
            <Text colorSubtone="300" weight="600">
              Delta
            </Text>
          </Col>
        </Row>
      </Grid>
      <Grid columns={4} gap={8} style={checkpointsStyle.containerPadding}>
        {summary.checkpoints.map((item) => {
          const isDeltaColored = item.lapDeltaMs !== 0;
          const deltaColor =
            item.lapDeltaMs > 0 ? 'redHighlight' : 'greenHighlight';
          return (
            <Row key={`${item.lap}-${item.elapsedTimeMs}`}>
              <Col style={checkpointsStyle.gridColumnLeft}>
                <Text fontType="mono">{item.lap}</Text>
              </Col>
              <Col style={checkpointsStyle.gridColumnCenter}>
                <Text fontType="mono">
                  {formatDuration(item.elapsedTimeMs)}
                </Text>
              </Col>
              <Col style={checkpointsStyle.gridColumnCenter}>
                <Text fontType="mono">
                  {formatDuration(item.lapDurationMs)}
                </Text>
              </Col>
              <Col style={checkpointsStyle.gridColumnRight}>
                <Text
                  fontType="mono"
                  color={isDeltaColored ? deltaColor : undefined}
                >
                  {formatDuration(item.lapDeltaMs, true)}
                </Text>
              </Col>
            </Row>
          );
        })}
      </Grid>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: 12,
    paddingBottom: 12,
    paddingHorizontal: 20,
  },
  content: {
    flex: 1,
    gap: 16,
    paddingVertical: 12,
  },
  data: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  dataWrapper: {
    gap: 8,
  },
  footer: {
    gap: 8,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  info: {
    gap: 4,
  },
  mention: {
    alignItems: 'center',
  },
  numberText: {
    fontVariant: ['tabular-nums'],
  },
});

const checkpointsStyle = StyleSheet.create({
  container: {
    backgroundColor: colors.neutral[900],
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  containerPadding: {
    paddingVertical: 4,
  },
  gridColumnCenter: {
    alignItems: 'center',
  },
  gridColumnLeft: {
    alignItems: 'flex-start',
  },
  gridColumnRight: {
    alignItems: 'flex-end',
  },
  header: {
    backgroundColor: colors.neutral[900],
  },
});
