import { UpStrategy } from '@/helpers/timer/strategies/up-strategy';
import { TimerController, TimerEventType } from '@/helpers/timer/controller';
import { TimerPhase } from '@/helpers/timer/strategy';
import { IntervalStrategy } from './strategies/interval-strategy';

describe('timerController', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 1, 1, 0, 0, 0));
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.restoreAllMocks();
  });

  describe('initialization and basic flow', () => {
    it('emits start event when started', () => {
      const strategy = new UpStrategy(10_000);
      const controller = new TimerController(strategy, 0);

      const startSpy = jest.fn();
      controller.on(TimerEventType.START, startSpy);

      controller.start();

      expect(startSpy).toHaveBeenCalledTimes(1);
    });

    it('emits tick events with the current state', () => {
      const strategy = new UpStrategy(10_000);
      const controller = new TimerController(strategy, 0);

      const tickSpy = jest.fn();
      controller.on(TimerEventType.TICK, tickSpy);

      controller.start();
      jest.advanceTimersByTime(100);

      expect(tickSpy).toHaveBeenCalledTimes(101);

      const [statePayload] = tickSpy.mock.lastCall;
      expect(statePayload).toHaveProperty('displayTimeMs');
      expect(statePayload).toHaveProperty('phase');
    });
  });

  describe('preparation phase, beeps and go', () => {
    it('emits beeps only during the last 3 seconds of preparation', () => {
      const strategy = new UpStrategy(10_000);
      const controller = new TimerController(strategy, 5000);

      const beepSpy = jest.fn();
      const goSpy = jest.fn();

      controller.on(TimerEventType.BEEP, beepSpy);
      controller.on(TimerEventType.GO, goSpy);

      controller.start();

      jest.advanceTimersByTime(1000);
      // 4 sec remaining
      expect(beepSpy).not.toHaveBeenCalled();

      jest.advanceTimersByTime(1000);
      // 3 sec remaining
      expect(beepSpy).toHaveBeenCalledWith(3);

      jest.advanceTimersByTime(1000);
      // 2 sec remaining
      expect(beepSpy).toHaveBeenCalledWith(2);

      jest.advanceTimersByTime(1000);
      // 1 sec remaining
      expect(beepSpy).toHaveBeenCalledWith(1);

      // advance past preparation into work phase
      jest.advanceTimersByTime(2000);

      expect(beepSpy).toHaveBeenCalledTimes(3);
      expect(goSpy).toHaveBeenCalledTimes(1);
    });

    it('does not emit beeps during the work phase even in the last 3 seconds', () => {
      const strategy = new UpStrategy(5000);
      const controller = new TimerController(strategy, 0);

      const beepSpy = jest.fn();
      controller.on(TimerEventType.BEEP, beepSpy);

      controller.start();

      jest.advanceTimersByTime(5000);

      expect(beepSpy).not.toHaveBeenCalled();
    });
  });

  describe('lifecycle', () => {
    it('walks through a complete interval strategy emitting the correct sequences', () => {
      const workTimeMs = 2000;
      const restTimeMs = 1000;
      const totalPhases = 3;

      const strategy = new IntervalStrategy(
        workTimeMs,
        restTimeMs,
        totalPhases
      );

      const controller = new TimerController(strategy, 0);

      const phaseChangeSpy = jest.fn();
      const roundChangeSpy = jest.fn();
      const finishSpy = jest.fn();
      const tickSpy = jest.fn();

      controller.on(TimerEventType.PHASE_CHANGE, phaseChangeSpy);
      controller.on(TimerEventType.ROUND_CHANGE, roundChangeSpy);
      controller.on(TimerEventType.FINISH, finishSpy);
      controller.on(TimerEventType.TICK, tickSpy);

      controller.start();

      jest.advanceTimersByTime(10);
      let [currentState] = tickSpy.mock.lastCall;

      expect(currentState.phase).toBe(TimerPhase.WORK);
      expect(currentState.currentRound).toBe(1);

      // advance to complete the first work phase, now time is 2000ms
      jest.advanceTimersByTime(1990);
      [currentState] = tickSpy.mock.lastCall;

      expect(currentState.phase).toBe(TimerPhase.REST);
      expect(currentState.currentRound).toBe(1);
      expect(phaseChangeSpy).toHaveBeenCalledTimes(1);
      expect(roundChangeSpy).not.toHaveBeenCalled();

      // advance to complete the first rest phase, now time is 3000ms
      jest.advanceTimersByTime(1000);
      [currentState] = tickSpy.mock.lastCall;

      expect(currentState.phase).toBe(TimerPhase.WORK);
      expect(currentState.currentRound).toBe(2);
      expect(phaseChangeSpy).toHaveBeenCalledTimes(2);
      expect(roundChangeSpy).toHaveBeenCalledWith(2);

      // advance to complete the last rest phase, now time is 9000ms
      jest.advanceTimersByTime(6000);
      [currentState] = tickSpy.mock.lastCall;

      expect(currentState.phase).toBe(TimerPhase.DONE);
      expect(currentState.currentRound).toBe(3);
      expect(phaseChangeSpy).toHaveBeenCalledTimes(5);
      expect(roundChangeSpy).toHaveBeenCalledWith(3);
      expect(currentState.isFinished).toBeTruthy();

      expect(finishSpy).toHaveBeenCalledTimes(1);
    });

    it('emits finish event and stops processing other events when time is up', () => {
      const testDurationMs = 5000;
      const strategy = new UpStrategy(testDurationMs);
      const controller = new TimerController(strategy, 0);

      const finishSpy = jest.fn();
      const phaseChangeSpy = jest.fn();

      controller.on(TimerEventType.FINISH, finishSpy);
      controller.on(TimerEventType.PHASE_CHANGE, phaseChangeSpy);

      controller.start();

      // advance to te end of the timer
      jest.advanceTimersByTime(testDurationMs);

      expect(finishSpy).toHaveBeenCalledTimes(1);

      expect(phaseChangeSpy).not.toHaveBeenCalledWith(TimerPhase.DONE);
    });
  });

  describe('engine Controls', () => {
    it('pauses the underlying engine and stops emitting ticks', () => {
      const strategy = new UpStrategy(10_000);
      const controller = new TimerController(strategy, 0);

      const tickSpy = jest.fn();

      controller.on(TimerEventType.TICK, tickSpy);

      controller.start();
      jest.advanceTimersByTime(100);

      const ticksBeforePause = tickSpy.mock.calls.length;

      controller.pause();

      //advance whilie in pause
      jest.advanceTimersByTime(500);

      const ticksAfterPause = tickSpy.mock.calls.length;

      expect(ticksAfterPause).toBe(ticksBeforePause);

      // keep advancing after pause
      controller.start();
      jest.advanceTimersByTime(500);

      const ticksAfterRestart = tickSpy.mock.calls.length;

      expect(ticksAfterRestart).not.toBe(ticksAfterPause);
    });
  });
});
