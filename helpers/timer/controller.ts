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
}

export interface TimerEventMap {
  [TimerEventType.START]: [];
  [TimerEventType.PAUSE]: [];
  [TimerEventType.RESET]: [];
  [TimerEventType.FINISH]: [];
  [TimerEventType.GO]: [];
  [TimerEventType.PHASE_CHANGE]: [newPhase: TimerPhase];
  [TimerEventType.ROUND_CHANGE]: [newRound: number];
  [TimerEventType.BEEP]: [secondRemaining: number];
  [TimerEventType.TICK]: [state: TimerState];
}

export type TimerEventCallback<K extends keyof TimerEventMap> = (
  ...args: TimerEventMap[K]
) => void;

export class TimerController {
  private engine: TickEngine;
  private strategy: TimerStrategy;
  private preparationTimeMs: number;
  private previousState: TimerState | null = null;

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
  };

  constructor(strategy: TimerStrategy, preparationTimeMs: number) {
    this.strategy = strategy;
    this.preparationTimeMs = preparationTimeMs;
    this.engine = new TickEngine();

    this.engine.onTickCallbacks.push((tickEvent) => this.handleTick(tickEvent));
  }

  private handleTick(tickEvent: TickEvent) {
    let newState: TimerState;

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

  private detectStateChanges(
    oldState: TimerState | null,
    newState: TimerState
  ) {
    if (!oldState) {
      return;
    }

    // detect finish
    if (!oldState.isFinished && newState.isFinished) {
      this.emit(TimerEventType.FINISH);
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
    };
  }

  public dispose() {
    this.engine.pause();
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
    this.engine.reset();
  }
}
