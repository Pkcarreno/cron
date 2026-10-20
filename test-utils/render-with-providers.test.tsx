import { act } from "@testing-library/react-native";
import { atom, useAtom } from "jotai";
import React from "react";
import { Text } from "react-native";
import { createMMKV } from "react-native-mmkv";

import { atomWithMMKV } from "@/stores/storage";

import {
  renderHookWithProviders,
  renderWithProviders,
} from "./render-with-providers";

const counterAtom = atom(0);
const persistedCounterAtom = atomWithMMKV("test_counter", 10);

const CounterDisplay = () => {
  const [count, setCount] = useAtom(counterAtom);
  return (
    <Text testID="counter" onPress={() => setCount((c) => c + 1)}>
      Count: {count}
    </Text>
  );
};

const PersistedCounterDisplay = () => {
  const [count, setCount] = useAtom(persistedCounterAtom);
  return (
    <Text testID="persisted-counter" onPress={() => setCount((c) => c + 5)}>
      Persisted: {count}
    </Text>
  );
};

describe("renderWithProviders harness", () => {
  it("confirms automatic in-memory mocking of react-native-mmkv in test environments", () => {
    expect(process.env.NODE_ENV).toBe("test");

    const storage = createMMKV();
    storage.set("harness_test_key", "active");
    expect(storage.getString("harness_test_key")).toBe("active");
    storage.remove("harness_test_key");
    expect(storage.getString("harness_test_key")).toBeUndefined();
  });

  it("renders components wrapped with all providers and provides an isolated Jotai store", async () => {
    const screen1 = await renderWithProviders(<CounterDisplay />);
    expect(screen1.getByTestId("counter")).toBeTruthy();
    expect(screen1.getByText("Count: 0")).toBeTruthy();

    await act(() => {
      screen1.store.set(counterAtom, 42);
    });
    await screen1.rerender(<CounterDisplay />);
    expect(screen1.getByText("Count: 42")).toBeTruthy();

    // Verify a second render has an isolated, pristine store
    const screen2 = await renderWithProviders(<CounterDisplay />);
    expect(screen2.getByText("Count: 0")).toBeTruthy();
    expect(screen2.store.get(counterAtom)).toBe(0);
    expect(screen1.store.get(counterAtom)).toBe(42);
  });

  it("supports hook testing via renderHookWithProviders with isolated store", async () => {
    const { result, store } = await renderHookWithProviders(() =>
      useAtom(counterAtom)
    );

    expect(result.current[0]).toBe(0);

    await act(() => {
      store.set(counterAtom, 99);
    });
    expect(store.get(counterAtom)).toBe(99);
  });

  it("persists in-memory values through atomWithMMKV", async () => {
    const screen = await renderWithProviders(<PersistedCounterDisplay />);
    expect(screen.getByText("Persisted: 10")).toBeTruthy();
  });
});
