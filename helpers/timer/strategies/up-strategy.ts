import type {
  PhaseDetails,
  TimerState,
  TimerStrategy,
} from "@/helpers/timer/strategy";
import { TimerPhase } from "@/helpers/timer/strategy";
import type { TickEvent } from "@/helpers/timer/tick-engine";

export class UpStrategy implements TimerStrategy {
  private targetTimeMs: number;

  constructor(targetTimeMs: number) {
    this.targetTimeMs = targetTimeMs;
  }

  calculateState(event: TickEvent): TimerState {
    const isFinished = event.totalElapsedMs >= this.targetTimeMs;

    return {
      currentRound: 1,
      displayTimeMs: isFinished ? this.targetTimeMs : event.totalElapsedMs,
      isFinished,
      phase: isFinished ? TimerPhase.DONE : TimerPhase.WORK,
      totalRounds: 1,
    };
  }

  getPhaseDetails(event: TickEvent): PhaseDetails {
    const isFinished = event.totalElapsedMs >= this.targetTimeMs;

    return {
      currentRound: 1,
      isFinished,
      phase: isFinished ? TimerPhase.DONE : TimerPhase.WORK,
      phaseDurationMs: this.targetTimeMs,
      phaseRemainingMs: isFinished
        ? 0
        : this.targetTimeMs - event.totalElapsedMs,
      totalRounds: 1,
    };
  }

  getTargetDurationMs(): number {
    return this.targetTimeMs;
  }
}
