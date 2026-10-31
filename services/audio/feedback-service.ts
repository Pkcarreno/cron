import * as Haptics from "expo-haptics";

import type { TimerController } from "@/helpers/timer/controller";
import { TimerEventType } from "@/helpers/timer/controller";
import { TimerPhase } from "@/helpers/timer/strategy";
import type { CanonicalSoundName } from "@/services/audio/audio-buffer-playback-engine";
import {
  AudioBufferPlaybackEngine,
  CANONICAL_SOUNDS,
} from "@/services/audio/audio-buffer-playback-engine";
import { hasHapticEnabledAtom, isSoundEnabledAtom } from "@/stores/settings";
import { store as defaultStore } from "@/stores/storage";

/**
 * Semantic feedback cues emitted throughout workout progression.
 * Abstracts concrete audio/haptic transducers from timer mechanics.
 */
export enum FeedbackCue {
  COUNTDOWN = "COUNTDOWN",
  GO = "GO",
  REST = "REST",
  ROUND_CHANGE = "ROUND_CHANGE",
  FINISH = "FINISH",
}

/**
 * Mapping between semantic FeedbackCue and canonical audio sound buffer identifiers.
 */
export const CUE_TO_SOUND_MAP: Record<FeedbackCue, CanonicalSoundName> = {
  [FeedbackCue.COUNTDOWN]: CANONICAL_SOUNDS.COUNTDOWN_BEEP,
  [FeedbackCue.GO]: CANONICAL_SOUNDS.GO,
  [FeedbackCue.REST]: CANONICAL_SOUNDS.REST,
  [FeedbackCue.ROUND_CHANGE]: CANONICAL_SOUNDS.ROUND_CHANGE,
  [FeedbackCue.FINISH]: CANONICAL_SOUNDS.FINISH,
};

export type HapticCueAction =
  | { style: Haptics.ImpactFeedbackStyle; type: "impact" }
  | { style: Haptics.NotificationFeedbackType; type: "notification" };

/**
 * Declarative table mapping semantic FeedbackCue to coordinated haptic impacts.
 */
export const CUE_TO_HAPTIC_MAP: Record<FeedbackCue, HapticCueAction> = {
  [FeedbackCue.COUNTDOWN]: {
    style: Haptics.ImpactFeedbackStyle.Light,
    type: "impact",
  },
  [FeedbackCue.GO]: {
    style: Haptics.ImpactFeedbackStyle.Heavy,
    type: "impact",
  },
  [FeedbackCue.REST]: {
    style: Haptics.ImpactFeedbackStyle.Medium,
    type: "impact",
  },
  [FeedbackCue.ROUND_CHANGE]: {
    style: Haptics.ImpactFeedbackStyle.Light,
    type: "impact",
  },
  [FeedbackCue.FINISH]: {
    style: Haptics.NotificationFeedbackType.Success,
    type: "notification",
  },
};

/**
 * Contract for the unified feedback service.
 */
export interface FeedbackServiceInterface {
  attach: (controller: TimerController) => () => void;
  detach: () => void;
  dispose: () => void;
  prepare: () => Promise<void>;
  stop: () => void;
  trigger: (cue: FeedbackCue) => void;
  warmUp: () => void;
}

export interface FeedbackServiceOptions {
  audioEngine?: AudioBufferPlaybackEngine;
  haptics?: {
    impactAsync: (style: Haptics.ImpactFeedbackStyle) => Promise<void>;
    notificationAsync: (
      type: Haptics.NotificationFeedbackType
    ) => Promise<void>;
  };
  store?: typeof defaultStore;
  controller?: TimerController;
  isSoundEnabled?: boolean | (() => boolean);
  hasHapticEnabled?: boolean | (() => boolean);
}

const resolveInitialSetting = (
  option: boolean | (() => boolean) | undefined,
  store: typeof defaultStore | undefined,
  atom: typeof isSoundEnabledAtom
): boolean => {
  if (typeof option === "boolean") {
    return option;
  }
  if (typeof option === "function") {
    return option();
  }
  if (store && typeof store.get === "function") {
    return store.get(atom);
  }
  return true;
};

/**
 * Unified feedback service orchestrating audio buffer playback and haptic impacts.
 * Implements the Observer pattern to decouple TimerController from concrete transducers.
 * Subscribes reactively to Jotai store settings for zero-overhead, real-time toggle gating.
 */
export class FeedbackService implements FeedbackServiceInterface {
  private readonly audioEngine: AudioBufferPlaybackEngine;
  private readonly haptics: {
    impactAsync: (style: Haptics.ImpactFeedbackStyle) => Promise<void>;
    notificationAsync: (
      type: Haptics.NotificationFeedbackType
    ) => Promise<void>;
  };
  private readonly store?: typeof defaultStore;

  private isSoundEnabled: boolean;
  private hasHapticEnabled: boolean;

  private unsubscribeSound?: () => void;
  private unsubscribeHaptic?: () => void;

  private attachedController: TimerController | null = null;
  private detachCallback: (() => void) | null = null;

