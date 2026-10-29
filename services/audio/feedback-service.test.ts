import * as Haptics from "expo-haptics";
import { createStore } from "jotai/vanilla";

import { TimerController } from "@/helpers/timer/controller";
import { IntervalStrategy } from "@/helpers/timer/strategies/interval-strategy";
import type { AudioBufferPlaybackEngine } from "@/services/audio/audio-buffer-playback-engine";
import { CANONICAL_SOUNDS } from "@/services/audio/audio-buffer-playback-engine";
import {
  FeedbackCue,
  FeedbackService,
  UnifiedFeedbackService,
} from "@/services/audio/feedback-service";
import { hasHapticEnabledAtom, isSoundEnabledAtom } from "@/stores/settings";

describe("FeedbackService & Audio-Haptic Coordination", () => {
  let mockAudioEngine: {
    dispose: jest.Mock;
    playSound: jest.Mock;
    prepare: jest.Mock;
    stopAudio: jest.Mock;
  };
  let impactAsyncSpy: jest.SpyInstance;
  let notificationAsyncSpy: jest.SpyInstance;
  let testStore: ReturnType<typeof createStore>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockAudioEngine = {
      dispose: jest.fn(() => Promise.resolve()),
      playSound: jest.fn(),
      prepare: jest.fn(() => Promise.resolve()),
      stopAudio: jest.fn(),
    };

    impactAsyncSpy = jest
      .spyOn(Haptics, "impactAsync")
      .mockImplementation(() => Promise.resolve());
    notificationAsyncSpy = jest
      .spyOn(Haptics, "notificationAsync")
      .mockImplementation(() => Promise.resolve());

    testStore = createStore();
    testStore.set(isSoundEnabledAtom, true);
    testStore.set(hasHapticEnabledAtom, true);
  });

  afterEach(() => {
    impactAsyncSpy.mockRestore();
    notificationAsyncSpy.mockRestore();
  });

  describe("Semantic FeedbackCue Enumeration and Contract", () => {
    it("defines the canonical 5 semantic FeedbackCue enum values", () => {
      expect(FeedbackCue.COUNTDOWN).toBe("COUNTDOWN");
      expect(FeedbackCue.GO).toBe("GO");
      expect(FeedbackCue.REST).toBe("REST");
      expect(FeedbackCue.ROUND_CHANGE).toBe("ROUND_CHANGE");
      expect(FeedbackCue.FINISH).toBe("FINISH");
    });

    it("implements prepare, trigger, stop, and dispose contract", async () => {
      const service = new UnifiedFeedbackService({
        audioEngine: mockAudioEngine as unknown as AudioBufferPlaybackEngine,
        store: testStore,
      });

      await service.prepare();
      expect(mockAudioEngine.prepare).toHaveBeenCalledTimes(1);

      service.trigger(FeedbackCue.COUNTDOWN);
      expect(mockAudioEngine.playSound).toHaveBeenCalledWith(
        CANONICAL_SOUNDS.COUNTDOWN_BEEP
      );

      service.stop();
      expect(mockAudioEngine.stopAudio).toHaveBeenCalledTimes(1);

      await service.dispose();
      expect(mockAudioEngine.dispose).toHaveBeenCalledTimes(1);
    });

    it("allows instantiation via FeedbackService alias", () => {
      const service = new FeedbackService({
        audioEngine: mockAudioEngine as unknown as AudioBufferPlaybackEngine,
        store: testStore,
      });

      expect(service).toBeInstanceOf(UnifiedFeedbackService);
    });
  });

  describe("Transducer Dispatch & Audio-Haptic Coordination", () => {
    it("triggers COUNTDOWN with countdown_beep audio and Light impact haptic", () => {
      const service = new UnifiedFeedbackService({
        audioEngine: mockAudioEngine as unknown as AudioBufferPlaybackEngine,
        store: testStore,
      });

      service.trigger(FeedbackCue.COUNTDOWN);

      expect(mockAudioEngine.playSound).toHaveBeenCalledWith(
        CANONICAL_SOUNDS.COUNTDOWN_BEEP
      );
      expect(impactAsyncSpy).toHaveBeenCalledWith(
        Haptics.ImpactFeedbackStyle.Light
      );
    });

    it("triggers GO with go audio and Heavy impact haptic", () => {
      const service = new UnifiedFeedbackService({
        audioEngine: mockAudioEngine as unknown as AudioBufferPlaybackEngine,
        store: testStore,
      });

      service.trigger(FeedbackCue.GO);

      expect(mockAudioEngine.playSound).toHaveBeenCalledWith(
        CANONICAL_SOUNDS.GO
      );
      expect(impactAsyncSpy).toHaveBeenCalledWith(
        Haptics.ImpactFeedbackStyle.Heavy
      );
    });

    it("triggers REST with rest audio and Medium impact haptic", () => {
      const service = new UnifiedFeedbackService({
        audioEngine: mockAudioEngine as unknown as AudioBufferPlaybackEngine,
        store: testStore,
      });

      service.trigger(FeedbackCue.REST);

      expect(mockAudioEngine.playSound).toHaveBeenCalledWith(
        CANONICAL_SOUNDS.REST
      );
      expect(impactAsyncSpy).toHaveBeenCalledWith(
        Haptics.ImpactFeedbackStyle.Medium
      );
    });

    it("triggers ROUND_CHANGE with round_change audio and Light impact haptic", () => {
      const service = new UnifiedFeedbackService({
        audioEngine: mockAudioEngine as unknown as AudioBufferPlaybackEngine,
        store: testStore,
      });

      service.trigger(FeedbackCue.ROUND_CHANGE);

      expect(mockAudioEngine.playSound).toHaveBeenCalledWith(
        CANONICAL_SOUNDS.ROUND_CHANGE
      );
      expect(impactAsyncSpy).toHaveBeenCalledWith(
        Haptics.ImpactFeedbackStyle.Light
      );
    });

    it("triggers FINISH with finish audio and Success notification haptic", () => {
      const service = new UnifiedFeedbackService({
        audioEngine: mockAudioEngine as unknown as AudioBufferPlaybackEngine,
        store: testStore,
      });

      service.trigger(FeedbackCue.FINISH);

      expect(mockAudioEngine.playSound).toHaveBeenCalledWith(
        CANONICAL_SOUNDS.FINISH
      );
      expect(notificationAsyncSpy).toHaveBeenCalledWith(
        Haptics.NotificationFeedbackType.Success
      );
    });

    it("dispatches triggers synchronously without returning a promise", () => {
      const service = new UnifiedFeedbackService({
        audioEngine: mockAudioEngine as unknown as AudioBufferPlaybackEngine,
        store: testStore,
      });

      const returnValue = service.trigger(FeedbackCue.GO);
      expect(returnValue).toBeUndefined();
    });

    it("handles haptic rejections silently without throwing or unhandled rejections", () => {
      impactAsyncSpy.mockImplementation(() =>
        Promise.reject(new Error("Haptic hardware error"))
      );

      const service = new UnifiedFeedbackService({
        audioEngine: mockAudioEngine as unknown as AudioBufferPlaybackEngine,
        store: testStore,
      });

      expect(() => {
        service.trigger(FeedbackCue.GO);
      }).not.toThrow();
    });
  });

  describe("Observer Pattern: TimerController Lifecycle Attachment", () => {
    it("attaches to TimerController and translates BEEP to COUNTDOWN cue", () => {
      const strategy = new IntervalStrategy(2000, 1000, 1);
      const controller = new TimerController(strategy, 3000);

      const service = new UnifiedFeedbackService({
        audioEngine: mockAudioEngine as unknown as AudioBufferPlaybackEngine,
        store: testStore,
      });
      service.attach(controller);

      jest.useFakeTimers();
      controller.start();

      jest.advanceTimersByTime(1000);
      expect(mockAudioEngine.playSound).toHaveBeenCalledWith(
        CANONICAL_SOUNDS.COUNTDOWN_BEEP
      );
      expect(impactAsyncSpy).toHaveBeenCalledWith(
        Haptics.ImpactFeedbackStyle.Light
      );

      controller.dispose();
      jest.useRealTimers();
    });

    it("translates GO event to GO cue", () => {
      const strategy = new IntervalStrategy(2000, 1000, 1);
      const controller = new TimerController(strategy, 1000);

      const service = new UnifiedFeedbackService({
        audioEngine: mockAudioEngine as unknown as AudioBufferPlaybackEngine,
        store: testStore,
      });
      service.attach(controller);

      jest.useFakeTimers();
      controller.start();

      // After 1000ms preparation, GO fires
      jest.advanceTimersByTime(1000);
      expect(mockAudioEngine.playSound).toHaveBeenCalledWith(
        CANONICAL_SOUNDS.GO
      );
      expect(impactAsyncSpy).toHaveBeenCalledWith(
        Haptics.ImpactFeedbackStyle.Heavy
      );

      controller.dispose();
      jest.useRealTimers();
    });

    it("translates PHASE_CHANGE(REST) to REST cue and PHASE_CHANGE(WORK) to GO cue", () => {
      const strategy = new IntervalStrategy(2000, 1000, 2);
      const controller = new TimerController(strategy, 0);

      const service = new UnifiedFeedbackService({
        audioEngine: mockAudioEngine as unknown as AudioBufferPlaybackEngine,
        store: testStore,
      });
      service.attach(controller);

      jest.useFakeTimers();
      controller.start();

      // Work phase 1 completes (2000ms) -> Rest phase 1
      jest.advanceTimersByTime(2000);
      expect(mockAudioEngine.playSound).toHaveBeenCalledWith(
        CANONICAL_SOUNDS.REST
      );
      expect(impactAsyncSpy).toHaveBeenCalledWith(
        Haptics.ImpactFeedbackStyle.Medium
      );

      // Rest phase 1 completes (1000ms) -> Work phase 2
      jest.advanceTimersByTime(1000);
      expect(mockAudioEngine.playSound).toHaveBeenCalledWith(
        CANONICAL_SOUNDS.ROUND_CHANGE
      );
      expect(mockAudioEngine.playSound).toHaveBeenCalledWith(
        CANONICAL_SOUNDS.GO
      );

      controller.dispose();
      jest.useRealTimers();
    });

    it("translates FINISH event to FINISH cue", () => {
      const strategy = new IntervalStrategy(1000, 500, 1);
      const controller = new TimerController(strategy, 0);

      const service = new UnifiedFeedbackService({
        audioEngine: mockAudioEngine as unknown as AudioBufferPlaybackEngine,
        store: testStore,
      });
      service.attach(controller);

      jest.useFakeTimers();
      controller.start();

      // Work (1000ms) + Rest (500ms) = 1500ms -> Finish
      jest.advanceTimersByTime(1500);
      expect(mockAudioEngine.playSound).toHaveBeenCalledWith(
        CANONICAL_SOUNDS.FINISH
      );
      expect(notificationAsyncSpy).toHaveBeenCalledWith(
        Haptics.NotificationFeedbackType.Success
      );

      controller.dispose();
      jest.useRealTimers();
    });

    it("stops audio on PAUSE and RESET events", () => {
      const strategy = new IntervalStrategy(2000, 1000, 1);
      const controller = new TimerController(strategy, 0);

      const service = new UnifiedFeedbackService({
        audioEngine: mockAudioEngine as unknown as AudioBufferPlaybackEngine,
        store: testStore,
      });
      service.attach(controller);

      controller.start();
      controller.pause();
      expect(mockAudioEngine.stopAudio).toHaveBeenCalledTimes(1);

      controller.reset();
      expect(mockAudioEngine.stopAudio).toHaveBeenCalledTimes(2);

      controller.dispose();
    });

    it("detaches cleanly and ignores subsequent controller events", () => {
      const strategy = new IntervalStrategy(2000, 1000, 1);
      const controller = new TimerController(strategy, 3000);

      const service = new UnifiedFeedbackService({
        audioEngine: mockAudioEngine as unknown as AudioBufferPlaybackEngine,
        store: testStore,
      });
      const unsubscribe = service.attach(controller);

      unsubscribe();

      jest.useFakeTimers();
      controller.start();
      jest.advanceTimersByTime(1000);

      expect(mockAudioEngine.playSound).not.toHaveBeenCalled();
      expect(impactAsyncSpy).not.toHaveBeenCalled();

      controller.dispose();
      jest.useRealTimers();
    });
  });

  describe("Reactive Settings Gating via Jotai Subscriptions", () => {
    it("respects sound disabled in store state while keeping haptics active", () => {
      testStore.set(isSoundEnabledAtom, false);
      testStore.set(hasHapticEnabledAtom, true);

      const service = new UnifiedFeedbackService({
        audioEngine: mockAudioEngine as unknown as AudioBufferPlaybackEngine,
        store: testStore,
      });

      service.trigger(FeedbackCue.GO);

      expect(mockAudioEngine.playSound).not.toHaveBeenCalled();
      expect(impactAsyncSpy).toHaveBeenCalledWith(
        Haptics.ImpactFeedbackStyle.Heavy
      );
    });

    it("respects haptics disabled in store state while keeping sound active", () => {
      testStore.set(isSoundEnabledAtom, true);
      testStore.set(hasHapticEnabledAtom, false);

      const service = new UnifiedFeedbackService({
        audioEngine: mockAudioEngine as unknown as AudioBufferPlaybackEngine,
        store: testStore,
      });

      service.trigger(FeedbackCue.GO);

      expect(mockAudioEngine.playSound).toHaveBeenCalledWith(
        CANONICAL_SOUNDS.GO
      );
      expect(impactAsyncSpy).not.toHaveBeenCalled();
      expect(notificationAsyncSpy).not.toHaveBeenCalled();
    });

    it("silences both when both toggles are disabled in store", () => {
      testStore.set(isSoundEnabledAtom, false);
      testStore.set(hasHapticEnabledAtom, false);

      const service = new UnifiedFeedbackService({
        audioEngine: mockAudioEngine as unknown as AudioBufferPlaybackEngine,
        store: testStore,
      });

      service.trigger(FeedbackCue.GO);

      expect(mockAudioEngine.playSound).not.toHaveBeenCalled();
      expect(impactAsyncSpy).not.toHaveBeenCalled();
    });

    it("dynamically reacts to store updates in real-time without recreating service", () => {
      const service = new UnifiedFeedbackService({
        audioEngine: mockAudioEngine as unknown as AudioBufferPlaybackEngine,
        store: testStore,
      });

      // Initially both enabled
      service.trigger(FeedbackCue.COUNTDOWN);
      expect(mockAudioEngine.playSound).toHaveBeenCalledTimes(1);
      expect(impactAsyncSpy).toHaveBeenCalledTimes(1);

      // Disable sound dynamically
      testStore.set(isSoundEnabledAtom, false);

      service.trigger(FeedbackCue.COUNTDOWN);
      // Play sound count should not increment while sound is disabled
      expect(mockAudioEngine.playSound).toHaveBeenCalledTimes(1);
      expect(impactAsyncSpy).toHaveBeenCalledTimes(2);

      // Disable haptics dynamically
      testStore.set(hasHapticEnabledAtom, false);

      service.trigger(FeedbackCue.COUNTDOWN);
      expect(mockAudioEngine.playSound).toHaveBeenCalledTimes(1);
      // Impact count should not increment while haptics are disabled
      expect(impactAsyncSpy).toHaveBeenCalledTimes(2);

      // Re-enable sound dynamically
      testStore.set(isSoundEnabledAtom, true);

      service.trigger(FeedbackCue.COUNTDOWN);
      expect(mockAudioEngine.playSound).toHaveBeenCalledTimes(2);
      expect(impactAsyncSpy).toHaveBeenCalledTimes(2);
    });

    it("unsubscribes from store on dispose", async () => {
      const service = new UnifiedFeedbackService({
        audioEngine: mockAudioEngine as unknown as AudioBufferPlaybackEngine,
        store: testStore,
      });

      await service.dispose();

      // Mutating store after dispose should not cause issues or update disposed state
      expect(() => {
        testStore.set(isSoundEnabledAtom, false);
        testStore.set(hasHapticEnabledAtom, false);
      }).not.toThrow();
    });
  });
});
