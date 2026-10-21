import type { OscillatorNode } from "react-native-audio-api";
import { AudioContext } from "react-native-audio-api";

import { TimerPhase } from "@/helpers/timer/strategy";
import type { AudioFeedbackService } from "@/services/audio/audio-feedback-service";

export interface ToneSequenceStep {
  frequencyHz: number;
  durationMs: number;
  silenceAfterMs: number;
}

export interface WebAudioOscillatorServiceOptions {
  /**
   * Predicate determining if sound output is enabled.
   * Inverts storage dependency by allowing callers to inject settings getters.
   */
  isSoundEnabled?: () => boolean;

  /**
   * Optional custom factory for AudioContext, useful for testing or custom audio setups.
   */
  audioContextFactory?: () => AudioContext;
}

/**
 * Concrete AudioFeedbackService adapter that generates acoustic cues
 * using Web Audio oscillators via react-native-audio-api.
 *
 * Encapsulates playback state within instance properties, eliminating
 * module-level variables and direct storage coupling.
 */
export class WebAudioOscillatorService implements AudioFeedbackService {
  private audioContext: AudioContext | null = null;
  private currentOscillator: OscillatorNode | null = null;
  private currentTimeout: ReturnType<typeof setTimeout> | null = null;
  private currentTimeoutResolve: (() => void) | null = null;
  private playbackToken = 0;
  private readonly isSoundEnabled: () => boolean;
  private readonly audioContextFactory?: () => AudioContext;

  constructor(options?: WebAudioOscillatorServiceOptions) {
    this.isSoundEnabled = options?.isSoundEnabled ?? (() => true);
    this.audioContextFactory = options?.audioContextFactory;
  }

  public async playCountdownBeep(_secondRemaining?: number): Promise<void> {
    await this.playTone(659, 200);
  }

  public async playGoCue(): Promise<void> {
    await this.playTone(880, 600);
  }

  public async playFinishCue(isFullyCompleted = true): Promise<void> {
    if (!isFullyCompleted) {
      return;
    }

    await this.playToneSequence([
      { durationMs: 300, frequencyHz: 523, silenceAfterMs: 150 },
      { durationMs: 300, frequencyHz: 523, silenceAfterMs: 150 },
      { durationMs: 800, frequencyHz: 523, silenceAfterMs: 0 },
    ]);
  }

  public async playPhaseTransitionCue(phase?: TimerPhase): Promise<void> {
    if (phase === TimerPhase.REST) {
      await this.playTone(523, 500);
    } else if (phase === TimerPhase.WORK) {
      await this.playTone(880, 400);
    }
  }

  public async playLapCue(): Promise<void> {
    await this.playToneSequence([
      { durationMs: 80, frequencyHz: 880, silenceAfterMs: 120 },
      { durationMs: 80, frequencyHz: 880, silenceAfterMs: 0 },
    ]);
  }

  public async playRoundChangeCue?(_round?: number): Promise<void> {
    await this.playToneSequence([
      { durationMs: 200, frequencyHz: 698, silenceAfterMs: 100 },
      { durationMs: 200, frequencyHz: 698, silenceAfterMs: 0 },
    ]);
  }

  public stopAudio(): void {
    this.playbackToken += 1;
    this.clearPlaybackState();
  }

  public async playTone(
    frequencyHz: number,
    durationMs: number
  ): Promise<void> {
    if (!this.isSoundEnabled()) {
      return;
    }

    this.stopAudio();
    await this.executeTone(frequencyHz, durationMs, this.playbackToken);
  }

  public async playToneSequence(steps: ToneSequenceStep[]): Promise<void> {
    if (!this.isSoundEnabled()) {
      return;
    }

    this.stopAudio();
    const token = this.playbackToken;

    for (const step of steps) {
      if (token !== this.playbackToken) {
        break;
      }

      // oxlint-disable-next-line eslint/no-await-in-loop
      await this.executeTone(step.frequencyHz, step.durationMs, token);

      if (token !== this.playbackToken) {
        break;
      }

      if (step.silenceAfterMs > 0) {
        // oxlint-disable-next-line eslint/no-await-in-loop
        await this.delay(step.silenceAfterMs);
      }
    }
  }

  private async getAudioContext(): Promise<AudioContext> {
    if (!this.audioContext) {
      this.audioContext = this.audioContextFactory
        ? this.audioContextFactory()
        : new AudioContext();
    }
    if (this.audioContext.state === "suspended") {
      await this.audioContext.resume();
    }
    return this.audioContext;
  }

  private clearPlaybackState(): void {
    if (this.currentTimeout) {
      clearTimeout(this.currentTimeout);
      this.currentTimeout = null;
    }

    if (this.currentTimeoutResolve) {
      this.currentTimeoutResolve();
      this.currentTimeoutResolve = null;
    }

    if (this.currentOscillator) {
      try {
        this.currentOscillator.stop();
        this.currentOscillator.disconnect();
      } catch (error) {
        console.error(
          "[WebAudioOscillatorService] failed to stop oscillator",
          error
        );
      }
      this.currentOscillator = null;
    }
  }

  private delay(ms: number): Promise<void> {
    // oxlint-disable-next-line eslint/avoid-new
    return new Promise((resolve) => {
      this.currentTimeoutResolve = resolve;
      this.currentTimeout = setTimeout(() => {
        this.currentTimeoutResolve = null;
        this.currentTimeout = null;
        resolve();
      }, ms);
    });
  }

  private static createAndStartOscillator(
    ctx: AudioContext,
    frequencyHz: number,
    durationMs: number
  ): OscillatorNode {
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = frequencyHz;
    osc.connect(ctx.destination);

    const now = ctx.currentTime;
    osc.start(now);
    osc.stop(now + durationMs / 1000);

    return osc;
  }

  private async executeTone(
    frequencyHz: number,
    durationMs: number,
    token: number
  ): Promise<void> {
    this.clearPlaybackState();

    const ctx = await this.getAudioContext();

    if (token !== this.playbackToken) {
      return;
    }

    this.currentOscillator = WebAudioOscillatorService.createAndStartOscillator(
      ctx,
      frequencyHz,
      durationMs
    );

    await this.delay(durationMs);

    if (token === this.playbackToken) {
      this.clearPlaybackState();
    }
  }
}