  constructor(options?: FeedbackServiceOptions) {
    this.store = options?.store ?? defaultStore;

    this.audioEngine =
      options?.audioEngine ??
      new AudioBufferPlaybackEngine({
        isSoundEnabled: () => this.isSoundEnabled,
      });

    this.haptics = options?.haptics ?? Haptics;

    this.isSoundEnabled = resolveInitialSetting(
      options?.isSoundEnabled,
      this.store,
      isSoundEnabledAtom
    );

    this.hasHapticEnabled = resolveInitialSetting(
      options?.hasHapticEnabled,
      this.store,
      hasHapticEnabledAtom
    );

    if (this.store && typeof this.store.sub === "function") {
      if (options?.isSoundEnabled === undefined) {
        this.unsubscribeSound = this.store.sub(isSoundEnabledAtom, () => {
          this.isSoundEnabled = this.store?.get(isSoundEnabledAtom) ?? true;
        });
      }

      if (options?.hasHapticEnabled === undefined) {
        this.unsubscribeHaptic = this.store.sub(hasHapticEnabledAtom, () => {
          this.hasHapticEnabled = this.store?.get(hasHapticEnabledAtom) ?? true;
        });
      }
    }

    if (options?.controller) {
      this.attach(options.controller);
    }
  }

  /**
   * Pre-warms the underlying audio engine, decodes WAV assets, and initializes session options.
   */
  public async prepare(): Promise<void> {
    await this.audioEngine.prepare();
  }

  /**
   * Attaches as an observer to TimerController lifecycle events.
   *
   * @param controller - The timer controller to observe.
   * @returns Unsubscribe function to detach.
   */
  public attach(controller: TimerController): () => void {
    this.detach();
    this.attachedController = controller;

    let isRoundChanging = false;

    const subscriptions: (() => void)[] = [
      controller.on(TimerEventType.TRANSITION_APPROACHING, () => {
        this.warmUp();
      }),
      controller.on(TimerEventType.BEEP, () => {
        this.trigger(FeedbackCue.COUNTDOWN);
      }),
      controller.on(TimerEventType.GO, () => {
        this.trigger(FeedbackCue.GO);
      }),
      controller.on(TimerEventType.COMPLETED, () => {
        this.trigger(FeedbackCue.FINISH);
      }),
      controller.on(TimerEventType.ROUND_CHANGE, () => {
        isRoundChanging = true;
        this.trigger(FeedbackCue.ROUND_CHANGE);
        queueMicrotask(() => {
          isRoundChanging = false;
        });
      }),
      controller.on(TimerEventType.PHASE_CHANGE, (newPhase: TimerPhase) => {
        if (newPhase === TimerPhase.REST) {
          this.trigger(FeedbackCue.REST);
        } else if (newPhase === TimerPhase.WORK && !isRoundChanging) {
          this.trigger(FeedbackCue.GO);
        }
      }),
      controller.on(TimerEventType.PAUSE, () => {
        this.stop();
      }),
      controller.on(TimerEventType.RESET, () => {
        this.stop();
      }),
    ];

    const detachHandler = () => {
      for (const unsubscribe of subscriptions) {
        unsubscribe();
      }
      if (this.attachedController === controller) {
        this.attachedController = null;
      }
      if (this.detachCallback === detachHandler) {
        this.detachCallback = null;
      }
    };

    this.detachCallback = detachHandler;
    return detachHandler;
  }

  /**
   * Detaches from the currently observed TimerController.
   */
  public detach(): void {
    if (this.detachCallback) {
      this.detachCallback();
      this.detachCallback = null;
    }
  }

  /**
   * Dispatches a semantic feedback cue across coordinated audio and haptic transducers.
   * Completely synchronous and non-blocking from the caller's perspective.
   */
  public trigger(cue: FeedbackCue): void {
    if (this.isSoundEnabled) {
      const sound = CUE_TO_SOUND_MAP[cue];
      if (sound) {
        this.audioEngine.playSound(sound);
      }
    }

    if (this.hasHapticEnabled) {
      this.dispatchHaptic(cue);
    }
  }

  private dispatchHaptic(cue: FeedbackCue): void {
    const config = CUE_TO_HAPTIC_MAP[cue];
    if (!config) {
      return;
    }

    const fireHapticAsync = async () => {
      try {
        await (config.type === "impact"
          ? this.haptics.impactAsync(config.style)
          : this.haptics.notificationAsync(config.style));
      } catch (error) {
        console.warn("[FeedbackService] Haptic impact error:", error);
      }
    };

    void fireHapticAsync();
  }

  /**
   * Pre-warms the audio pipeline ahead of upcoming cues to prevent acoustic clicks and cold-start latency.
   * Sound check is delegated here and in the audio engine.
   */
  public warmUp(): void {
    if (this.isSoundEnabled) {
      this.audioEngine.warmUp();
    }
  }

  /**
   * Halts active audio playback.
   */
  public stop(): void {
    this.audioEngine.stop();
  }

  /**
   * Releases hardware audio resources, detaches listeners, and unsubscribes store listeners.
   */
  public dispose(): void {
    this.detach();
    this.unsubscribeSound?.();
    this.unsubscribeHaptic?.();
    this.unsubscribeSound = undefined;
    this.unsubscribeHaptic = undefined;
    void this.audioEngine.dispose();
  }
}
