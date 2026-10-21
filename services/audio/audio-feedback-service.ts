import type { TimerPhase } from "@/helpers/timer/strategy";

/**
 * High-level semantic audio feedback interface for workout timer cues.
 * Decouples audio playback from UI components and timer business logic.
 */
export interface AudioFeedbackService {
  /**
   * Play an acoustic countdown warning tone before a workout phase starts.
   *
   * @param secondRemaining - Second count remaining in the preparation phase.
   */
  playCountdownBeep: (secondRemaining?: number) => Promise<void>;

  /**
   * Play an acoustic go cue signaling the start of active work.
   */
  playGoCue: () => Promise<void>;

  /**
   * Play an acoustic completion fanfare when a session finishes.
   *
   * @param isFullyCompleted - True when the prescribed workout duration or timecap completed.
   */
  playFinishCue: (isFullyCompleted?: boolean) => Promise<void>;

  /**
   * Play an acoustic transition tone when changing between work and rest phases.
   *
   * @param phase - Target workout phase transitioned into.
   */
  playPhaseTransitionCue: (phase?: TimerPhase) => Promise<void>;

  /**
   * Play an acoustic confirmation cue when recording a lap or checkpoint.
   */
  playLapCue: () => Promise<void>;

  /**
   * Play an acoustic cue when advancing to a new round.
   *
   * @param round - Current round number.
   */
  playRoundChangeCue?: (round?: number) => Promise<void>;

  /**
   * Immediately halt all active tone playback and scheduled sound sequences.
   */
  stopAudio: () => void;
}
