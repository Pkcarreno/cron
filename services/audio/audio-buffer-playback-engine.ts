import type {
  AudioBuffer,
  AudioBufferSourceNode,
  SessionOptions,
} from "react-native-audio-api";
import { AudioContext, AudioManager } from "react-native-audio-api";

import countdownBeepAsset from "@/assets/audio/default/countdown_beep.wav";
import finishAsset from "@/assets/audio/default/finish.wav";
import goAsset from "@/assets/audio/default/go.wav";
import restAsset from "@/assets/audio/default/rest.wav";
import roundChangeAsset from "@/assets/audio/default/round_change.wav";
import { TimerPhase } from "@/helpers/timer/strategy";
import type { AudioFeedbackService } from "@/services/audio/audio-feedback-service";

/**
 * Enumeration of the 5 canonical HIIT timer sounds.
 */
export const CANONICAL_SOUNDS = {
  COUNTDOWN_BEEP: "countdown_beep",
  FINISH: "finish",
  GO: "go",
  REST: "rest",
  ROUND_CHANGE: "round_change",
} as const;

export type CanonicalSoundName =
  (typeof CANONICAL_SOUNDS)[keyof typeof CANONICAL_SOUNDS];

/**
 * Map of default canonical audio asset resources.
 */
export const CANONICAL_AUDIO_ASSETS: Record<CanonicalSoundName, number> = {
  countdown_beep: countdownBeepAsset,
  finish: finishAsset,
  go: goAsset,
  rest: restAsset,
  round_change: roundChangeAsset,
};

/**
 * High-priority audio session options ensuring cues pierce silent switches
 * and duck external audio players (e.g. Spotify, Apple Music).
 */
export const WORKOUT_AUDIO_SESSION_OPTIONS: SessionOptions = {
  iosCategory: "playback",
  iosMode: "default",
  iosOptions: ["duckOthers", "mixWithOthers", "defaultToSpeaker"],
};

export interface AudioBufferPlaybackEngineOptions {
  /**
   * Optional custom factory for AudioContext, primarily used in testing.
   */
  audioContextFactory?: () => AudioContext;

  /**
   * Optional custom AudioManager reference for dependency injection and testing.
   */
  audioManager?: typeof AudioManager;

  /**
   * Optional custom asset map overriding canonical sound assets.
   */
  assets?: Record<CanonicalSoundName, unknown>;

  /**
   * Predicate determining if sound output is currently enabled in settings.
   */
  isSoundEnabled?: () => boolean;

  /**
   * Custom audio session configuration options.
   */
  sessionOptions?: SessionOptions;
}

export interface ScheduledSequenceStep {
  sound: CanonicalSoundName;
  delaySeconds: number;
}

/**
 * Low-latency audio buffer playback engine utilizing AudioBufferSourceNode
 * via react-native-audio-api.
 *
 * Pre-loads and decodes canonical HIIT audio assets into native uncompressed
 * PCM Float32 memory during initialization. Sound playback is dispatched
 * strictly on audioContext.currentTime, eliminating JavaScript event loop
 * jitter and timer drift.
 */
export class AudioBufferPlaybackEngine implements AudioFeedbackService {
  private audioContext: AudioContext | null = null;
  private readonly audioContextFactory?: () => AudioContext;
  private readonly audioManager: typeof AudioManager;
  private readonly assets: Record<CanonicalSoundName, unknown>;
  private readonly isSoundEnabled: () => boolean;
  private readonly sessionOptions: SessionOptions;

  private readonly soundBuffers = new Map<CanonicalSoundName, AudioBuffer>();
  private readonly activeSources = new Set<AudioBufferSourceNode>();

  private isReady = false;
  private preparePromise: Promise<void> | null = null;

  constructor(options?: AudioBufferPlaybackEngineOptions) {
    this.audioContextFactory = options?.audioContextFactory;
    this.audioManager = options?.audioManager ?? AudioManager;
    this.assets = options?.assets ?? CANONICAL_AUDIO_ASSETS;
    this.isSoundEnabled = options?.isSoundEnabled ?? (() => true);
    this.sessionOptions =
      options?.sessionOptions ?? WORKOUT_AUDIO_SESSION_OPTIONS;
  }

  /**
   * Returns whether the audio engine has completed buffer pre-loading and is ready for playback.
   */
  public isEngineReady(): boolean {
    return this.isReady;
  }

  /**
   * Retrieves the decoded AudioBuffer for a canonical sound asset.
   */
  public getSoundBuffer(sound: CanonicalSoundName): AudioBuffer | undefined {
    return this.soundBuffers.get(sound);
  }

  /**
   * Returns the underlying AudioContext instance, initializing it lazily if needed.
   */
  public getAudioContext(): AudioContext {
    if (!this.audioContext) {
      this.audioContext = this.audioContextFactory
        ? this.audioContextFactory()
        : new AudioContext();
    }
    return this.audioContext;
  }

  /**
   * Configures the system audio session with playback ducking and Android interruption observation.
   */
  public configureAudioSession(): void {
    try {
      if (typeof this.audioManager.setAudioSessionOptions === "function") {
        this.audioManager.setAudioSessionOptions(this.sessionOptions);
      }
      if (typeof this.audioManager.observeAudioInterruptions === "function") {
        this.audioManager.observeAudioInterruptions(true);
      }
    } catch (error) {
      console.warn(
        "[AudioBufferPlaybackEngine] Failed to configure audio session options:",
        error
      );
    }
  }

