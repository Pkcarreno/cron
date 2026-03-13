import type { TickEvent } from '@/helpers/timer/tick-engine';
import { TickEngine } from '@/helpers/timer/tick-engine';
import type { TimerState, TimerStrategy } from '@/helpers/timer/strategy';
import { TimerPhase } from '@/helpers/timer/strategy';

export enum TimerEventType {
  START = 'START',
  PAUSE = 'PAUSE',
  RESET = 'RESET',
  FINISH = 'FINISH',
  GO = 'GO',
  PHASE_CHANGE = 'PHASE_CHANGE',
  ROUND_CHANGE = 'ROUND_CHANGE',
  BEEP = 'BEEP',
  TICK = 'TICK',
  CHECKPOINT = 'CHECKPOINT',
}

export interface CheckpointData {
  lap: number;
  elapsedTimeMs: number;
  lapDurationMs: number;
  lapDeltaMs: number;
}

export interface WorkoutSummary {
  totalSessionTimeMs: number;
  activeWorkoutTimeMs: number;
  roundsCompleted: number;
  fullyCompleted: boolean;
  checkpoints: CheckpointData[];
}

export interface TimerEventMap {
  [TimerEventType.START]: [];
  [TimerEventType.PAUSE]: [];
  [TimerEventType.RESET]: [];
  [TimerEventType.FINISH]: [summary: WorkoutSummary];
  [TimerEventType.GO]: [];
  [TimerEventType.PHASE_CHANGE]: [newPhase: TimerPhase];
  [TimerEventType.ROUND_CHANGE]: [newRound: number];
  [TimerEventType.BEEP]: [secondRemaining: number];
  [TimerEventType.TICK]: [state: TimerState];
  [TimerEventType.CHECKPOINT]: [lastCheckpoint: CheckpointData];
}

export type TimerEventCallback<K extends keyof TimerEventMap> = (
  ...args: TimerEventMap[K]
) => void;

export type TimerEventHandlerMap = {
  [K in keyof TimerEventMap]?: TimerEventCallback<K>;
};

export class TimerController {
  private engine: TickEngine;
  private strategy: TimerStrategy;
  private preparationTimeMs: number;
  private previousState: TimerState | null = null;
  private checkpoints: CheckpointData[] = [];
  private lastKnownElapsedMs = 0;

  private listeners: {
    [K in keyof TimerEventMap]: TimerEventCallback<K>[];
  } = {
    [TimerEventType.START]: [],
    [TimerEventType.PAUSE]: [],
    [TimerEventType.RESET]: [],
    [TimerEventType.FINISH]: [],
    [TimerEventType.GO]: [],
    [TimerEventType.PHASE_CHANGE]: [],
    [TimerEventType.ROUND_CHANGE]: [],
    [TimerEventType.BEEP]: [],
    [TimerEventType.TICK]: [],
    [TimerEventType.CHECKPOINT]: [],
  };

  constructor(strategy: TimerStrategy, preparationTimeMs: number) {
    this.strategy = strategy;
    this.preparationTimeMs = preparationTimeMs;
    this.engine = new TickEngine();

    this.engine.onTickCallbacks.push((tickEvent) => this.handleTick(tickEvent));
  }

  // oxlint-disable eslint/max-statements
  private handleTick(tickEvent: TickEvent) {
    let newState: TimerState;

    this.lastKnownElapsedMs = tickEvent.totalElapsedMs;

    if (tickEvent.totalElapsedMs < this.preparationTimeMs) {
      newState = {
        currentRound: 0,
        displayTimeMs: this.preparationTimeMs - tickEvent.totalElapsedMs,
        isFinished: false,
        phase: TimerPhase.PREPARATION,
        totalRounds: 0,
      };
    } else {
      const adjustedTick: TickEvent = {
        deltaMs: tickEvent.deltaMs,
        totalElapsedMs: tickEvent.totalElapsedMs - this.preparationTimeMs,
      };
      newState = this.strategy.calculateState(adjustedTick);
    }

    this.detectStateChanges(this.previousState, newState);

    this.previousState = newState;
    this.emit(TimerEventType.TICK, newState);

    if (newState.isFinished) {
      this.engine.pause();
    }
  }

  private generateSummary(fullyCompleted: boolean): WorkoutSummary {
    const finalState = this.previousState || {
      currentRound: 0,
      displayTimeMs: 0,
    };

    const totalSessionMs = this.lastKnownElapsedMs;

    const activeWorkoutMs = Math.max(
      0,
      totalSessionMs - this.preparationTimeMs
    );

    return {
      activeWorkoutTimeMs: activeWorkoutMs,
      checkpoints: [...this.checkpoints],
      fullyCompleted,
      roundsCompleted: finalState.currentRound,
      totalSessionTimeMs: totalSessionMs,
    };
  }

