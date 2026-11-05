import type { AppStateStatus } from "react-native";
import { AppState } from "react-native";

import type { PhaseMilestones } from "@/helpers/timer/milestone-scheduler";
import {
  calculatePhaseMilestones,
  MilestoneScheduler,
} from "@/helpers/timer/milestone-scheduler";
import type {
  PhaseDetails,
  TimerState,
  TimerStrategy,
} from "@/helpers/timer/strategy";
import { TimerPhase } from "@/helpers/timer/strategy";
import type { TickEvent } from "@/helpers/timer/tick-engine";
import { TickEngine } from "@/helpers/timer/tick-engine";

export enum TimerEventType {
  START = "START",
  PAUSE = "PAUSE",
  RESET = "RESET",
  COMPLETED = "COMPLETED",
  GO = "GO",
  PHASE_CHANGE = "PHASE_CHANGE",
  ROUND_CHANGE = "ROUND_CHANGE",
  BEEP = "BEEP",
  TICK = "TICK",
  UI_TICK = "UI_TICK",
  CHECKPOINT = "CHECKPOINT",
  TRANSITION_APPROACHING = "TRANSITION_APPROACHING",
}

export interface CheckpointData {
  lap: number;
  elapsedTimeMs: number;
  lapDurationMs: number;
  lapDeltaMs: number;
}

export interface SessionSummary {
  totalSessionTimeMs: number;
  activeSessionTimeMs: number;
  roundsCompleted: number;
  fullyCompleted: boolean;
  checkpoints: CheckpointData[];
}

export interface TimerEventMap {
  [TimerEventType.START]: [];
  [TimerEventType.PAUSE]: [];
  [TimerEventType.RESET]: [];
  [TimerEventType.COMPLETED]: [summary: SessionSummary];
  [TimerEventType.GO]: [];
  [TimerEventType.PHASE_CHANGE]: [newPhase: TimerPhase];
  [TimerEventType.ROUND_CHANGE]: [newRound: number];
  [TimerEventType.BEEP]: [secondRemaining: number];
  [TimerEventType.TICK]: [state: TimerState];
  [TimerEventType.UI_TICK]: [state: TimerState];
  [TimerEventType.CHECKPOINT]: [lastCheckpoint: CheckpointData];
  [TimerEventType.TRANSITION_APPROACHING]: [];
}

export type TimerEventCallback<K extends keyof TimerEventMap> = (
  ...args: TimerEventMap[K]
) => void;

export type TimerEventHandlerMap = {
  [K in keyof TimerEventMap]?: TimerEventCallback<K>;
};

export interface TimerControllerOptions {
  uiTickResolutionMs?: number;
  appState?: typeof AppState;
  highPrecision?: boolean;
  milestoneScheduler?: MilestoneScheduler;
}

export class TimerController {
  private engine: TickEngine;
  private strategy: TimerStrategy;
  private milestoneScheduler: MilestoneScheduler;
  private preparationTimeMs: number;

  private uiTickResolutionMs: number | null = null;
  private previousState: TimerState | null = null;
  private lastUiTickState: TimerState | null = null;
  private lastEmittedUiSecond: number | null = null;
  private lastEmittedQuantizedStep: number | null = null;
  private checkpoints: CheckpointData[] = [];
  private lastKnownElapsedMs = 0;
  private isVisualUpdatesPaused = false;
  private currentAppState: AppStateStatus = "active";
  private appStateSubscription: { remove: () => void } | null = null;
  private hasEmittedApproachingTransition = false;

  private listeners: {
    [K in keyof TimerEventMap]: TimerEventCallback<K>[];
  } = {
    [TimerEventType.START]: [],
    [TimerEventType.PAUSE]: [],
    [TimerEventType.RESET]: [],
    [TimerEventType.COMPLETED]: [],
    [TimerEventType.GO]: [],
    [TimerEventType.PHASE_CHANGE]: [],
    [TimerEventType.ROUND_CHANGE]: [],
    [TimerEventType.BEEP]: [],
    [TimerEventType.TICK]: [],
    [TimerEventType.UI_TICK]: [],
    [TimerEventType.CHECKPOINT]: [],
    [TimerEventType.TRANSITION_APPROACHING]: [],
  };

