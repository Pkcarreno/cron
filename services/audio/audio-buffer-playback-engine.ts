import type {
  AudioBuffer,
  AudioBufferSourceNode,
  DecodeDataInput,
  SessionOptions,
} from "react-native-audio-api";
import { AudioContext, AudioManager } from "react-native-audio-api";

import countdownBeepAsset from "@/assets/audio/default/countdown_beep.wav";
import finishAsset from "@/assets/audio/default/finish.wav";
import goAsset from "@/assets/audio/default/go.wav";
import restAsset from "@/assets/audio/default/rest.wav";
import roundChangeAsset from "@/assets/audio/default/round_change.wav";

export const CANONICAL_SOUNDS = {
  COUNTDOWN_BEEP: "countdown_beep",
  FINISH: "finish",
  GO: "go",
  REST: "rest",
  ROUND_CHANGE: "round_change",
} as const;

export type CanonicalSoundName =
  (typeof CANONICAL_SOUNDS)[keyof typeof CANONICAL_SOUNDS];

export const CANONICAL_AUDIO_ASSETS: Record<CanonicalSoundName, number> = {
  countdown_beep: countdownBeepAsset,
  finish: finishAsset,
  go: goAsset,
  rest: restAsset,
  round_change: roundChangeAsset,
};

/**
 * Audio session options for workout timers.
 * Keeps cues audible when the silent switch is active and lowers background music volume.
 */
export const WORKOUT_AUDIO_SESSION_OPTIONS: SessionOptions = {
  iosCategory: "playback",
  iosMode: "default",
  iosNotifyOthersOnDeactivation: true,
  iosOptions: ["duckOthers", "mixWithOthers", "defaultToSpeaker"],
};

export const AUDIO_DRAIN_TIME_MS = 200;
export const AUDIO_IDLE_SLEEP_MS = 1500;
export const COUNTDOWN_HOLD_DUCKING_MS = 1200;

export interface AudioBufferPlaybackEngineOptions {
  assets?: Record<CanonicalSoundName, DecodeDataInput>;
  audioContextFactory?: () => AudioContext;
  audioManager?: typeof AudioManager;
  isSoundEnabled?: () => boolean;
  sessionOptions?: SessionOptions;
}

/**
 * Low-latency audio buffer playback engine that uses AudioBufferSourceNode.
 *
 * Pre-loads canonical Float32 PCM audio buffers into native memory during prepare.
 * Dispatches playback directly on the audioContext.currentTime hardware clock
 * to prevent timing drift from the JavaScript event loop.
 */
export class AudioBufferPlaybackEngine {
  private audioContext: AudioContext | null = null;
  private readonly audioContextFactory?: () => AudioContext;
  private readonly audioManager: typeof AudioManager;
  private readonly assets: Record<CanonicalSoundName, DecodeDataInput>;
  private readonly isSoundEnabled: () => boolean;
  private readonly sessionOptions: SessionOptions;

  private readonly soundBuffers = new Map<CanonicalSoundName, AudioBuffer>();
  private readonly activeSources = new Set<AudioBufferSourceNode>();

  private isInitialized = false;
  private preparePromise: Promise<void> | null = null;
  private isFocusHeld = false;
  private drainTimeout: ReturnType<typeof setTimeout> | null = null;
  private idleSleepTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(options?: AudioBufferPlaybackEngineOptions) {
    this.assets = options?.assets ?? CANONICAL_AUDIO_ASSETS;
    this.audioContextFactory = options?.audioContextFactory;
    this.audioManager = options?.audioManager ?? AudioManager;
    this.isSoundEnabled = options?.isSoundEnabled ?? (() => true);
    this.sessionOptions =
      options?.sessionOptions ?? WORKOUT_AUDIO_SESSION_OPTIONS;

    this.configureAudioSession();
  }

  public isReady(): boolean {
    return this.isInitialized;
  }

  public getSoundBuffer(sound: CanonicalSoundName): AudioBuffer | undefined {
    return this.soundBuffers.get(sound);
  }

  public getAudioContext(): AudioContext {
    if (!this.audioContext) {
      this.audioContext = this.audioContextFactory
        ? this.audioContextFactory()
        : new AudioContext();
    }
    return this.audioContext;
  }

  public configureAudioSession(): void {
    try {
      if (typeof this.audioManager.setAudioSessionOptions === "function") {
        this.audioManager.setAudioSessionOptions(this.sessionOptions);
      }
    } catch (error) {
      console.warn(
        "[AudioBufferPlaybackEngine] Failed to configure audio session options:",
        error
      );
    }
  }

  private cancelScheduledRelease(): void {
    if (this.drainTimeout !== null) {
      clearTimeout(this.drainTimeout);
      this.drainTimeout = null;
    }
    if (this.idleSleepTimeout !== null) {
      clearTimeout(this.idleSleepTimeout);
      this.idleSleepTimeout = null;
    }
  }

  private requestAudioFocus(): void {
    this.cancelScheduledRelease();
    if (this.isFocusHeld) {
      return;
    }
    try {
      if (typeof this.audioManager.observeAudioInterruptions === "function") {
        this.audioManager.observeAudioInterruptions("gainTransientMayDuck");
      }
      if (typeof this.audioManager.setAudioSessionActivity === "function") {
        void this.audioManager.setAudioSessionActivity(true);
      }
      this.isFocusHeld = true;
    } catch (error) {
      console.warn(
        "[AudioBufferPlaybackEngine] Failed to request audio focus:",
        error
      );
    }
  }

