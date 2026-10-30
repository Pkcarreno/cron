import { createStore } from "jotai";

import { storage } from "@/stores/storage";

import {
  hasHapticEnabledAtom,
  isHighPrecisionTimerEnabledAtom,
  isRawTimerEnabledAtom,
  isSoundEnabledAtom,
  preparationTimeMsAtom,
} from "./settings";

describe("settings store persistence", () => {
  beforeEach(() => {
    storage.clearAll();
  });

  it("initializes with default settings", () => {
    const store = createStore();

    expect(store.get(isHighPrecisionTimerEnabledAtom)).toBe(false);
    expect(store.get(isRawTimerEnabledAtom)).toBe(false);
    expect(store.get(hasHapticEnabledAtom)).toBe(true);
    expect(store.get(isSoundEnabledAtom)).toBe(true);
    expect(store.get(preparationTimeMsAtom)).toBe(10_000);
  });

  it("persists isHighPrecisionTimerEnabledAtom in MMKV and restores it across store restarts", () => {
    const firstStore = createStore();

    // Subscribe to mount the atom and trigger persistence on write
    const unsub = firstStore.sub(isHighPrecisionTimerEnabledAtom, () => {});

    expect(firstStore.get(isHighPrecisionTimerEnabledAtom)).toBe(false);

    // Toggle high precision mode on
    firstStore.set(isHighPrecisionTimerEnabledAtom, true);
    expect(firstStore.get(isHighPrecisionTimerEnabledAtom)).toBe(true);

    unsub();

    // Verify written to MMKV
    expect(
      JSON.parse(
        storage.getString("settings.isHighPrecisionTimerEnabled") ?? "false"
      )
    ).toBe(true);

    // Simulate fresh store restart
    const restartedStore = createStore();
    const unsubRestart = restartedStore.sub(
      isHighPrecisionTimerEnabledAtom,
      () => {}
    );

    expect(restartedStore.get(isHighPrecisionTimerEnabledAtom)).toBe(true);

    // Toggle back to false
    restartedStore.set(isHighPrecisionTimerEnabledAtom, false);
    expect(restartedStore.get(isHighPrecisionTimerEnabledAtom)).toBe(false);

    unsubRestart();

    expect(
      JSON.parse(
        storage.getString("settings.isHighPrecisionTimerEnabled") ?? "true"
      )
    ).toBe(false);
  });
});