  constructor(
    strategy: TimerStrategy,
    preparationTimeMs: number,
    options?: TimerControllerOptions | number
  ) {
    this.strategy = strategy;
    this.preparationTimeMs = preparationTimeMs;

    this.milestoneScheduler =
      options && typeof options === "object" && options.milestoneScheduler
        ? options.milestoneScheduler
        : new MilestoneScheduler({
            onCountdownBeep: (secondRemaining: number) => {
              this.hasEmittedApproachingTransition = false;
              this.emit(TimerEventType.BEEP, secondRemaining);
            },
            onTransition: () => {
              this.handleBackgroundTransition();
            },
            onWarmup: () => {
              this.hasEmittedApproachingTransition = true;
              this.emit(TimerEventType.TRANSITION_APPROACHING);
            },
          });

    let highPrecision = false;

    if (typeof options === "number") {
      this.uiTickResolutionMs = options;
    } else if (options?.uiTickResolutionMs !== undefined) {
      this.uiTickResolutionMs = options.uiTickResolutionMs;
    }

    if (typeof options === "object" && options?.highPrecision !== undefined) {
      ({ highPrecision } = options);
    }

    this.engine = new TickEngine({ highPrecision });
    this.engine.onTickCallbacks.push((tickEvent) => this.handleTick(tickEvent));

    let appStateSource: typeof AppState | undefined = AppState;
    if (typeof options === "object" && options?.appState) {
      appStateSource = options.appState;
    }

    if (appStateSource?.currentState) {
      this.currentAppState = appStateSource.currentState as AppStateStatus;
      this.isVisualUpdatesPaused =
        this.currentAppState === "background" ||
        this.currentAppState === "inactive";
    }

    if (appStateSource?.addEventListener) {
      this.appStateSubscription = appStateSource.addEventListener(
        "change",
        (nextState: AppStateStatus) => {
          this.handleAppStateChange(nextState);
        }
      );
    }
  }

  public setUiTickResolution(resolutionMs: number | null) {
    this.uiTickResolutionMs = resolutionMs;
  }

  public getUiTickResolution(): number | null {
    return this.uiTickResolutionMs;
  }

  public setHighPrecision(enabled: boolean): void {
    this.engine.setHighPrecision(enabled);
  }

  public getIsHighPrecision(): boolean {
    return this.engine.getIsHighPrecision();
  }

  public getIsVisualUpdatesPaused(): boolean {
    return this.isVisualUpdatesPaused;
  }

  public getCurrentAppState(): AppStateStatus {
    return this.currentAppState;
  }

  public handleAppStateChange(nextAppState: AppStateStatus): void {
    if (this.currentAppState === nextAppState) {
      return;
    }

    const wasActive = !this.isVisualUpdatesPaused;
    const isNowActive = nextAppState === "active";
    this.currentAppState = nextAppState;

    if (wasActive && !isNowActive) {
      this.isVisualUpdatesPaused = true;
      this.engine.pauseLoop();
      if (this.engine.getIsRunning()) {
        this.scheduleBackgroundMilestones();
      }
    } else if (!wasActive && isNowActive) {
      this.isVisualUpdatesPaused = false;
      this.milestoneScheduler.clearMilestones();
      if (this.engine.getIsRunning()) {
        this.catchUp();
        if (!this.previousState?.isFinished) {
          this.engine.resumeLoop();
        }
      }
    }
  }

  public catchUp(): void {
    if (!this.engine.getIsRunning()) {
      return;
    }

    const catchUpEvent = this.engine.catchUp();
    if (catchUpEvent && this.previousState && !this.isVisualUpdatesPaused) {
      this.updateUiTickSnapshot(this.previousState);
      this.emit(TimerEventType.UI_TICK, this.previousState);
    }
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

    this.detectApproachingTransition(tickEvent, newState);
    this.detectStateChanges(this.previousState, newState);

    this.previousState = newState;
    this.emit(TimerEventType.TICK, newState);

    if (this.shouldEmitUiTick(newState)) {
      this.updateUiTickSnapshot(newState);
      this.emit(TimerEventType.UI_TICK, newState);
    }

    if (newState.isFinished) {
      this.engine.pause();
    }
  }

