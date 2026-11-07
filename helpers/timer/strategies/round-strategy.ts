import type {
  PhaseDetails,
  TimerState,
  TimerStrategy,
} from "@/helpers/timer/strategy";
import { TimerPhase } from "@/helpers/timer/strategy";
import type { TickEvent } from "@/helpers/timer/tick-engine";

export class RoundStrategy implements TimerStrategy {
  private roundTimeMs: number;
  private totalRounds: number;
  private totalDurationMs: number;

  constructor(roundTimeMs: number, totalRounds: number) {
    this.roundTimeMs = roundTimeMs;
    this.totalRounds = totalRounds;
    this.totalDurationMs = roundTimeMs * totalRounds;
  }

  calculateState(event: TickEvent): TimerState {
    const isFinished = event.totalElapsedMs >= this.totalDurationMs;

    if (isFinished) {
      return {
        currentRound: this.totalRounds,
        displayTimeMs: 0,
        isFinished: true,
        phase: TimerPhase.DONE,
        totalRounds: this.totalRounds,
      };
    }

    const currentRound =
      Math.floor(event.totalElapsedMs / this.roundTimeMs) + 1;
    const timeInCurrentRound = event.totalElapsedMs % this.roundTimeMs;
    const displayTimeMs = this.roundTimeMs - timeInCurrentRound;

    return {
      currentRound,
      displayTimeMs,
      isFinished: false,
      phase: TimerPhase.WORK,
      totalRounds: this.totalRounds,
    };
  }

  getPhaseDetails(event: TickEvent): PhaseDetails {
    if (event.totalElapsedMs >= this.totalDurationMs) {
      return {
        currentRound: this.totalRounds,
        isFinished: true,
        phase: TimerPhase.DONE,
        phaseDurationMs: 0,
        phaseRemainingMs: 0,
        totalRounds: this.totalRounds,
      };
    }

    const currentRound =
      Math.floor(event.totalElapsedMs / this.roundTimeMs) + 1;
    const timeInCurrentRound = event.totalElapsedMs % this.roundTimeMs;
    const phaseRemainingMs = this.roundTimeMs - timeInCurrentRound;

    return {
      currentRound,
      isFinished: false,
      phase: TimerPhase.WORK,
      phaseDurationMs: this.roundTimeMs,
      phaseRemainingMs,
      totalRounds: this.totalRounds,
    };
  }

  getNextPhaseDetails(
    event: TickEvent
  ): { phase: TimerPhase; durationMs: number } | null {
    if (event.totalElapsedMs >= this.totalDurationMs) {
      return null;
    }

    const currentRound =
      Math.floor(event.totalElapsedMs / this.roundTimeMs) + 1;

    if (currentRound < this.totalRounds) {
      return { durationMs: this.roundTimeMs, phase: TimerPhase.WORK };
    }

    return null;
  }

  getTargetDurationMs(): number {
    return this.totalDurationMs;
  }
}
