import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";
import type {
  AudioBuffer,
  AudioBufferSourceNode,
} from "react-native-audio-api";
import { AudioManager } from "react-native-audio-api";

import {
  AudioBufferPlaybackEngine,
  CANONICAL_SOUNDS,
  WORKOUT_AUDIO_SESSION_OPTIONS,
} from "@/services/audio/audio-buffer-playback-engine";
import type { CanonicalSoundName } from "@/services/audio/audio-buffer-playback-engine";

describe("AudioBufferPlaybackEngine", () => {
  let mockSourceNode: {
    buffer: AudioBuffer | null;
    connect: jest.Mock;
    disconnect: jest.Mock;
    onended: ((event: Event) => void) | null;
    start: jest.Mock;
    stop: jest.Mock;
  };

  let mockAudioContext: {
    close: jest.Mock<() => Promise<void>>;
    createBufferSource: jest.Mock<() => typeof mockSourceNode>;
    currentTime: number;
    decodeAudioData: jest.Mock<(source: unknown) => Promise<AudioBuffer>>;
    destination: object;
    resume: jest.Mock<() => Promise<void>>;
    sampleRate: number;
    state: string;
    suspend: jest.Mock<() => Promise<void>>;
  };

  let mockBuffers: Record<CanonicalSoundName, AudioBuffer>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockSourceNode = {
      buffer: null,
      connect: jest.fn(),
      disconnect: jest.fn(),
      onended: null,
      start: jest.fn(),
      stop: jest.fn(),
    };

    mockBuffers = {
      countdown_beep: {
        duration: 0.12,
        length: 5292,
        numberOfChannels: 1,
        sampleRate: 44_100,
      } as unknown as AudioBuffer,
      finish: {
        duration: 1.5,
        length: 66_150,
        numberOfChannels: 1,
        sampleRate: 44_100,
      } as unknown as AudioBuffer,
      go: {
        duration: 0.7,
        length: 30_870,
        numberOfChannels: 1,
        sampleRate: 44_100,
      } as unknown as AudioBuffer,
      rest: {
        duration: 0.35,
        length: 15_435,
        numberOfChannels: 1,
        sampleRate: 44_100,
      } as unknown as AudioBuffer,
      round_change: {
        duration: 0.14,
        length: 6174,
        numberOfChannels: 1,
        sampleRate: 44_100,
      } as unknown as AudioBuffer,
    };

    mockAudioContext = {
      close: jest.fn(() => {
        mockAudioContext.state = "closed";
        return Promise.resolve();
      }),
      createBufferSource: jest.fn(() => mockSourceNode),
      currentTime: 12.345,
      decodeAudioData: jest.fn((source: unknown) => {
        const soundKey = source as CanonicalSoundName;
        return Promise.resolve(mockBuffers[soundKey] ?? mockBuffers.go);
      }),
      destination: {},
      resume: jest.fn(() => {
        mockAudioContext.state = "running";
        return Promise.resolve();
      }),
      sampleRate: 44_100,
      state: "running",
      suspend: jest.fn(() => {
        mockAudioContext.state = "suspended";
        return Promise.resolve();
      }),
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("Audio Session Configuration", () => {
    it("eagerly configures audio session on engine creation without claiming focus while idle", () => {
      const engine = new AudioBufferPlaybackEngine({
        audioContextFactory: () => mockAudioContext as never,
      });
      expect(engine.isReady()).toBe(false);

      expect(AudioManager.setAudioSessionOptions).toHaveBeenCalledTimes(1);
      expect(AudioManager.setAudioSessionOptions).toHaveBeenCalledWith(
        WORKOUT_AUDIO_SESSION_OPTIONS
      );
      expect(AudioManager.setAudioSessionOptions).toHaveBeenCalledWith(
        expect.objectContaining({
          iosCategory: "playback",
          iosMode: "default",
          iosNotifyOthersOnDeactivation: true,
          iosOptions: expect.arrayContaining([
            "duckOthers",
            "mixWithOthers",
            "defaultToSpeaker",
          ]),
        })
      );
      // Crucial: do not steal permanent audio focus on engine creation
      expect(AudioManager.observeAudioInterruptions).not.toHaveBeenCalled();
    });

    it("safely handles error if audio manager throws during configuration", () => {
      const mockWarn = jest.spyOn(console, "warn").mockImplementation(() => {});
      const errorThrowingManager = {
        ...AudioManager,
        setAudioSessionOptions: jest.fn(() => {
          throw new Error("AVAudioSession error");
        }),
      } as unknown as typeof AudioManager;

      expect(() => {
        const engine = new AudioBufferPlaybackEngine({
          audioContextFactory: () => mockAudioContext as never,
          audioManager: errorThrowingManager,
        });
        expect(engine).toBeDefined();
      }).not.toThrow();

      mockWarn.mockRestore();
    });
  });

  describe("Sound Buffer Preloading & Lifecycle", () => {
    it("works with default AudioContext mock from react-native-audio-api/mock", async () => {
      const engine = new AudioBufferPlaybackEngine();
      expect(engine.isReady()).toBe(false);

      await engine.prepare();

      expect(engine.isReady()).toBe(true);
      expect(engine.getSoundBuffer("go")).toBeDefined();
    });

    it("loads and decodes all 5 canonical wav assets into native AudioBuffer memory", async () => {
      const mockAssets: Record<CanonicalSoundName, string> = {
        countdown_beep: "countdown_beep",
        finish: "finish",
        go: "go",
        rest: "rest",
        round_change: "round_change",
      };

      const engine = new AudioBufferPlaybackEngine({
        assets: mockAssets,
        audioContextFactory: () => mockAudioContext as never,
      });

      expect(engine.isReady()).toBe(false);

      await engine.prepare();

      expect(engine.isReady()).toBe(true);
      expect(mockAudioContext.decodeAudioData).toHaveBeenCalledTimes(5);

      for (const soundName of Object.values(CANONICAL_SOUNDS)) {
        expect(engine.getSoundBuffer(soundName)).toBe(mockBuffers[soundName]);
      }
    });

    it("does not resume audio context during prepare to avoid pausing or ducking background music while idle", async () => {
      mockAudioContext.state = "suspended";
      const engine = new AudioBufferPlaybackEngine({
        audioContextFactory: () => mockAudioContext as never,
      });

      await engine.prepare();

      expect(mockAudioContext.resume).not.toHaveBeenCalled();
      expect(AudioManager.observeAudioInterruptions).not.toHaveBeenCalled();
    });

    it("is idempotent when prepare is called multiple times concurrently or sequentially", async () => {
      const engine = new AudioBufferPlaybackEngine({
        audioContextFactory: () => mockAudioContext as never,
      });

      const p1 = engine.prepare();
      const p2 = engine.prepare();
      await Promise.all([p1, p2]);
      await engine.prepare();

      expect(mockAudioContext.decodeAudioData).toHaveBeenCalledTimes(5);
    });

    it("resets state and allows retry if asset decoding fails during prepare", async () => {
      const mockError = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});
      mockAudioContext.decodeAudioData.mockRejectedValueOnce(
        new Error("Corrupt WAV header")
      );

      const engine = new AudioBufferPlaybackEngine({
        audioContextFactory: () => mockAudioContext as never,
      });

      await expect(engine.prepare()).rejects.toThrow("Corrupt WAV header");
      expect(engine.isReady()).toBe(false);

      mockAudioContext.decodeAudioData.mockImplementation((source: unknown) =>
        Promise.resolve(
          mockBuffers[source as CanonicalSoundName] ?? mockBuffers.go
        )
      );

      await expect(engine.prepare()).resolves.toBeUndefined();
      expect(engine.isReady()).toBe(true);

      mockError.mockRestore();
    });
  });

  describe("Playback Scheduling & Hardware Timing", () => {
    it("dispatches AudioBufferSourceNode on audioContext.currentTime without JS timer delays", async () => {
      const mockAssets: Record<CanonicalSoundName, string> = {
        countdown_beep: "countdown_beep",
        finish: "finish",
        go: "go",
        rest: "rest",
        round_change: "round_change",
      };

      const engine = new AudioBufferPlaybackEngine({
        assets: mockAssets,
        audioContextFactory: () => mockAudioContext as never,
      });

      await engine.prepare();

      const source = engine.playSound("go");

      expect(mockAudioContext.createBufferSource).toHaveBeenCalledTimes(1);
      expect(mockSourceNode.buffer).toBe(mockBuffers.go);
      expect(mockSourceNode.connect).toHaveBeenCalledWith(
        mockAudioContext.destination
      );
      expect(mockSourceNode.start).toHaveBeenCalledWith(12.345);
      expect(source).toBe(mockSourceNode as unknown as AudioBufferSourceNode);
    });

    it("supports custom hardware scheduling timestamp when provided", async () => {
      const engine = new AudioBufferPlaybackEngine({
        audioContextFactory: () => mockAudioContext as never,
      });

      await engine.prepare();

      const futureTime = 15.5;
      engine.playSound("countdown_beep", futureTime);

      expect(mockSourceNode.start).toHaveBeenCalledWith(futureTime);
    });

    it("does not play sounds if sound is disabled", async () => {
      const engine = new AudioBufferPlaybackEngine({
        audioContextFactory: () => mockAudioContext as never,
        isSoundEnabled: () => false,
      });

      await engine.prepare();

      const source = engine.playSound("go");

      expect(source).toBeNull();
      expect(mockAudioContext.createBufferSource).not.toHaveBeenCalled();
    });

    it("warns and returns null if playing a sound before engine buffer is loaded", () => {
      const mockWarn = jest.spyOn(console, "warn").mockImplementation(() => {});
      const engine = new AudioBufferPlaybackEngine({
        audioContextFactory: () => mockAudioContext as never,
      });

      const source = engine.playSound("go");

      expect(source).toBeNull();
      expect(mockWarn).toHaveBeenCalledWith(
        expect.stringContaining('Cannot play "go"')
      );
      mockWarn.mockRestore();
    });

    it("stops all active sources when stopAudio is called", async () => {
      const engine = new AudioBufferPlaybackEngine({
        audioContextFactory: () => mockAudioContext as never,
      });

      await engine.prepare();

      engine.playSound("go");
      engine.stopAudio();

      expect(mockSourceNode.stop).toHaveBeenCalledTimes(1);
      expect(mockSourceNode.disconnect).toHaveBeenCalledTimes(1);
    });

    it("safely handles error if stopping a node throws during stopAudio", async () => {
      const mockError = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});
      mockSourceNode.stop.mockImplementation(() => {
        throw new Error("Node already stopped");
      });

      const engine = new AudioBufferPlaybackEngine({
        audioContextFactory: () => mockAudioContext as never,
      });

      await engine.prepare();

      engine.playSound("go");
      expect(() => {
        engine.stopAudio();
      }).not.toThrow();

      mockError.mockRestore();
    });
  });

  describe("Disposal and Context Management", () => {
    it("disposes audio context, stops audio, and resets buffers", async () => {
      const engine = new AudioBufferPlaybackEngine({
        audioContextFactory: () => mockAudioContext as never,
      });

      await engine.prepare();
      expect(engine.isReady()).toBe(true);

      await engine.dispose();

      expect(mockAudioContext.close).toHaveBeenCalledTimes(1);
      expect(engine.isReady()).toBe(false);
      expect(engine.getSoundBuffer("go")).toBeUndefined();
    });

    it("supports suspend and resume methods", async () => {
      const engine = new AudioBufferPlaybackEngine({
        audioContextFactory: () => mockAudioContext as never,
      });

      await engine.prepare();
      await engine.suspend();
      expect(mockAudioContext.suspend).toHaveBeenCalledTimes(1);

      await engine.resume();
      expect(mockAudioContext.resume).toHaveBeenCalled();
    });
  });

  describe("Demand-Driven Audio Focus & Transient Ducking", () => {
    it("requests transient ducking focus and activates audio session upon playback", async () => {
      const engine = new AudioBufferPlaybackEngine({
        audioContextFactory: () => mockAudioContext as never,
      });

      await engine.prepare();
      expect(AudioManager.observeAudioInterruptions).not.toHaveBeenCalled();
      expect(AudioManager.setAudioSessionActivity).not.toHaveBeenCalled();

      engine.playSound("go");

      expect(AudioManager.observeAudioInterruptions).toHaveBeenCalledWith(
        "gainTransientMayDuck"
      );
      expect(AudioManager.setAudioSessionActivity).toHaveBeenCalledWith(true);
    });

    it("releases audio focus and deactivates session when sound finishes", async () => {
      jest.useFakeTimers();
      const engine = new AudioBufferPlaybackEngine({
        audioContextFactory: () => mockAudioContext as never,
      });

      await engine.prepare();
      const source = engine.playSound("go");
      expect(source).not.toBeNull();

      expect(AudioManager.observeAudioInterruptions).toHaveBeenCalledWith(
        "gainTransientMayDuck"
      );

      // Simulate sound playback end
      mockSourceNode.onended?.(new Event("ended"));

      // Still in drain window (200ms) to prevent speaker pop
      expect(AudioManager.observeAudioInterruptions).not.toHaveBeenCalledWith(
        false
      );

      // Advance through drain window (200ms)
      jest.advanceTimersByTime(200);

      expect(AudioManager.observeAudioInterruptions).toHaveBeenCalledWith(
        false
      );
      expect(AudioManager.setAudioSessionActivity).toHaveBeenCalledWith(false);

      // Advance through idle sleep timer (1500ms) to suspend AudioContext
      jest.advanceTimersByTime(1500);
      expect(mockAudioContext.suspend).toHaveBeenCalledTimes(1);

      jest.useRealTimers();
    });

    it("maintains focus during overlapping sounds and releases only when all end", async () => {
      jest.useFakeTimers();
      const engine = new AudioBufferPlaybackEngine({
        audioContextFactory: () => mockAudioContext as never,
      });

      await engine.prepare();

      const sourceNode1 = { ...mockSourceNode };
      const sourceNode2 = { ...mockSourceNode };
      mockAudioContext.createBufferSource
        .mockReturnValueOnce(sourceNode1)
        .mockReturnValueOnce(sourceNode2);

      const source1 = engine.playSound("countdown_beep");
      const source2 = engine.playSound("go");

      expect(source1).toBe(sourceNode1);
      expect(source2).toBe(sourceNode2);
      expect(AudioManager.observeAudioInterruptions).toHaveBeenCalledWith(
        "gainTransientMayDuck"
      );

      // Finish first sound - focus must NOT be released because second sound is still active
      sourceNode1.onended?.(new Event("ended"));
      expect(AudioManager.observeAudioInterruptions).not.toHaveBeenCalledWith(
        false
      );

      // Finish second sound - focus must stay held during drain window
      sourceNode2.onended?.(new Event("ended"));
      expect(AudioManager.observeAudioInterruptions).not.toHaveBeenCalledWith(
        false
      );

      // Advance past drain time (200ms)
      jest.advanceTimersByTime(200);

      expect(AudioManager.observeAudioInterruptions).toHaveBeenCalledWith(
        false
      );
      expect(AudioManager.setAudioSessionActivity).toHaveBeenCalledWith(false);

      jest.useRealTimers();
    });

    it("holds ducking during countdown beeps for 1200ms to prevent volume pumping across 1s intervals", async () => {
      jest.useFakeTimers();
      const engine = new AudioBufferPlaybackEngine({
        audioContextFactory: () => mockAudioContext as never,
      });

      await engine.prepare();
      engine.playSound("countdown_beep");

      // Simulate beep ending
      mockSourceNode.onended?.(new Event("ended"));

      // 1000ms later (next beep interval): ducking should STILL be held
      jest.advanceTimersByTime(1000);
      expect(AudioManager.observeAudioInterruptions).not.toHaveBeenCalledWith(
        false
      );

      // After 1200ms total: hold expires and releases focus
      jest.advanceTimersByTime(200);
      expect(AudioManager.observeAudioInterruptions).toHaveBeenCalledWith(
        false
      );

      jest.useRealTimers();
    });

    it("pre-warms the audio pipeline on warmUp and resumes suspended context", async () => {
      jest.useFakeTimers();
      mockAudioContext.state = "suspended";
      const engine = new AudioBufferPlaybackEngine({
        audioContextFactory: () => mockAudioContext as never,
      });

      await engine.prepare();
      engine.warmUp();

      expect(AudioManager.observeAudioInterruptions).toHaveBeenCalledWith(
        "gainTransientMayDuck"
      );
      expect(mockAudioContext.resume).toHaveBeenCalledTimes(1);

      // Safety timeout releases focus if no cue fires within 3000ms
      jest.advanceTimersByTime(3000);
      expect(AudioManager.observeAudioInterruptions).toHaveBeenCalledWith(
        false
      );

      jest.useRealTimers();
    });

    it("does not warm up when sound is disabled", async () => {
      const engine = new AudioBufferPlaybackEngine({
        audioContextFactory: () => mockAudioContext as never,
        isSoundEnabled: () => false,
      });

      await engine.prepare();
      engine.warmUp();

      expect(AudioManager.observeAudioInterruptions).not.toHaveBeenCalled();
    });

    it("releases audio focus immediately on stop", async () => {
      const engine = new AudioBufferPlaybackEngine({
        audioContextFactory: () => mockAudioContext as never,
      });

      await engine.prepare();
      engine.playSound("go");

      engine.stop();

      expect(AudioManager.observeAudioInterruptions).toHaveBeenCalledWith(
        false
      );
      expect(AudioManager.setAudioSessionActivity).toHaveBeenCalledWith(false);
    });

    it("releases audio focus immediately on stopAudio alias", async () => {
      const engine = new AudioBufferPlaybackEngine({
        audioContextFactory: () => mockAudioContext as never,
      });

      await engine.prepare();
      engine.playSound("go");

      engine.stopAudio();

      expect(AudioManager.observeAudioInterruptions).toHaveBeenCalledWith(
        false
      );
      expect(AudioManager.setAudioSessionActivity).toHaveBeenCalledWith(false);
    });

    it("does not request audio focus when sound is disabled", async () => {
      const engine = new AudioBufferPlaybackEngine({
        audioContextFactory: () => mockAudioContext as never,
        isSoundEnabled: () => false,
      });

      await engine.prepare();
      engine.playSound("go");

      expect(AudioManager.observeAudioInterruptions).not.toHaveBeenCalled();
      expect(AudioManager.setAudioSessionActivity).not.toHaveBeenCalled();
    });
  });
});