  private updateUiTickSnapshot(state: TimerState): void {
    this.lastUiTickState = state;
    this.lastEmittedUiSecond = Math.ceil(state.displayTimeMs / 1000);
    if (this.uiTickResolutionMs !== null && this.uiTickResolutionMs > 0) {
      this.lastEmittedQuantizedStep = Math.floor(
        state.displayTimeMs / this.uiTickResolutionMs
      );
    }
  }

  private shouldEmitUiTick(newState: TimerState): boolean {
    if (this.isVisualUpdatesPaused) {
      return false;
    }

    if (!this.lastUiTickState) {
      return true;
    }

    if (
      newState.isFinished !== this.lastUiTickState.isFinished ||
      newState.phase !== this.lastUiTickState.phase ||
      newState.currentRound !== this.lastUiTickState.currentRound
    ) {
      return true;
    }

    if (
      this.uiTickResolutionMs !== null &&
      this.uiTickResolutionMs > 0 &&
      newState.phase === TimerPhase.WORK
    ) {
      const currentStep = Math.floor(
        newState.displayTimeMs / this.uiTickResolutionMs
      );
      return currentStep !== this.lastEmittedQuantizedStep;
    }

    const currentVisibleSecond = Math.ceil(newState.displayTimeMs / 1000);
    return currentVisibleSecond !== this.lastEmittedUiSecond;
  }

  private generateSummary(fullyCompleted: boolean): SessionSummary {
    const finalState = this.previousState || {
      currentRound: 0,
      displayTimeMs: 0,
    };

    let activeSessionTimeMs: number;
    let totalSessionTimeMs: number;

    const targetDurationMs = this.strategy.getTargetDurationMs?.();

    if (fullyCompleted && targetDurationMs !== undefined) {
      activeSessionTimeMs = targetDurationMs;
      totalSessionTimeMs = this.preparationTimeMs + targetDurationMs;
    } else {
      const currentElapsedMs = this.engine.getElapsedMs();
      totalSessionTimeMs = Math.max(this.lastKnownElapsedMs, currentElapsedMs);
      activeSessionTimeMs = Math.max(
        0,
        totalSessionTimeMs - this.preparationTimeMs
      );
    }

    return {
      activeSessionTimeMs,
      checkpoints: [...this.checkpoints],
      fullyCompleted,
      roundsCompleted: finalState.currentRound,
      totalSessionTimeMs,
    };
  }