  public recordCheckpoint() {
    const lap = this.checkpoints.length + 1;

    const elapsedTimeMs = Math.max(
      0,
      this.lastKnownElapsedMs - this.preparationTimeMs
    );

    const lastElapsedTimeMs = this.checkpoints.at(-1)?.elapsedTimeMs ?? 0;

    const lapDurationMs = elapsedTimeMs - lastElapsedTimeMs;

    const lastLapDurationMs = this.checkpoints.at(-1)?.lapDurationMs ?? 0;

    const lapDeltaMs = lap === 1 ? 0 : lapDurationMs - lastLapDurationMs;

    const newCheckpoint: CheckpointData = {
      elapsedTimeMs,
      lap,
      lapDeltaMs,
      lapDurationMs,
    };

    this.checkpoints.push(newCheckpoint);

    this.emit(TimerEventType.CHECKPOINT, newCheckpoint);
  }

  private detectStateChanges(
    oldState: TimerState | null,
    newState: TimerState
  ) {
    if (!oldState) {
      return;
    }

    // detect finish
    if (!oldState.isFinished && newState.isFinished) {
      this.emit(TimerEventType.FINISH, this.generateSummary(true));
      return;
    }

    // detect workout start
    if (
      oldState.phase === TimerPhase.PREPARATION &&
      newState.phase === TimerPhase.WORK
    ) {
      this.emit(TimerEventType.GO);
      return;
    }

    this.detectRoundAndPhase(oldState, newState);
    this.detectPreparationBeep(oldState, newState);
  }

  private detectRoundAndPhase(oldState: TimerState, newState: TimerState) {
    if (
      oldState.currentRound !== newState.currentRound &&
      newState.currentRound > 0
    ) {
      this.emit(TimerEventType.ROUND_CHANGE, newState.currentRound);
    }

    if (oldState.phase !== newState.phase && !newState.isFinished) {
      this.emit(TimerEventType.PHASE_CHANGE, newState.phase);
    }
  }

  private detectPreparationBeep(oldState: TimerState, newState: TimerState) {
    if (newState.phase !== TimerPhase.PREPARATION) {
      return;
    }

    const oldSeconds = Math.ceil(oldState.displayTimeMs / 1000);
    const newSeconds = Math.ceil(newState.displayTimeMs / 1000);

    if (oldSeconds !== newSeconds && newSeconds <= 3 && newSeconds > 0) {
      this.emit(TimerEventType.BEEP, newSeconds);
    }
  }

  public getSummary(): WorkoutSummary {
    const currentState = this.previousState || {
      isFinished: false,
    };

    return this.generateSummary(currentState.isFinished);
  }

  public removeAllListeners() {
    this.listeners = {
      [TimerEventType.START]: [],
      [TimerEventType.PAUSE]: [],
      [TimerEventType.RESET]: [],
      [TimerEventType.FINISH]: [],
      [TimerEventType.GO]: [],
      [TimerEventType.PHASE_CHANGE]: [],
      [TimerEventType.ROUND_CHANGE]: [],
      [TimerEventType.BEEP]: [],
      [TimerEventType.TICK]: [],
      [TimerEventType.CHECKPOINT]: [],
    };
  }

  public dispose() {
    this.engine.pause();
    this.checkpoints = [];
    this.removeAllListeners();
  }

  public finishTimer() {
    this.engine.pause();

    const isCompleted = this.previousState?.isFinished || false;

    this.emit(TimerEventType.FINISH, this.generateSummary(isCompleted));
    this.removeAllListeners();
  }

  public on<K extends keyof TimerEventMap>(
    event: K,
    listener: TimerEventCallback<K>
  ) {
    this.listeners[event].push(listener);
  }

  private emit<K extends keyof TimerEventMap>(
    event: K,
    ...args: TimerEventMap[K]
  ) {
    for (const listener of this.listeners[event]) {
      try {
        listener(...args);
      } catch (error) {
        console.error('[TimerController] error on emit callback', error);
      }
    }
  }

  public start() {
    this.emit(TimerEventType.START);
    this.engine.start();
  }

  public pause() {
    this.emit(TimerEventType.PAUSE);
    this.engine.pause();
  }
  public reset() {
    this.emit(TimerEventType.RESET);
    this.checkpoints = [];
    this.engine.reset();
  }
}
