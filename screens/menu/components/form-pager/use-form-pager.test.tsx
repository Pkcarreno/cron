/* oxlint-disable typescript/no-explicit-any */
import { act, cleanup, renderHook } from "@testing-library/react-native";
import * as Haptics from "expo-haptics";
import type { PagerViewOnPageSelectedEvent } from "react-native-pager-view";
import type PagerView from "react-native-pager-view";

import * as hapticsModule from "@/helpers/haptics";
import { TimerMode } from "@/helpers/timer/factory";

import type { FormTabOption } from "./types";
import { useFormPager } from "./use-form-pager";

const MOCK_OPTIONS: FormTabOption<TimerMode>[] = [
  { content: null, label: "FOR TIME", value: TimerMode.FOR_TIME },
  { content: null, label: "AMRAP", value: TimerMode.AMRAP },
  { content: null, label: "INTERVAL", value: TimerMode.INTERVAL },
  { content: null, label: "EMOM", value: TimerMode.EMOM },
  { content: null, label: "STOP WATCH", value: TimerMode.STOP_WATCH },
];

describe("useFormPager", () => {
  let triggerAndroidHapticSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    triggerAndroidHapticSpy = jest.spyOn(hapticsModule, "triggerAndroidHaptic");
  });

  afterEach(() => {
    cleanup();
  });

  describe("Passive Scroll Tracking", () => {
    it("updates scrollPosition directly on UI runtime without invoking onValueChange during motion", async () => {
      const onValueChange = jest.fn();
      const { result } = await renderHook(() =>
        useFormPager(MOCK_OPTIONS, TimerMode.FOR_TIME, onValueChange)
      );

      expect(result.current.scrollPosition.value).toBe(0);

      // Simulate continuous native onPageScroll events during gesture
      await act(() => {
        result.current.scrollHandler({
          offset: 0.35,
          position: 0,
        });
      });
      expect(result.current.scrollPosition.value).toBeCloseTo(0.35, 5);
      expect(onValueChange).not.toHaveBeenCalled();

      await act(() => {
        result.current.scrollHandler({
          offset: 0.85,
          position: 0,
        });
      });
      expect(result.current.scrollPosition.value).toBeCloseTo(0.85, 5);
      expect(onValueChange).not.toHaveBeenCalled();

      await act(() => {
        result.current.scrollHandler({
          offset: 0.2,
          position: 1,
        });
      });
      expect(result.current.scrollPosition.value).toBeCloseTo(1.2, 5);
      expect(onValueChange).not.toHaveBeenCalled();
    });
  });

  describe("Gesture Completion & Commit", () => {
    it("commits active mode to onValueChange and triggers haptic tick strictly on gesture completion", async () => {
      const onValueChange = jest.fn();
      const { result } = await renderHook(() =>
        useFormPager(MOCK_OPTIONS, TimerMode.FOR_TIME, onValueChange)
      );

      // Simulate gesture completion (user settles on INTERVAL at index 2)
      await act(() => {
        result.current.handlePageSelected({
          nativeEvent: { position: 2 },
        } as unknown as PagerViewOnPageSelectedEvent);
      });

      expect(result.current.currentIndexRef.current).toBe(2);
      expect(onValueChange).toHaveBeenCalledTimes(1);
      expect(onValueChange).toHaveBeenCalledWith(TimerMode.INTERVAL);
      expect(triggerAndroidHapticSpy).toHaveBeenCalledWith(
        Haptics.AndroidHaptics.Segment_Tick,
        expect.objectContaining({
          mode: Haptics.ImpactFeedbackStyle.Soft,
          type: hapticsModule.triggerType.Impact,
        })
      );
    });

    it("does not re-trigger onValueChange if onPageSelected fires with the current active index", async () => {
      const onValueChange = jest.fn();
      const { result } = await renderHook(() =>
        useFormPager(MOCK_OPTIONS, TimerMode.FOR_TIME, onValueChange)
      );

      await act(() => {
        result.current.handlePageSelected({
          nativeEvent: { position: 0 },
        } as unknown as PagerViewOnPageSelectedEvent);
      });

      expect(onValueChange).not.toHaveBeenCalled();
      expect(triggerAndroidHapticSpy).not.toHaveBeenCalled();
    });
  });

  describe("Echo Loop Elimination", () => {
    it("does not command pagerRef.setPage when onPageSelected causes parent to re-render with new value", async () => {
      const mockSetPage = jest.fn();
      const onValueChange = jest.fn();

      interface HookProps {
        value: TimerMode;
      }

      const { rerender, result } = await renderHook(
        ({ value }: HookProps) =>
          useFormPager(MOCK_OPTIONS, value, onValueChange),
        {
          initialProps: { value: TimerMode.FOR_TIME },
        }
      );

      // Attach mock pagerRef
      (result.current.pagerRef as any).current = {
        setPage: mockSetPage,
      } as unknown as PagerView;

      // 1. User finishes swipe gesture to EMOM (index 3)
      await act(() => {
        result.current.handlePageSelected({
          nativeEvent: { position: 3 },
        } as unknown as PagerViewOnPageSelectedEvent);
      });

      expect(onValueChange).toHaveBeenCalledWith(TimerMode.EMOM);
      expect(result.current.currentIndexRef.current).toBe(3);

      // 2. Parent re-renders with new value = EMOM
      await act(async () => {
        await rerender({ value: TimerMode.EMOM });
      });

      // Crucial: setPage MUST NOT be called (no echo loop!)
      expect(mockSetPage).not.toHaveBeenCalled();
    });

    it("commands pagerRef.setPage when value changes externally", async () => {
      const mockSetPage = jest.fn();
      const onValueChange = jest.fn();

      interface HookProps {
        value: TimerMode;
      }

      const { rerender, result } = await renderHook(
        ({ value }: HookProps) =>
          useFormPager(MOCK_OPTIONS, value, onValueChange),
        {
          initialProps: { value: TimerMode.FOR_TIME },
        }
      );

      (result.current.pagerRef as any).current = {
        setPage: mockSetPage,
      } as unknown as PagerView;

      // External state change to STOP_WATCH (index 4)
      await act(async () => {
        await rerender({ value: TimerMode.STOP_WATCH });
      });

      expect(mockSetPage).toHaveBeenCalledWith(4);
      expect(result.current.currentIndexRef.current).toBe(4);
    });
  });

  describe("Programmatic Multi-Page Jumps & Haptic Muting", () => {
    it("locks programmatic transition, mutes intermediate haptics, and ignores fighting scroll offsets", async () => {
      const mockSetPage = jest.fn();
      const onValueChange = jest.fn();

      const { result } = await renderHook(() =>
        useFormPager(MOCK_OPTIONS, TimerMode.FOR_TIME, onValueChange)
      );

      (result.current.pagerRef as any).current = {
        setPage: mockSetPage,
      } as unknown as PagerView;

      // Jump from index 0 to index 4 (STOP_WATCH)
      await act(() => {
        result.current.handleTabPress(4);
      });

      expect(mockSetPage).toHaveBeenCalledWith(4);
      expect(result.current.isProgrammaticTransition.value).toBe(true);

      // Intermediate scroll event from native momentum while animating
      await act(() => {
        result.current.scrollHandler({
          offset: 0.5,
          position: 1,
        });
      });

      // Because programmatic transition is locked, scrollPosition does not fight back
      expect(result.current.scrollPosition.value).not.toBe(1.5);

      // Landing on target page
      await act(() => {
        result.current.handlePageSelected({
          nativeEvent: { position: 4 },
        } as unknown as PagerViewOnPageSelectedEvent);
      });

      // Programmatic transition lock is released
      expect(result.current.isProgrammaticTransition.value).toBe(false);
      expect(result.current.scrollPosition.value).toBe(4);
      expect(result.current.currentIndexRef.current).toBe(4);

      // Intermediate and duplicate landing haptics are muted
      expect(triggerAndroidHapticSpy).not.toHaveBeenCalled();
      expect(onValueChange).toHaveBeenCalledWith(TimerMode.STOP_WATCH);
    });
  });
});