  public recordCheckpoint() {
    const lap = this.checkpoints.length + 1;

    const currentElapsedMs = this.engine.getElapsedMs();
    this.lastKnownElapsedMs = Math.max(
      this.lastKnownElapsedMs,
      currentElapsedMs
    );

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

  private detectApproachingTransition(
    tickEvent: TickEvent,
    currentState: TimerState
  ) {
    if (this.hasEmittedApproachingTransition || currentState.isFinished) {
      return;
    }

    const LOOKAHEAD_MS = 500;
    const futureElapsedMs = tickEvent.totalElapsedMs + LOOKAHEAD_MS;

    if (currentState.phase === TimerPhase.PREPARATION) {
      const currentRemainingPrep =
        this.preparationTimeMs - tickEvent.totalElapsedMs;
      const futureRemainingPrep = this.preparationTimeMs - futureElapsedMs;
      const countdownThreshold = Math.min(this.preparationTimeMs, 3000);

      // 500ms before countdown begins, or immediately on first tick if prep <= 3000ms
      if (
        (currentRemainingPrep > countdownThreshold &&
          futureRemainingPrep <= countdownThreshold) ||
        (currentRemainingPrep <= countdownThreshold &&
          tickEvent.totalElapsedMs <= LOOKAHEAD_MS)
      ) {
        this.hasEmittedApproachingTransition = true;
        this.emit(TimerEventType.TRANSITION_APPROACHING);
        return;
      }

      // 500ms before preparation ends and WORK begins
      if (currentRemainingPrep > 0 && futureRemainingPrep <= 0) {
        this.hasEmittedApproachingTransition = true;
        this.emit(TimerEventType.TRANSITION_APPROACHING);
      }
    } else {
      const adjustedFutureTick: TickEvent = {
        deltaMs: tickEvent.deltaMs,
        totalElapsedMs: futureElapsedMs - this.preparationTimeMs,
      };
      const futureState = this.strategy.calculateState(adjustedFutureTick);

      const isPhaseEnding = futureState.phase !== currentState.phase;
      const isRoundEnding =
        futureState.currentRound !== currentState.currentRound &&
        futureState.currentRound > 0;
      const isSessionFinishing =
        !currentState.isFinished && futureState.isFinished;

      if (isPhaseEnding || isRoundEnding || isSessionFinishing) {
        this.hasEmittedApproachingTransition = true;
        this.emit(TimerEventType.TRANSITION_APPROACHING);
      }
    }
  }

  private detectStateChanges(
    oldState: TimerState | null,
    newState: TimerState
  ) {
    if (!oldState) {
      return;
    }

    // detect completion
    if (!oldState.isFinished && newState.isFinished) {
      this.hasEmittedApproachingTransition = false;
      const summary = this.generateSummary(true);
      this.emit(TimerEventType.COMPLETED, summary);
      return;
    }

    // detect session start
    if (
      oldState.phase === TimerPhase.PREPARATION &&
      newState.phase === TimerPhase.WORK
    ) {
      this.hasEmittedApproachingTransition = false;
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
      this.hasEmittedApproachingTransition = false;
      this.emit(TimerEventType.ROUND_CHANGE, newState.currentRound);
    }

    if (oldState.phase !== newState.phase && !newState.isFinished) {
      this.hasEmittedApproachingTransition = false;
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
      this.hasEmittedApproachingTransition = false;
      this.emit(TimerEventType.BEEP, newSeconds);
    }
  }

  public getSummary(): SessionSummary {
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
      [TimerEventType.COMPLETED]: [],
      [TimerEventType.GO]: [],
      [TimerEventType.PHASE_CHANGE]: [],
      [TimerEventType.ROUND_CHANGE]: [],
      [TimerEventType.BEEP]: [],
      [TimerEventType.TICK]: [],
      [TimerEventType.UI_TICK]: [],
      [TimerEventType.CHECKPOINT]: [],
      [TimerEventType.TRANSITION_APPROACHING]: [],
    };
  }

  public dispose() {
    this.milestoneScheduler.dispose();
    this.engine.pause();
    this.appStateSubscription?.remove();
    this.appStateSubscription = null;
    this.checkpoints = [];
    this.previousState = null;
    this.lastUiTickState = null;
    this.lastEmittedUiSecond = null;
    this.lastEmittedQuantizedStep = null;
    this.removeAllListeners();
  }

  public on<K extends keyof TimerEventMap>(
    event: K,
    listener: TimerEventCallback<K>
  ): () => void {
    this.listeners[event].push(listener);
    return () => {
      this.off(event, listener);
    };
  }

  public off<K extends keyof TimerEventMap>(
    event: K,
    listener: TimerEventCallback<K>
  ): void {
    const index = this.listeners[event].indexOf(listener);
    if (index !== -1) {
      this.listeners[event].splice(index, 1);
    }
  }

  private emit<K extends keyof TimerEventMap>(
    event: K,
    ...args: TimerEventMap[K]
  ) {
    for (const listener of this.listeners[event]) {
      try {
        listener(...args);
      } catch (error) {
        console.error("[TimerController] error on emit callback", error);
      }
    }
  }

  private getInitialState(): TimerState {
    if (this.preparationTimeMs > 0) {
      return {
        currentRound: 0,
        displayTimeMs: this.preparationTimeMs,
        isFinished: false,
        phase: TimerPhase.PREPARATION,
        totalRounds: 0,
      };
    }
    return this.strategy.calculateState({ deltaMs: 0, totalElapsedMs: 0 });
  }

