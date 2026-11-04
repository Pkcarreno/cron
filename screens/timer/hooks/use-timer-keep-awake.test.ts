import { act, renderHook } from "@testing-library/react-native";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";

import {
  TIMER_KEEP_AWAKE_TAG,
  useTimerKeepAwake,
} from "./use-timer-keep-awake";

jest.mock("expo-keep-awake", () => ({
  activateKeepAwakeAsync: jest.fn(() => Promise.resolve()),
  deactivateKeepAwake: jest.fn(() => Promise.resolve()),
}));

describe("useTimerKeepAwake", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("activates keep awake with tag 'cron-timer' when isActive is true", async () => {
    await renderHook(() => useTimerKeepAwake(true));

    expect(activateKeepAwakeAsync).toHaveBeenCalledTimes(1);
    expect(activateKeepAwakeAsync).toHaveBeenCalledWith(TIMER_KEEP_AWAKE_TAG);
    expect(deactivateKeepAwake).not.toHaveBeenCalled();
  });

  it("does not activate keep awake when isActive is false", async () => {
    await renderHook(() => useTimerKeepAwake(false));

    expect(activateKeepAwakeAsync).not.toHaveBeenCalled();
    expect(deactivateKeepAwake).not.toHaveBeenCalled();
  });

  it("deactivates keep awake when transitioning from active to inactive", async () => {
    const hook = await renderHook(
      ({ isActive }: { isActive: boolean }) => {
        useTimerKeepAwake(isActive);
      },
      { initialProps: { isActive: true } }
    );

    expect(activateKeepAwakeAsync).toHaveBeenCalledTimes(1);
    expect(deactivateKeepAwake).not.toHaveBeenCalled();

    await act(() => {
      hook.rerender({ isActive: false });
    });

    expect(deactivateKeepAwake).toHaveBeenCalledTimes(1);
    expect(deactivateKeepAwake).toHaveBeenCalledWith(TIMER_KEEP_AWAKE_TAG);
  });

  it("re-activates keep awake when transitioning from inactive back to active", async () => {
    const hook = await renderHook(
      ({ isActive }: { isActive: boolean }) => {
        useTimerKeepAwake(isActive);
      },
      { initialProps: { isActive: false } }
    );

    expect(activateKeepAwakeAsync).not.toHaveBeenCalled();

    await act(() => {
      hook.rerender({ isActive: true });
    });

    expect(activateKeepAwakeAsync).toHaveBeenCalledTimes(1);
    expect(activateKeepAwakeAsync).toHaveBeenCalledWith(TIMER_KEEP_AWAKE_TAG);
    expect(deactivateKeepAwake).not.toHaveBeenCalled();
  });

  it("deactivates keep awake on unmount if it was active", async () => {
    const hook = await renderHook(() => useTimerKeepAwake(true));

    expect(deactivateKeepAwake).not.toHaveBeenCalled();

    await act(() => {
      hook.unmount();
    });

    expect(deactivateKeepAwake).toHaveBeenCalledTimes(1);
    expect(deactivateKeepAwake).toHaveBeenCalledWith(TIMER_KEEP_AWAKE_TAG);
  });

  it("does not call deactivate on unmount if it was never active", async () => {
    const hook = await renderHook(() => useTimerKeepAwake(false));

    await act(() => {
      hook.unmount();
    });

    expect(activateKeepAwakeAsync).not.toHaveBeenCalled();
    expect(deactivateKeepAwake).not.toHaveBeenCalled();
  });

  it("handles async rejection gracefully without unhandled errors", async () => {
    (activateKeepAwakeAsync as jest.Mock).mockRejectedValueOnce(
      new Error("WakeLock unavailable")
    );
    (deactivateKeepAwake as jest.Mock).mockRejectedValueOnce(
      new Error("Deactivate failed")
    );

    const hook = await renderHook(() => useTimerKeepAwake(true));
    expect(activateKeepAwakeAsync).toHaveBeenCalledTimes(1);

    await act(() => {
      hook.unmount();
    });
    expect(deactivateKeepAwake).toHaveBeenCalledTimes(1);
  });
});
