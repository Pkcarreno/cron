import type { AppStateStatus } from "react-native";
import { AppState } from "react-native";

import type {
  ActiveSessionPayload,
  LiveActivityDriver,
} from "@/helpers/background/live-activity-driver";
import { TimerMode } from "@/helpers/timer/factory";
import type { PhaseMilestones } from "@/helpers/timer/milestone-scheduler";
import {
  AUDIO_DUCKING_LEAD_TIME_MS,
  AUDIO_WARMUP_LEAD_TIME_MS,
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
import { formatTimeForDisplay } from "@/helpers/timer/utils/formatter";

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
  DUCKING_APPROACHING = "DUCKING_APPROACHING",
  AUTO_PAUSE_PERMISSION_DENIED = "AUTO_PAUSE_PERMISSION_DENIED",
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
  [TimerEventType.DUCKING_APPROACHING]: [];
  [TimerEventType.AUTO_PAUSE_PERMISSION_DENIED]: [];
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
  liveActivityDriver?: LiveActivityDriver;
  mode?: TimerMode;
  isBackgroundAudioOnlyAllowed?: boolean;
}

export class TimerController {
  private engine: TickEngine;
  private strategy: TimerStrategy;
  private milestoneScheduler: MilestoneScheduler;
  private preparationTimeMs: number;
  private liveActivityDriver: LiveActivityDriver | null = null;
  private driverTeardown: (() => void) | null = null;
  private configuredMode: TimerMode | null = null;
  private isResuming = false;

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
  private hasEmittedApproachingDucking = false;
  private hasEmittedPrepCountdownWarmup = false;
  private hasEmittedPrepCountdownDucking = false;
  private isBackgroundAudioOnlyAllowed = false;
  private wasAutoPausedDueToPermission = false;

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
    [TimerEventType.DUCKING_APPROACHING]: [],
    [TimerEventType.AUTO_PAUSE_PERMISSION_DENIED]: [],
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
              this.hasEmittedApproachingDucking = false;
              this.emit(TimerEventType.BEEP, secondRemaining);
            },
            onDucking: () => {
              this.hasEmittedApproachingDucking = true;
              this.emit(TimerEventType.DUCKING_APPROACHING);
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

    if (typeof options === "object" && options !== null) {
      if (options.highPrecision !== undefined) {
        ({ highPrecision } = options);
      }
      if (options.mode) {
        this.configuredMode = options.mode;
      }
      if (options.isBackgroundAudioOnlyAllowed !== undefined) {
        this.isBackgroundAudioOnlyAllowed =
          options.isBackgroundAudioOnlyAllowed;
      }
      if (options.liveActivityDriver) {
        this.attachLiveActivityDriver(options.liveActivityDriver);
      }
    }

    this.engine = new TickEngine({ highPrecision });
    this.engine.onTickCallbacks.push((tickEvent) => this.handleTick(tickEvent));

    const appStateSource =
      typeof options === "object" && options?.appState
        ? options.appState
        : AppState;
    this.initializeAppStateSubscription(appStateSource);
  }

  private initializeAppStateSubscription(
    appStateSource?: typeof AppState
  ): void {
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

  public setIsBackgroundAudioOnlyAllowed(isAllowed: boolean): void {
    this.isBackgroundAudioOnlyAllowed = isAllowed;
  }

  public getIsBackgroundAudioOnlyAllowed(): boolean {
    return this.isBackgroundAudioOnlyAllowed;
  }

  public getWasAutoPausedDueToPermission(): boolean {
    return this.wasAutoPausedDueToPermission;
  }

  public clearAutoPauseDueToPermission(): void {
    this.wasAutoPausedDueToPermission = false;
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

  public getIsRunning(): boolean {
    return this.engine.getIsRunning();
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
        if (this.liveActivityDriver?.hasNotificationPermission) {
          void (async () => {
            const hasPermission =
              await this.liveActivityDriver?.hasNotificationPermission?.();
            if (hasPermission === false) {
              if (this.isBackgroundAudioOnlyAllowed) {
                if (this.engine.getIsRunning()) {
                  this.scheduleBackgroundMilestones();
                }
                return;
              }
              if (this.engine.getIsRunning()) {
                this.wasAutoPausedDueToPermission = true;
                this.pause();
              }
              return;
            }
            if (this.engine.getIsRunning()) {
              this.scheduleBackgroundMilestones();
              this.dispatchDriverUpdate();
            }
          })();
        } else {
          this.scheduleBackgroundMilestones();
          this.dispatchDriverUpdate();
        }
      }
    } else if (!wasActive && isNowActive) {
      this.isVisualUpdatesPaused = false;
      this.milestoneScheduler.clearMilestones();
      if (this.wasAutoPausedDueToPermission) {
        this.emit(TimerEventType.AUTO_PAUSE_PERMISSION_DENIED);
      }
      if (this.engine.getIsRunning()) {
        this.catchUp();
        if (!this.previousState?.isFinished) {
          this.engine.resumeLoop();
        }
      } else if (this.previousState) {
        this.updateUiTickSnapshot(this.previousState);
        this.emit(TimerEventType.UI_TICK, this.previousState);
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

  private getIsCountDown(state: TimerState): boolean {
    if (state.phase === TimerPhase.PREPARATION) {
      return true;
    }
    const mode = this.configuredMode ?? TimerMode.INTERVAL;
    return mode !== TimerMode.STOP_WATCH && mode !== TimerMode.FOR_TIME;
  }

  private calculateVisibleSecond(state: TimerState): number {
    return this.getIsCountDown(state)
      ? Math.ceil(state.displayTimeMs / 1000)
      : Math.floor(state.displayTimeMs / 1000);
  }

  private updateUiTickSnapshot(state: TimerState): void {
    this.lastUiTickState = state;
    this.lastEmittedUiSecond = this.calculateVisibleSecond(state);
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

    const currentVisibleSecond = this.calculateVisibleSecond(newState);
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

    let roundsCompleted = finalState.currentRound;
    if (this.configuredMode === TimerMode.AMRAP) {
      roundsCompleted = this.checkpoints.length;
    } else if (
      this.configuredMode === TimerMode.FOR_TIME ||
      this.configuredMode === TimerMode.STOP_WATCH
    ) {
      roundsCompleted = 0;
    }

    return {
      activeSessionTimeMs,
      checkpoints: [...this.checkpoints],
      fullyCompleted,
      roundsCompleted,
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
    this.dispatchDriverUpdate();
  }

  private isApproachingStateTrigger(
    leadTimeMs: number,
    tickEvent: TickEvent,
    currentState: TimerState
  ): boolean {
    const futureTick: TickEvent = {
      deltaMs: tickEvent.deltaMs,
      totalElapsedMs:
        tickEvent.totalElapsedMs + leadTimeMs - this.preparationTimeMs,
    };
    const futureState = this.strategy.calculateState(futureTick);
    return (
      futureState.phase !== currentState.phase ||
      (futureState.currentRound !== currentState.currentRound &&
        futureState.currentRound > 0) ||
      (!currentState.isFinished && futureState.isFinished)
    );
  }

  private detectPreparationApproaching(tickEvent: TickEvent): void {
    if (this.preparationTimeMs < 3000) {
      if (!this.hasEmittedApproachingTransition) {
        this.hasEmittedApproachingTransition = true;
        this.emit(TimerEventType.TRANSITION_APPROACHING);
      }
      if (!this.hasEmittedApproachingDucking) {
        this.hasEmittedApproachingDucking = true;
        this.emit(TimerEventType.DUCKING_APPROACHING);
      }
      return;
    }

    const firstAudioTimeMs = this.preparationTimeMs - 3000;

    // Countdown prewarm & ducking
    if (!this.hasEmittedPrepCountdownWarmup) {
      const warmupThresholdMs = Math.max(
        0,
        firstAudioTimeMs - AUDIO_WARMUP_LEAD_TIME_MS
      );
      if (tickEvent.totalElapsedMs >= warmupThresholdMs) {
        this.hasEmittedPrepCountdownWarmup = true;
        this.emit(TimerEventType.TRANSITION_APPROACHING);
      }
    }

    if (!this.hasEmittedPrepCountdownDucking) {
      const duckingThresholdMs = Math.max(
        0,
        firstAudioTimeMs - AUDIO_DUCKING_LEAD_TIME_MS
      );
      if (tickEvent.totalElapsedMs >= duckingThresholdMs) {
        this.hasEmittedPrepCountdownDucking = true;
        this.emit(TimerEventType.DUCKING_APPROACHING);
      }
    }

    // End-of-preparation transition to WORK
    const currentRemainingPrep =
      this.preparationTimeMs - tickEvent.totalElapsedMs;

    if (
      currentRemainingPrep <= AUDIO_WARMUP_LEAD_TIME_MS &&
      !this.hasEmittedApproachingTransition
    ) {
      this.hasEmittedApproachingTransition = true;
      this.emit(TimerEventType.TRANSITION_APPROACHING);
    }

    if (
      currentRemainingPrep <= AUDIO_DUCKING_LEAD_TIME_MS &&
      !this.hasEmittedApproachingDucking
    ) {
      this.hasEmittedApproachingDucking = true;
      this.emit(TimerEventType.DUCKING_APPROACHING);
    }
  }

  private detectActiveWorkoutApproaching(
    tickEvent: TickEvent,
    currentState: TimerState
  ): void {
    if (
      !this.hasEmittedApproachingTransition &&
      this.isApproachingStateTrigger(
        AUDIO_WARMUP_LEAD_TIME_MS,
        tickEvent,
        currentState
      )
    ) {
      this.hasEmittedApproachingTransition = true;
      this.emit(TimerEventType.TRANSITION_APPROACHING);
    }

    if (
      !this.hasEmittedApproachingDucking &&
      this.isApproachingStateTrigger(
        AUDIO_DUCKING_LEAD_TIME_MS,
        tickEvent,
        currentState
      )
    ) {
      this.hasEmittedApproachingDucking = true;
      this.emit(TimerEventType.DUCKING_APPROACHING);
    }
  }

  private detectApproachingTransition(
    tickEvent: TickEvent,
    currentState: TimerState
  ): void {
    if (
      this.isVisualUpdatesPaused ||
      (this.hasEmittedApproachingTransition &&
        this.hasEmittedApproachingDucking) ||
      currentState.isFinished
    ) {
      return;
    }

    if (currentState.phase === TimerPhase.PREPARATION) {
      this.detectPreparationApproaching(tickEvent);
    } else {
      this.detectActiveWorkoutApproaching(tickEvent, currentState);
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
      this.hasEmittedApproachingDucking = false;
      if (this.liveActivityDriver) {
        this.dispatchDriverAction(async () => {
          await this.liveActivityDriver?.stop();
        });
      }
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
      this.hasEmittedApproachingDucking = false;
      this.hasEmittedPrepCountdownWarmup = false;
      this.hasEmittedPrepCountdownDucking = false;
      this.emit(TimerEventType.GO);
      this.dispatchDriverUpdate();
      return;
    }

    this.detectRoundAndPhase(oldState, newState);
    this.detectPreparationBeep(oldState, newState);
  }

  private detectRoundAndPhase(oldState: TimerState, newState: TimerState) {
    let hasChanged = false;

    if (
      oldState.currentRound !== newState.currentRound &&
      newState.currentRound > 0
    ) {
      this.hasEmittedApproachingTransition = false;
      this.hasEmittedApproachingDucking = false;
      this.emit(TimerEventType.ROUND_CHANGE, newState.currentRound);
      hasChanged = true;
    }

    if (oldState.phase !== newState.phase && !newState.isFinished) {
      this.hasEmittedApproachingTransition = false;
      this.hasEmittedApproachingDucking = false;
      this.emit(TimerEventType.PHASE_CHANGE, newState.phase);
      hasChanged = true;
    }

    if (hasChanged) {
      this.dispatchDriverUpdate();
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
      [TimerEventType.DUCKING_APPROACHING]: [],
      [TimerEventType.AUTO_PAUSE_PERMISSION_DENIED]: [],
    };
  }

  public dispose() {
    this.driverTeardown?.();
    this.driverTeardown = null;
    if (this.liveActivityDriver) {
      this.dispatchDriverAction(async () => {
        await this.liveActivityDriver?.stop();
      });
    }
    this.liveActivityDriver = null;
    this.milestoneScheduler.dispose();
    this.engine.pause();
    this.appStateSubscription?.remove();
    this.appStateSubscription = null;
    this.checkpoints = [];
    this.previousState = null;
    this.lastUiTickState = null;
    this.lastEmittedUiSecond = null;
    this.lastEmittedQuantizedStep = null;
    this.wasAutoPausedDueToPermission = false;
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
    this.wasAutoPausedDueToPermission = false;
    if (!this.previousState) {
      this.previousState = this.getInitialState();
    }
    this.emit(TimerEventType.START);
    this.engine.start();
    if (this.isVisualUpdatesPaused) {
      this.engine.pauseLoop();
      this.scheduleBackgroundMilestones();
    }
    this.dispatchDriverStartOrResume();
  }

  public pause() {
    this.hasEmittedApproachingTransition = false;
    this.hasEmittedApproachingDucking = false;
    this.hasEmittedPrepCountdownWarmup = false;
    this.hasEmittedPrepCountdownDucking = false;
    this.milestoneScheduler.clearMilestones();
    if (this.isVisualUpdatesPaused && this.engine.getIsRunning()) {
      this.catchUp();
    }
    this.emit(TimerEventType.PAUSE);
    this.engine.pause();
    this.isResuming = true;
    if (this.liveActivityDriver) {
      const displayMs = this.previousState?.displayTimeMs ?? 0;
      const isCountDown = this.previousState
        ? this.getIsCountDown(this.previousState)
        : true;
      const formatted = formatTimeForDisplay(displayMs, {
        includeHours: this.configuredMode === TimerMode.STOP_WATCH,
        isCountDown,
      });
      const displayString = formatted.hours
        ? `${formatted.hours}:${formatted.minutes}:${formatted.seconds}`
        : `${formatted.minutes}:${formatted.seconds}`;
      this.dispatchDriverAction(async () => {
        await this.liveActivityDriver?.pause(displayString, displayMs);
      });
    }
  }

  public reset() {
    this.hasEmittedApproachingTransition = false;
    this.hasEmittedApproachingDucking = false;
    this.hasEmittedPrepCountdownWarmup = false;
    this.hasEmittedPrepCountdownDucking = false;
    this.milestoneScheduler.clearMilestones();
    this.wasAutoPausedDueToPermission = false;
    this.emit(TimerEventType.RESET);
    this.checkpoints = [];
    this.previousState = null;
    this.lastUiTickState = null;
    this.lastEmittedUiSecond = null;
    this.lastEmittedQuantizedStep = null;
    this.lastKnownElapsedMs = 0;
    this.isResuming = false;
    this.engine.reset();
    if (this.liveActivityDriver) {
      this.dispatchDriverAction(async () => {
        await this.liveActivityDriver?.stop();
      });
    }
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
      phaseDetails.phase === TimerPhase.PREPARATION;

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
    this.hasEmittedApproachingDucking = false;
    this.catchUp();

    if (this.previousState?.isFinished) {
      this.milestoneScheduler.clearMilestones();
      if (this.liveActivityDriver) {
        this.dispatchDriverAction(async () => {
          await this.liveActivityDriver?.stop();
        });
      }
      return;
    }

    if (this.isVisualUpdatesPaused && this.engine.getIsRunning()) {
      this.scheduleBackgroundMilestones();
      this.dispatchDriverUpdate();
    }
  }

  public getScheduledMilestones(): PhaseMilestones | null {
    return this.milestoneScheduler.getActiveMilestones();
  }

  public getMilestoneScheduler(): MilestoneScheduler {
    return this.milestoneScheduler;
  }

  /**
   * Attaches a LiveActivityDriver to synchronize timer lifecycle events with background surfaces.
   */
  public attachLiveActivityDriver(driver: LiveActivityDriver): () => void {
    this.driverTeardown?.();
    this.liveActivityDriver = driver;
    this.milestoneScheduler.setBridge(driver.getMilestoneBridge?.() ?? null);
    this.driverTeardown = driver.attachController?.(this) ?? null;
    if (typeof driver.areLiveUpdatesSupported === "function") {
      void driver.areLiveUpdatesSupported();
    }

    return () => {
      this.driverTeardown?.();
      this.driverTeardown = null;
      this.milestoneScheduler.setBridge(null);
      if (this.liveActivityDriver === driver) {
        this.liveActivityDriver = null;
      }
    };
  }

  /**
   * Retrieves the currently attached LiveActivityDriver instance, if any.
   */
  public getLiveActivityDriver(): LiveActivityDriver | null {
    return this.liveActivityDriver;
  }

  private dispatchDriverAction(action: () => Promise<void>): void {
    if (!this.liveActivityDriver) {
      return;
    }
    void (async () => {
      try {
        await action();
      } catch (error) {
        console.warn("[TimerController] LiveActivityDriver error:", error);
      }
    })();
  }

  private dispatchDriverStartOrResume(): void {
    if (!this.liveActivityDriver) {
      return;
    }
    const payload = this.buildActiveSessionPayload(false);
    if (!payload) {
      return;
    }
    if (this.isResuming) {
      this.dispatchDriverAction(async () => {
        await this.liveActivityDriver?.resume(payload);
      });
    } else {
      this.dispatchDriverAction(async () => {
        await this.liveActivityDriver?.start(payload);
      });
    }
    this.isResuming = false;
  }

  private dispatchDriverUpdate(): void {
    if (!this.liveActivityDriver) {
      return;
    }
    const isPaused = !this.engine.getIsRunning();
    const payload = this.buildActiveSessionPayload(isPaused);
    if (payload) {
      this.dispatchDriverAction(async () => {
        await this.liveActivityDriver?.update(payload);
      });
    }
  }

  /**
   * Evaluates the phase and duration metadata of the immediate next phase.
   */
  public getNextPhaseDetails(
    elapsedMs?: number
  ): { phase: TimerPhase; durationMs: number } | null {
    const currentElapsed = elapsedMs ?? this.engine.getElapsedMs();

    if (currentElapsed < this.preparationTimeMs) {
      const firstTick: TickEvent = { deltaMs: 0, totalElapsedMs: 0 };
      if (typeof this.strategy.getPhaseDetails === "function") {
        const details = this.strategy.getPhaseDetails(firstTick);
        if (details && !details.isFinished) {
          return { durationMs: details.phaseDurationMs, phase: details.phase };
        }
      }
      const firstState = this.strategy.calculateState(firstTick);
      if (!firstState.isFinished) {
        return {
          durationMs: firstState.displayTimeMs,
          phase: firstState.phase,
        };
      }
      return null;
    }

    const adjustedElapsedMs = currentElapsed - this.preparationTimeMs;
    const adjustedTick: TickEvent = {
      deltaMs: 0,
      totalElapsedMs: adjustedElapsedMs,
    };

    if (typeof this.strategy.getNextPhaseDetails === "function") {
      return this.strategy.getNextPhaseDetails(adjustedTick);
    }

    return null;
  }

  /**
   * Constructs an ActiveSessionPayload representing the current timer state for background display.
   */
  public buildActiveSessionPayload(
    isPaused = false
  ): ActiveSessionPayload | null {
    const phaseDetails = this.getPhaseDetails();
    if (!phaseDetails || phaseDetails.isFinished) {
      return null;
    }

    const mode = this.configuredMode ?? TimerMode.INTERVAL;
    const isPreparation = phaseDetails.phase === TimerPhase.PREPARATION;
    const isCountDown =
      isPreparation ||
      (mode !== TimerMode.STOP_WATCH && mode !== TimerMode.FOR_TIME);
    const nextPhaseInfo = this.getNextPhaseDetails();

    let targetTimestampMs = 0;
    if (!isPaused) {
      if (isCountDown) {
        targetTimestampMs = Date.now() + phaseDetails.phaseRemainingMs;
      } else {
        const elapsedInPhase =
          phaseDetails.phaseDurationMs > 0
            ? phaseDetails.phaseDurationMs - phaseDetails.phaseRemainingMs
            : phaseDetails.phaseRemainingMs;
        targetTimestampMs = Date.now() - elapsedInPhase;
      }
    }
    const capDurationMs =
      typeof this.strategy.getTargetDurationMs === "function"
        ? this.strategy.getTargetDurationMs()
        : undefined;

    const currentRound =
      mode === TimerMode.AMRAP || mode === TimerMode.STOP_WATCH
        ? this.checkpoints.length + 1
        : phaseDetails.currentRound;

    return {
      capDurationMs,
      currentRound,
      displayTimeMs: phaseDetails.phaseRemainingMs,
      isCountDown,
      isPaused,
      mode,
      nextPhase: nextPhaseInfo?.phase,
      nextPhaseDurationMs: nextPhaseInfo?.durationMs,
      phase: phaseDetails.phase,
      phaseDurationMs: phaseDetails.phaseDurationMs,
      targetTimestampMs,
      totalRounds: phaseDetails.totalRounds,
    };
  }
}
