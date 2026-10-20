import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { PortalHost } from "@rn-primitives/portal";
import type {
  RenderHookOptions,
  RenderHookResult,
  RenderOptions,
  RenderResult,
} from "@testing-library/react-native";
import { act, render, renderHook } from "@testing-library/react-native";
import { Provider } from "jotai/react";
import { createStore } from "jotai/vanilla";
import React from "react";
import { StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import type { Metrics } from "react-native-safe-area-context";
import { SafeAreaProvider } from "react-native-safe-area-context";

export const defaultInitialMetrics: Metrics = {
  frame: { height: 844, width: 390, x: 0, y: 0 },
  insets: { bottom: 34, left: 0, right: 0, top: 47 },
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export interface TestProvidersProps {
  children: React.ReactNode;
  initialMetrics?: Metrics;
  store: ReturnType<typeof createStore>;
}

export const TestProviders = ({
  children,
  initialMetrics = defaultInitialMetrics,
  store,
}: TestProvidersProps) => (
  <GestureHandlerRootView style={styles.container}>
    <SafeAreaProvider initialMetrics={initialMetrics}>
      <Provider store={store}>
        <BottomSheetModalProvider>
          {children}
          <PortalHost />
        </BottomSheetModalProvider>
      </Provider>
    </SafeAreaProvider>
  </GestureHandlerRootView>
);

export interface RenderWithProvidersOptions extends Omit<
  RenderOptions,
  "wrapper"
> {
  initialMetrics?: Metrics;
  store?: ReturnType<typeof createStore>;
}

export type RenderWithProvidersResult = RenderResult & {
  store: ReturnType<typeof createStore>;
};

export const renderWithProviders = async (
  ui: React.ReactElement,
  options: RenderWithProvidersOptions = {}
): Promise<RenderWithProvidersResult> => {
  const {
    initialMetrics = defaultInitialMetrics,
    store = createStore(),
    ...renderOptions
  } = options;

  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <TestProviders initialMetrics={initialMetrics} store={store}>
      {children}
    </TestProviders>
  );

  const renderResult = await render(ui, {
    wrapper: Wrapper,
    ...renderOptions,
  });

  return {
    ...renderResult,
    store,
  };
};

export interface RenderHookWithProvidersOptions<Props> extends Omit<
  RenderHookOptions<Props>,
  "wrapper"
> {
  initialMetrics?: Metrics;
  store?: ReturnType<typeof createStore>;
}

export type RenderHookWithProvidersResult<Result, Props> = RenderHookResult<
  Result,
  Props
> & {
  store: ReturnType<typeof createStore>;
};

export const renderHookWithProviders = async <Result, Props>(
  hookToRender: (props: Props) => Result,
  options: RenderHookWithProvidersOptions<Props> = {}
): Promise<RenderHookWithProvidersResult<Result, Props>> => {
  const {
    initialMetrics = defaultInitialMetrics,
    store = createStore(),
    ...hookOptions
  } = options;

  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <TestProviders initialMetrics={initialMetrics} store={store}>
      {children}
    </TestProviders>
  );

  const hookResult = await renderHook(hookToRender, {
    wrapper: Wrapper,
    ...hookOptions,
  });

  if (hookResult.result.current === null) {
    try {
      await act(() => {
        jest.advanceTimersByTime(0);
      });
    } catch {
      // Ignored if fake timers are not installed
    }
  }

  return {
    ...hookResult,
    store,
  };
};
