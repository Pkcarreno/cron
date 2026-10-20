import "react-native-gesture-handler/jestSetup";
import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import React from "react";
import { StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import renderer, { act } from "react-test-renderer";

import { Sheet, SheetContent } from "./sheet";

const mockPresent = jest.fn();
const mockDismiss = jest.fn();
let capturedOnDismiss: (() => void) | undefined;

jest.mock("@gorhom/bottom-sheet", () => {
  // oxlint-disable-next-line eslint/no-shadow
  const React = jest.requireActual("react");
  return {
    BottomSheetBackdrop: () => null,
    BottomSheetModal: React.forwardRef(
      (
        props: {
          onDismiss?: () => void;
          onChange?: (...args: unknown[]) => void;
        },
        ref: React.Ref<Record<string, unknown>>
      ) => {
        capturedOnDismiss = props.onDismiss;
        React.useImperativeHandle(ref, () => ({
          dismiss: mockDismiss,
          present: mockPresent,
          status: { current: 0 },
        }));
        return null;
      }
    ),
    BottomSheetView: ({ children }: { children: React.ReactNode }) => children,
  };
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

const initialMetrics = {
  frame: { height: 844, width: 390, x: 0, y: 0 },
  insets: { bottom: 34, left: 0, right: 0, top: 47 },
};

describe("Sheet modal lifecycle", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    capturedOnDismiss = undefined;
  });

  it("does not call dismiss on initial mount when controlled with open=false", () => {
    const controlledRef = React.createRef<BottomSheetModal>();

    act(() => {
      renderer.create(
        <GestureHandlerRootView style={styles.container}>
          <SafeAreaProvider initialMetrics={initialMetrics}>
            <Sheet ref={controlledRef} open={false}>
              <SheetContent>
                <></>
              </SheetContent>
            </Sheet>
          </SafeAreaProvider>
        </GestureHandlerRootView>
      );
    });

    expect(mockDismiss).not.toHaveBeenCalled();
    expect(mockPresent).not.toHaveBeenCalled();
  });

  it("calls present when controlled open changes to true", () => {
    let tree: renderer.ReactTestRenderer | undefined;

    act(() => {
      tree = renderer.create(
        <GestureHandlerRootView style={styles.container}>
          <SafeAreaProvider initialMetrics={initialMetrics}>
            <Sheet open={false}>
              <SheetContent>
                <></>
              </SheetContent>
            </Sheet>
          </SafeAreaProvider>
        </GestureHandlerRootView>
      );
    });

    expect(mockPresent).not.toHaveBeenCalled();

    act(() => {
      tree?.update(
        <GestureHandlerRootView style={styles.container}>
          <SafeAreaProvider initialMetrics={initialMetrics}>
            <Sheet open={true}>
              <SheetContent>
                <></>
              </SheetContent>
            </Sheet>
          </SafeAreaProvider>
        </GestureHandlerRootView>
      );
    });

    expect(mockPresent).toHaveBeenCalledTimes(1);
    expect(mockDismiss).not.toHaveBeenCalled();
  });

  it("does not call dismiss() when dismissed via onDismiss/backdrop, and can reopen cleanly", () => {
    const onOpenChange = jest.fn();

    const TestHarness = () => {
      const [isOpen, setIsOpen] = React.useState(false);
      return (
        <GestureHandlerRootView style={styles.container}>
          <SafeAreaProvider initialMetrics={initialMetrics}>
            <Sheet
              open={isOpen}
              onOpenChange={(next) => {
                onOpenChange(next);
                setIsOpen(next);
              }}
            >
              <SheetContent>
                <></>
              </SheetContent>
            </Sheet>
          </SafeAreaProvider>
        </GestureHandlerRootView>
      );
    };

    let tree: renderer.ReactTestRenderer | undefined;
    act(() => {
      tree = renderer.create(<TestHarness />);
    });

    expect(mockPresent).not.toHaveBeenCalled();
    expect(mockDismiss).not.toHaveBeenCalled();

    // 1. Open the sheet
    act(() => {
      tree?.root.findByType(Sheet).props.onOpenChange(true);
    });
    expect(mockPresent).toHaveBeenCalledTimes(1);
    expect(mockDismiss).not.toHaveBeenCalled();

    // 2. User closes without saving (e.g. backdrop pressed -> onDismiss fires)
    act(() => {
      capturedOnDismiss?.();
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
    // Crucial: dismiss() must NOT be called when modal dismissed itself
    expect(mockDismiss).not.toHaveBeenCalled();

    // 3. User taps trigger to open sheet again
    act(() => {
      tree?.root.findByType(Sheet).props.onOpenChange(true);
    });
    expect(mockPresent).toHaveBeenCalledTimes(2);
    expect(mockDismiss).not.toHaveBeenCalled();
  });
});
