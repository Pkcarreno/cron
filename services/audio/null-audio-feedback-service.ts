/* oxlint-disable eslint/class-methods-use-this */
import type { TimerPhase } from "@/helpers/timer/strategy";
import type { AudioFeedbackService } from "@/services/audio/audio-feedback-service";

/**
 * Silent in-memory audio feedback service for silent mode and CI test environments.
 * Prevents native audio crashes and ensures 100% deterministic test execution.
 */
export class NullAudioFeedbackService implements AudioFeedbackService {
  public async playCountdownBeep(_secondRemaining?: number): Promise<void> {
    // Intentionally empty for silent/test operation
  }

  public async playGoCue(): Promise<void> {
    // Intentionally empty for silent/test operation
  }

  public async playFinishCue(_isFullyCompleted?: boolean): Promise<void> {
    // Intentionally empty for silent/test operation
  }

  public async playPhaseTransitionCue(_phase?: TimerPhase): Promise<void> {
    // Intentionally empty for silent/test operation
  }

  public async playLapCue(): Promise<void> {
    // Intentionally empty for silent/test operation
  }

  public async playRoundChangeCue?(_round?: number): Promise<void> {
    // Intentionally empty for silent/test operation
  }

  public stopAudio(): void {
    // Intentionally empty for silent/test operation
  }
}
