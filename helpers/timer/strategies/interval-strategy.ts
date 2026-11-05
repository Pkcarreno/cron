import type { TimerMode } from "@/helpers/timer/factory";
import type {
  PhaseDetails,
  TimerState,
  TimerStrategy,
} from "@/helpers/timer/strategy";
import { TimerPhase } from "@/helpers/timer/strategy";
import type { TickEvent } from "@/helpers/timer/tick-engine";

export class IntervalStrategy implements TimerStrategy {
  public mode?: TimerMode;
  private cycleTimeMs: number;
  private workTimeMs: number;
  private restTimeMs: number;
  private totalRounds: number;
  private totalDurationMs: number;

  constructor(workTimeMs: number, restTimeMs: number, totalRounds: number) {
    this.cycleTimeMs = workTimeMs + restTimeMs;
    this.workTimeMs = workTimeMs;
    this.restTimeMs = restTimeMs;
    this.totalRounds = totalRounds;
    this.totalDurationMs = this.cycleTimeMs * totalRounds;
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
      Math.floor(event.totalElapsedMs / this.cycleTimeMs) + 1;
    const timeInCycle = event.totalElapsedMs % this.cycleTimeMs;
    const isWorkPhase = timeInCycle < this.workTimeMs;

    return {
      currentRound,
      displayTimeMs: isWorkPhase
        ? this.workTimeMs - timeInCycle
        : this.cycleTimeMs - timeInCycle,
      isFinished: false,
      phase: isWorkPhase ? TimerPhase.WORK : TimerPhase.REST,
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
      Math.floor(event.totalElapsedMs / this.cycleTimeMs) + 1;
    const timeInCycle = event.totalElapsedMs % this.cycleTimeMs;
    const isWorkPhase = timeInCycle < this.workTimeMs;
    const phaseDurationMs = isWorkPhase ? this.workTimeMs : this.restTimeMs;
    const phaseRemainingMs = isWorkPhase
      ? this.workTimeMs - timeInCycle
      : this.cycleTimeMs - timeInCycle;

    return {
      currentRound,
      isFinished: false,
      phase: isWorkPhase ? TimerPhase.WORK : TimerPhase.REST,
      phaseDurationMs,
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
      Math.floor(event.totalElapsedMs / this.cycleTimeMs) + 1;
    const timeInCycle = event.totalElapsedMs % this.cycleTimeMs;
    const isWorkPhase = timeInCycle < this.workTimeMs;

    if (isWorkPhase) {
      if (this.restTimeMs > 0) {
        return { durationMs: this.restTimeMs, phase: TimerPhase.REST };
      }
      if (currentRound < this.totalRounds) {
        return { durationMs: this.workTimeMs, phase: TimerPhase.WORK };
      }
      return null;
    }

    if (currentRound < this.totalRounds) {
      return { durationMs: this.workTimeMs, phase: TimerPhase.WORK };
    }

    return null;
  }

  getTargetDurationMs(): number {
    return this.totalDurationMs;
  }

  getWorkTimeMs(): number {
    return this.workTimeMs;
  }

  getRestTimeMs(): number {
    return this.restTimeMs;
  }
}