  /**
   * Asynchronously prepares the engine: configures the system audio session,
   * resumes the AudioContext if suspended, and decodes the canonical sound assets into RAM.
   */
  public async prepare(): Promise<void> {
    if (this.isReady) {
      return;
    }

    if (this.preparePromise) {
      await this.preparePromise;
      return;
    }

    this.preparePromise = this.internalPrepare();
    await this.preparePromise;
  }

  private async internalPrepare(): Promise<void> {
    try {
      this.configureAudioSession();

      const ctx = this.getAudioContext();
      if (ctx.state === "suspended") {
        await ctx.resume();
      }

      const assetEntries = Object.entries(this.assets) as [
        CanonicalSoundName,
        unknown,
      ][];

      await Promise.all(
        assetEntries.map(async ([name, assetSource]) => {
          try {
            // @ts-expect-error DecodeDataInput accepts number/uri/ArrayBuffer
            const buffer = await ctx.decodeAudioData(assetSource);
            this.soundBuffers.set(name, buffer);
          } catch (error) {
            console.error(
              `[AudioBufferPlaybackEngine] Failed to decode audio asset "${name}":`,
              error
            );
            throw error;
          }
        })
      );

      this.isReady = true;
    } finally {
      this.preparePromise = null;
    }
  }

  /**
   * Dispatches sound playback via AudioBufferSourceNode scheduled directly on
   * audioContext.currentTime or a specified hardware timestamp.
   *
   * @param sound - Canonical sound name.
   * @param scheduledTime - Hardware timestamp (seconds) on audioContext timeline. Defaults to currentTime.
   * @returns Active AudioBufferSourceNode, or null if sound is disabled or buffer unavailable.
   */
  public playSound(
    sound: CanonicalSoundName,
    scheduledTime?: number
  ): AudioBufferSourceNode | null {
    if (!this.isSoundEnabled()) {
      return null;
    }

    const buffer = this.soundBuffers.get(sound);
    if (!buffer) {
      console.warn(
        `[AudioBufferPlaybackEngine] Cannot play "${sound}": buffer not loaded.`
      );
      return null;
    }

    const ctx = this.getAudioContext();
    if (ctx.state === "suspended") {
      void ctx.resume();
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);

    const startTime = scheduledTime ?? ctx.currentTime;
    source.start(startTime);

    this.activeSources.add(source);
    const cleanup = () => {
      this.activeSources.delete(source);
    };
    source.onEnded = cleanup;
    // @ts-expect-error fallback for mock compatibility
    // oxlint-disable-next-line unicorn/prefer-add-event-listener
    source.onended = cleanup;

    return source;
  }

  /**
   * Schedules a sequence of sounds across the audioContext timeline without JavaScript timers.
   */
  public scheduleSequence(
    steps: ScheduledSequenceStep[]
  ): AudioBufferSourceNode[] {
    const ctx = this.getAudioContext();
    const now = ctx.currentTime;
    const nodes: AudioBufferSourceNode[] = [];

    for (const step of steps) {
      const scheduledTime = now + step.delaySeconds;
      const node = this.playSound(step.sound, scheduledTime);
      if (node) {
        nodes.push(node);
      }
    }

    return nodes;
  }

  /**
   * Immediately halts all active AudioBufferSourceNodes.
   */
  public stopAudio(): void {
    for (const source of this.activeSources) {
      try {
        source.stop();
        source.disconnect();
      } catch (error) {
        console.error(
          "[AudioBufferPlaybackEngine] Error stopping source node:",
          error
        );
      }
    }
    this.activeSources.clear();
  }

  /**
   * Suspends the underlying AudioContext to conserve battery when inactive.
   */
  public async suspend(): Promise<void> {
    if (this.audioContext && this.audioContext.state === "running") {
      await this.audioContext.suspend();
    }
  }

  /**
   * Resumes the underlying AudioContext.
   */
  public async resume(): Promise<void> {
    if (this.audioContext && this.audioContext.state === "suspended") {
      await this.audioContext.resume();
    }
  }

  /**
   * Completely tears down the audio engine, stopping playback and closing the context.
   */
  public async dispose(): Promise<void> {
    this.stopAudio();
    this.soundBuffers.clear();
    this.isReady = false;

    if (this.audioContext && this.audioContext.state !== "closed") {
      try {
        await this.audioContext.close();
      } catch (error) {
        console.error(
          "[AudioBufferPlaybackEngine] Failed to close AudioContext:",
          error
        );
      }
      this.audioContext = null;
    }
  }

  // --- AudioFeedbackService Semantic Interface ---

  public playCountdownBeep(_secondRemaining?: number): Promise<void> {
    this.playSound("countdown_beep");
    return Promise.resolve();
  }

  public playGoCue(): Promise<void> {
    this.playSound("go");
    return Promise.resolve();
  }

  public playFinishCue(isFullyCompleted = true): Promise<void> {
    if (!isFullyCompleted) {
      return Promise.resolve();
    }
    this.playSound("finish");
    return Promise.resolve();
  }

  public playPhaseTransitionCue(phase?: TimerPhase): Promise<void> {
    if (phase === TimerPhase.REST) {
      this.playSound("rest");
    } else if (phase === TimerPhase.WORK) {
      this.playSound("go");
    }
    return Promise.resolve();
  }

  public playRoundChangeCue?(_round?: number): Promise<void> {
    this.playSound("round_change");
    return Promise.resolve();
  }

  public playLapCue(): Promise<void> {
    this.playSound("round_change");
    return Promise.resolve();
  }
}
