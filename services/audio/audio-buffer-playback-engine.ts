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
  iosOptions: ["duckOthers", "mixWithOthers", "defaultToSpeaker"],
};

export interface AudioBufferPlaybackEngineOptions {
  audioContextFactory?: () => AudioContext;
  audioManager?: typeof AudioManager;
  assets?: Record<CanonicalSoundName, DecodeDataInput>;
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

  private ready = false;
  private preparePromise: Promise<void> | null = null;

  constructor(options?: AudioBufferPlaybackEngineOptions) {
    this.audioContextFactory = options?.audioContextFactory;
    this.audioManager = options?.audioManager ?? AudioManager;
    this.assets = options?.assets ?? CANONICAL_AUDIO_ASSETS;
    this.isSoundEnabled = options?.isSoundEnabled ?? (() => true);
    this.sessionOptions =
      options?.sessionOptions ?? WORKOUT_AUDIO_SESSION_OPTIONS;

    this.configureAudioSession();
  }

  public isReady(): boolean {
    return this.ready;
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
   * Pre-warms the audio engine: activates session options, resumes the AudioContext,
   * and decodes all canonical WAV assets into native memory.
   */
  public async prepare(): Promise<void> {
    if (this.ready) {
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
        DecodeDataInput,
      ][];

      await Promise.all(
        assetEntries.map(async ([name, assetSource]) => {
          try {
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

      this.ready = true;
    } finally {
      this.preparePromise = null;
    }
  }

  /**
   * Plays a pre-decoded sound buffer on the hardware timeline.
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
    this.stopAudio();
    this.soundBuffers.clear();
    this.ready = false;

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
