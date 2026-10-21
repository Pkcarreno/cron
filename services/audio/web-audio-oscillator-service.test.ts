import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";

import { TimerPhase } from "@/helpers/timer/strategy";
import { WebAudioOscillatorService } from "@/services/audio/web-audio-oscillator-service";

describe("WebAudioOscillatorService", () => {
  let mockOscillator: {
    connect: jest.Mock;
    disconnect: jest.Mock;
    frequency: { value: number };
    start: jest.Mock;
    stop: jest.Mock;
    type: string;
  };
  let mockAudioContext: {
    createOscillator: jest.Mock;
    currentTime: number;
    destination: object;
    resume: jest.Mock;
    state: string;
  };

  beforeEach(() => {
    jest.useFakeTimers();

    mockOscillator = {
      connect: jest.fn(),
      disconnect: jest.fn(),
      frequency: { value: 0 },
      start: jest.fn(),
      stop: jest.fn(),
      type: "sine",
    };

    mockAudioContext = {
      createOscillator: jest.fn(() => mockOscillator),
      currentTime: 0,
      destination: {},
      resume: jest.fn(() => Promise.resolve()),
      state: "running",
    };
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it("plays countdown beep when sound is enabled", async () => {
    mockAudioContext.state = "suspended";
    const service = new WebAudioOscillatorService({
      audioContextFactory: () => mockAudioContext as never,
      isSoundEnabled: () => true,
    });

    const playPromise = service.playCountdownBeep(3);
    await Promise.resolve();
    await Promise.resolve();

    expect(mockAudioContext.resume).toHaveBeenCalled();
    expect(mockAudioContext.createOscillator).toHaveBeenCalled();
    expect(mockOscillator.frequency.value).toBe(659);
    expect(mockOscillator.connect).toHaveBeenCalledWith(
      mockAudioContext.destination
    );
    expect(mockOscillator.start).toHaveBeenCalledWith(0);
    expect(mockOscillator.stop).toHaveBeenCalledWith(0.2);

    await jest.advanceTimersByTimeAsync(200);
    await playPromise;
  });

  it("does not play tones if sound is disabled", async () => {
    const service = new WebAudioOscillatorService({
      audioContextFactory: () => mockAudioContext as never,
      isSoundEnabled: () => false,
    });

    await service.playCountdownBeep();
    await service.playGoCue();
    await service.playFinishCue();
    await service.playPhaseTransitionCue(TimerPhase.WORK);
    await service.playLapCue();

    expect(mockAudioContext.createOscillator).not.toHaveBeenCalled();
  });

  it("plays go cue frequency and duration", async () => {
    const service = new WebAudioOscillatorService({
      audioContextFactory: () => mockAudioContext as never,
      isSoundEnabled: () => true,
    });

    const playPromise = service.playGoCue();
    await Promise.resolve();
    await Promise.resolve();

    expect(mockOscillator.frequency.value).toBe(880);
    expect(mockOscillator.stop).toHaveBeenCalledWith(0.6);

    await jest.advanceTimersByTimeAsync(600);
    await playPromise;
  });

  it("plays phase transition cues depending on phase", async () => {
    const service = new WebAudioOscillatorService({
      audioContextFactory: () => mockAudioContext as never,
      isSoundEnabled: () => true,
    });

    // REST phase
    const restPromise = service.playPhaseTransitionCue(TimerPhase.REST);
    await Promise.resolve();
    await Promise.resolve();
    expect(mockOscillator.frequency.value).toBe(523);
    await jest.advanceTimersByTimeAsync(500);
    await restPromise;

    // WORK phase
    const workPromise = service.playPhaseTransitionCue(TimerPhase.WORK);
    await Promise.resolve();
    await Promise.resolve();
    expect(mockOscillator.frequency.value).toBe(880);
    await jest.advanceTimersByTimeAsync(400);
    await workPromise;
  });

  it("plays lap cue sequence", async () => {
    const service = new WebAudioOscillatorService({
      audioContextFactory: () => mockAudioContext as never,
      isSoundEnabled: () => true,
    });

    const playPromise = service.playLapCue();
    await jest.advanceTimersByTimeAsync(300);
    await playPromise;

    expect(mockAudioContext.createOscillator).toHaveBeenCalledTimes(2);
  });

  it("plays round change cue sequence", async () => {
    const service = new WebAudioOscillatorService({
      audioContextFactory: () => mockAudioContext as never,
      isSoundEnabled: () => true,
    });

    const playPromise = service.playRoundChangeCue?.(2);
    await jest.advanceTimersByTimeAsync(600);
    await playPromise;

    expect(mockAudioContext.createOscillator).toHaveBeenCalledTimes(2);
  });

  it("plays finish cue sequence only when fully completed", async () => {
    const service = new WebAudioOscillatorService({
      audioContextFactory: () => mockAudioContext as never,
      isSoundEnabled: () => true,
    });

    // Not fully completed -> no playback
    await service.playFinishCue(false);
    expect(mockAudioContext.createOscillator).not.toHaveBeenCalled();

    // Fully completed -> plays tone sequence: 3 tones
    const playPromise = service.playFinishCue(true);
    await jest.advanceTimersByTimeAsync(1700);
    await playPromise;

    expect(mockAudioContext.createOscillator).toHaveBeenCalledTimes(3);
  });

  it("stops active oscillator and clears pending timers on stopAudio", async () => {
    const service = new WebAudioOscillatorService({
      audioContextFactory: () => mockAudioContext as never,
      isSoundEnabled: () => true,
    });

    const playPromise = service.playTone(440, 1000);
    await Promise.resolve();
    await Promise.resolve();
    expect(mockAudioContext.createOscillator).toHaveBeenCalled();

    service.stopAudio();
    await playPromise;
    expect(mockOscillator.stop).toHaveBeenCalled();
    expect(mockOscillator.disconnect).toHaveBeenCalled();
  });
});
