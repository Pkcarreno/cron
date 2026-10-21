import type { AppStateStatus } from "react-native";
import { AppState } from "react-native";

import type { TimerState, TimerStrategy } from "@/helpers/timer/strategy";
import { TimerPhase } from "@/helpers/timer/strategy";
import type { TickEvent } from "@/helpers/timer/tick-engine";
import { TickEngine } from "@/helpers/timer/tick-engine";
import type { AudioFeedbackService } from "@/services/audio/audio-feedback-service";
import { NullAudioFeedbackService } from "@/services/audio/null-audio-feedback-service";

export enum TimerEventType {
  START = "START",
  PAUSE = "PAUSE",
  RESET = "RESET",
  FINISH = "FINISH",
  GO = "GO",
  PHASE_CHANGE = "PHASE_CHANGE",
  ROUND_CHANGE = "ROUND_CHANGE",
  BEEP = "BEEP",
  TICK = "TICK",
  UI_TICK = "UI_TICK",
  CHECKPOINT = "CHECKPOINT",
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
  [TimerEventType.FINISH]: [summary: SessionSummary];
  [TimerEventType.GO]: [];
  [TimerEventType.PHASE_CHANGE]: [newPhase: TimerPhase];
  [TimerEventType.ROUND_CHANGE]: [newRound: number];
  [TimerEventType.BEEP]: [secondRemaining: number];
  [TimerEventType.TICK]: [state: TimerState];
  [TimerEventType.UI_TICK]: [state: TimerState];
  [TimerEventType.CHECKPOINT]: [lastCheckpoint: CheckpointData];
}

export type TimerEventCallback<K extends keyof TimerEventMap> = (
  ...args: TimerEventMap[K]
) => void;

export type TimerEventHandlerMap = {
  [K in keyof TimerEventMap]?: TimerEventCallback<K>;
};

export interface TimerControllerOptions {
  uiTickResolutionMs?: number;
  audioService?: AudioFeedbackService;
  appState?: typeof AppState;
}