  private releaseAudioFocusOnly(): void {
    if (!this.isFocusHeld) {
      return;
    }
    try {
      if (typeof this.audioManager.observeAudioInterruptions === "function") {
        this.audioManager.observeAudioInterruptions(false);
      }
      if (typeof this.audioManager.setAudioSessionActivity === "function") {
        void this.audioManager.setAudioSessionActivity(false);
      }
      this.isFocusHeld = false;
    } catch (error) {
      console.warn(
        "[AudioBufferPlaybackEngine] Failed to release audio focus:",
        error
      );
    }
  }

  private releaseAudioFocusAndSuspend(): void {
    this.cancelScheduledRelease();
    this.releaseAudioFocusOnly();
    void this.suspend();
  }

  /**
   * Pre-warms the hardware stream and requests ducking 500ms before an upcoming cue.
   * Ensures the DAC and audio thread are fully stable and background audio is smoothly
   * ducked without cold-start clicks, pops, or buffer underruns.
   */
  public warmUp(): void {
    if (!this.isSoundEnabled()) {
      return;
    }

    this.requestAudioFocus();

    const audioContext = this.getAudioContext();
    if (audioContext.state === "suspended") {
      void audioContext.resume();
    }

    // Safety timeout in case no cue follows (e.g. paused immediately after warmup)
    this.idleSleepTimeout = setTimeout(() => {
      this.idleSleepTimeout = null;
      if (this.activeSources.size === 0) {
        this.releaseAudioFocusAndSuspend();
      }
    }, AUDIO_IDLE_SLEEP_MS * 2);
  }

  /**
   * Pre-loads canonical WAV assets into native AudioBuffer memory.
   * Keeps AudioContext and audio focus dormant while idle to save energy.
   */
  public async prepare(): Promise<void> {
    if (this.isInitialized) {
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

      const audioContext = this.getAudioContext();

      const assetEntries = Object.entries(this.assets) as [
        CanonicalSoundName,
        DecodeDataInput,
      ][];

      await Promise.all(
        assetEntries.map(async ([name, assetSource]) => {
          try {
            const buffer = await audioContext.decodeAudioData(assetSource);
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

      this.isInitialized = true;
    } finally {
      this.preparePromise = null;
    }
  }

  /**
   * Plays a pre-decoded sound buffer on the hardware timeline.
   * Requests transient audio focus allowing ducking and schedules tail-drain on completion.
   *
   * @param sound - Canonical sound name.
   * @param scheduledTime - Target hardware timestamp in seconds (defaults to currentTime).
   * @returns The active source node, or null if sound is disabled or not loaded.
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

    this.cancelScheduledRelease();
    this.requestAudioFocus();

    try {
      const audioContext = this.getAudioContext();
      if (audioContext.state === "suspended") {
        void audioContext.resume();
      }

      const source = audioContext.createBufferSource();
      source.buffer = buffer;
      source.connect(audioContext.destination);

      const startTime = scheduledTime ?? audioContext.currentTime;
      source.start(startTime);

      this.activeSources.add(source);
      const cleanup = () => {
        this.activeSources.delete(source);
        if (this.activeSources.size === 0) {
          this.scheduleCompletionDrain(sound);
        }
      };
      source.onEnded = cleanup;
      // @ts-expect-error fallback for mock compatibility
      // oxlint-disable-next-line unicorn/prefer-add-event-listener
      source.onended = cleanup;

      return source;
    } catch (error) {
      console.error(
        `[AudioBufferPlaybackEngine] Failed to play sound "${sound}":`,
        error
      );
      if (this.activeSources.size === 0) {
        this.releaseAudioFocusAndSuspend();
      }
      return null;
    }
  }

  private scheduleCompletionDrain(sound: CanonicalSoundName): void {
    this.cancelScheduledRelease();

    // Countdown beeps hold ducking across 1.0s interval to prevent volume pumping.
    // Terminal/isolated cues (GO, REST, ROUND_CHANGE, FINISH) drain over 200ms.
    const drainDelay =
      sound === CANONICAL_SOUNDS.COUNTDOWN_BEEP
        ? COUNTDOWN_HOLD_DUCKING_MS
        : AUDIO_DRAIN_TIME_MS;

    this.drainTimeout = setTimeout(() => {
      this.drainTimeout = null;
      if (this.activeSources.size === 0) {
        this.releaseAudioFocusOnly();
      }
    }, drainDelay);

    this.idleSleepTimeout = setTimeout(() => {
      this.idleSleepTimeout = null;
      if (this.activeSources.size === 0) {
        void this.suspend();
      }
    }, AUDIO_IDLE_SLEEP_MS);
  }

  /**
   * Halts active buffer playback and immediately releases audio focus.
   */
  public stop(): void {
    this.cancelScheduledRelease();
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
    this.releaseAudioFocusAndSuspend();
  }

  /**
   * Alias for stop() maintaining backward compatibility.
   */
  public stopAudio = this.stop.bind(this);

  public async suspend(): Promise<void> {
    if (this.audioContext && this.audioContext.state === "running") {
      await this.audioContext.suspend();
    }
  }

  public async resume(): Promise<void> {
    if (this.audioContext && this.audioContext.state === "suspended") {
      await this.audioContext.resume();
    }
  }

  public async dispose(): Promise<void> {
    this.stop();
    this.soundBuffers.clear();
    this.isInitialized = false;

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
}