  public start() {
    if (!this.previousState) {
      this.previousState = this.getInitialState();
    }
    this.emit(TimerEventType.START);
    this.engine.start();
    if (this.isVisualUpdatesPaused) {
      this.scheduleBackgroundMilestones();
    }
  }

  public pause() {
    this.hasEmittedApproachingTransition = false;
    this.milestoneScheduler.clearMilestones();
    this.emit(TimerEventType.PAUSE);
    this.engine.pause();
  }

  public reset() {
    this.hasEmittedApproachingTransition = false;
    this.milestoneScheduler.clearMilestones();
    this.emit(TimerEventType.RESET);
    this.checkpoints = [];
    this.previousState = null;
    this.lastUiTickState = null;
    this.lastEmittedUiSecond = null;
    this.lastEmittedQuantizedStep = null;
    this.lastKnownElapsedMs = 0;
    this.engine.reset();
  }

  public getPhaseDetails(elapsedMs?: number): PhaseDetails | null {
    const currentElapsed = elapsedMs ?? this.engine.getElapsedMs();

    if (currentElapsed < this.preparationTimeMs) {
      return {
        currentRound: 0,
        isFinished: false,
        phase: TimerPhase.PREPARATION,
        phaseDurationMs: this.preparationTimeMs,
        phaseRemainingMs: this.preparationTimeMs - currentElapsed,
        totalRounds: 0,
      };
    }

    const adjustedElapsedMs = currentElapsed - this.preparationTimeMs;
    const adjustedTick: TickEvent = {
      deltaMs: 0,
      totalElapsedMs: adjustedElapsedMs,
    };

    if (typeof this.strategy.getPhaseDetails === "function") {
      return this.strategy.getPhaseDetails(adjustedTick);
    }

    const state = this.strategy.calculateState(adjustedTick);
    if (state.isFinished) {
      return {
        currentRound: state.currentRound,
        isFinished: true,
        phase: state.phase,
        phaseDurationMs: 0,
        phaseRemainingMs: 0,
        totalRounds: state.totalRounds,
      };
    }

    return {
      currentRound: state.currentRound,
      isFinished: state.isFinished,
      phase: state.phase,
      phaseDurationMs: state.displayTimeMs,
      phaseRemainingMs: state.displayTimeMs,
      totalRounds: state.totalRounds,
    };
  }

  private scheduleBackgroundMilestones(): void {
    if (!this.engine.getIsRunning() || !this.isVisualUpdatesPaused) {
      return;
    }

    const phaseDetails = this.getPhaseDetails();
    if (
      !phaseDetails ||
      phaseDetails.isFinished ||
      phaseDetails.phaseRemainingMs <= 0
    ) {
      return;
    }

    const hasCountdownBeeps =
      phaseDetails.phaseDurationMs >= 3000 &&
      (phaseDetails.phase === TimerPhase.PREPARATION ||
        phaseDetails.phase === TimerPhase.WORK ||
        phaseDetails.phase === TimerPhase.REST);

    const now = Date.now();
    const milestones = calculatePhaseMilestones({
      hasCountdownBeeps,
      now,
      phaseDurationMs: phaseDetails.phaseDurationMs,
      phaseRemainingMs: phaseDetails.phaseRemainingMs,
    });

    this.milestoneScheduler.scheduleMilestones(milestones, now);
  }

  private handleBackgroundTransition(): void {
    this.hasEmittedApproachingTransition = false;
    this.catchUp();

    if (this.previousState?.isFinished) {
      this.milestoneScheduler.clearMilestones();
      return;
    }

    if (this.isVisualUpdatesPaused && this.engine.getIsRunning()) {
      this.scheduleBackgroundMilestones();
    }
  }

  public getScheduledMilestones(): PhaseMilestones | null {
    return this.milestoneScheduler.getActiveMilestones();
  }

  public getMilestoneScheduler(): MilestoneScheduler {
    return this.milestoneScheduler;
  }
}