export class TimerController {
  private engine: TickEngine;
  private strategy: TimerStrategy;
  private preparationTimeMs: number;
  private uiTickResolutionMs: number | null = null;
  private previousState: TimerState | null = null;
  private lastUiTickState: TimerState | null = null;
  private lastEmittedUiSecond: number | null = null;
  private lastEmittedQuantizedStep: number | null = null;
  private checkpoints: CheckpointData[] = [];
  private lastKnownElapsedMs = 0;
  private audioService: AudioFeedbackService;
  private isVisualUpdatesPaused = false;
  private currentAppState: AppStateStatus = "active";
  private appStateSubscription: { remove: () => void } | null = null;

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
    [TimerEventType.UI_TICK]: [],
    [TimerEventType.CHECKPOINT]: [],
  };

  constructor(
    strategy: TimerStrategy,
    preparationTimeMs: number,
    options?: TimerControllerOptions | number,
    audioService?: AudioFeedbackService
  ) {
    this.strategy = strategy;
    this.preparationTimeMs = preparationTimeMs;

    if (typeof options === "number") {
      this.uiTickResolutionMs = options;
      this.audioService = audioService ?? new NullAudioFeedbackService();
    } else {
      if (options?.uiTickResolutionMs !== undefined) {
        this.uiTickResolutionMs = options.uiTickResolutionMs;
      }
      this.audioService =
        audioService ?? options?.audioService ?? new NullAudioFeedbackService();
    }

    this.engine = new TickEngine();
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

  public setAudioService(audioService: AudioFeedbackService) {
    this.audioService = audioService;
  }

  public getAudioService(): AudioFeedbackService {
    return this.audioService;
  }

  public setUiTickResolution(resolutionMs: number | null) {
    this.uiTickResolutionMs = resolutionMs;
  }

  public getUiTickResolution(): number | null {
    return this.uiTickResolutionMs;
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
    } else if (!wasActive && isNowActive) {
      this.isVisualUpdatesPaused = false;
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
    if (catchUpEvent && this.previousState) {
      this.lastUiTickState = this.previousState;
      this.lastEmittedUiSecond = Math.ceil(
        this.previousState.displayTimeMs / 1000
      );
      if (this.uiTickResolutionMs !== null && this.uiTickResolutionMs > 0) {
        this.lastEmittedQuantizedStep = Math.floor(
          this.previousState.displayTimeMs / this.uiTickResolutionMs
        );
      }
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

    this.detectStateChanges(this.previousState, newState);

    this.previousState = newState;
    this.emit(TimerEventType.TICK, newState);

    if (this.shouldEmitUiTick(newState)) {
      this.lastUiTickState = newState;
      this.lastEmittedUiSecond = Math.ceil(newState.displayTimeMs / 1000);
      if (this.uiTickResolutionMs !== null && this.uiTickResolutionMs > 0) {
        this.lastEmittedQuantizedStep = Math.floor(
          newState.displayTimeMs / this.uiTickResolutionMs
        );
      }
      this.emit(TimerEventType.UI_TICK, newState);
    }

    if (newState.isFinished) {
      this.engine.pause();
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

    const currentElapsedMs = this.engine.getElapsedMs();
    const totalSessionMs = Math.max(this.lastKnownElapsedMs, currentElapsedMs);

    const activeSessionMs = Math.max(
      0,
      totalSessionMs - this.preparationTimeMs
    );

    return {
      activeSessionTimeMs: activeSessionMs,
      checkpoints: [...this.checkpoints],
      fullyCompleted,
      roundsCompleted: finalState.currentRound,
      totalSessionTimeMs: totalSessionMs,
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
    this.audioService.playLapCue();
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
      const summary = this.generateSummary(true);
      this.emit(TimerEventType.FINISH, summary);
      this.audioService.playFinishCue(summary.fullyCompleted);
      return;
    }

    // detect session start
    if (
      oldState.phase === TimerPhase.PREPARATION &&
      newState.phase === TimerPhase.WORK
    ) {
      this.emit(TimerEventType.GO);
      this.audioService.playGoCue();
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
      this.audioService.playRoundChangeCue?.(newState.currentRound);
    }

    if (oldState.phase !== newState.phase && !newState.isFinished) {
      this.emit(TimerEventType.PHASE_CHANGE, newState.phase);
      this.audioService.playPhaseTransitionCue(newState.phase);
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
      this.audioService.playCountdownBeep(newSeconds);
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
      [TimerEventType.FINISH]: [],
      [TimerEventType.GO]: [],
      [TimerEventType.PHASE_CHANGE]: [],
      [TimerEventType.ROUND_CHANGE]: [],
      [TimerEventType.BEEP]: [],
      [TimerEventType.TICK]: [],
      [TimerEventType.UI_TICK]: [],
      [TimerEventType.CHECKPOINT]: [],
    };
  }

  public dispose() {
    this.engine.pause();
    this.appStateSubscription?.remove();
    this.appStateSubscription = null;
    this.audioService.stopAudio();
    this.checkpoints = [];
    this.previousState = null;
    this.lastUiTickState = null;
    this.lastEmittedUiSecond = null;
    this.lastEmittedQuantizedStep = null;
    this.removeAllListeners();
  }

  public finishTimer() {
    this.engine.pause();

    const isCompleted = this.previousState?.isFinished || false;
    const summary = this.generateSummary(isCompleted);

    this.emit(TimerEventType.FINISH, summary);
    this.audioService.playFinishCue(summary.fullyCompleted);
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
        console.error("[TimerController] error on emit callback", error);
      }
    }
  }

  public start() {
    this.emit(TimerEventType.START);
    this.engine.start();
  }

  public pause() {
    this.emit(TimerEventType.PAUSE);
    this.audioService.stopAudio();
    this.engine.pause();
  }

  public reset() {
    this.emit(TimerEventType.RESET);
    this.audioService.stopAudio();
    this.checkpoints = [];
    this.previousState = null;
    this.lastUiTickState = null;
    this.lastEmittedUiSecond = null;
    this.lastEmittedQuantizedStep = null;
    this.lastKnownElapsedMs = 0;
    this.engine.reset();
  }
}
