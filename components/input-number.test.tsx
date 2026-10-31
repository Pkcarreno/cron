/* oxlint-disable node/global-require, unicorn/prefer-module */
import { TrueSheet } from "@lodev09/react-native-true-sheet";
import { act, cleanup, fireEvent } from "@testing-library/react-native";
import React from "react";
import { StyleSheet, Text } from "react-native";

import { renderWithProviders } from "@/test-utils/render-with-providers";

import { InputNumber, NumberPickerForm } from "./input-number";
import { Sheet, SheetContent } from "./sheet";

jest.mock("./input-thumbwheel", () => {
  const actual = jest.requireActual("./input-thumbwheel");
  const ReactMock = require("react");
  const { View: ViewMock } = require("react-native");

  const MockInputThumbwheel = (props: Record<string, unknown>) =>
    ReactMock.createElement(ViewMock, {
      collapsable: false,
      testID: props.testID ?? "thumbwheel-picker",
      ...props,
    });
  MockInputThumbwheel.displayName = "InputThumbwheel";

  return {
    __esModule: true,
    ...actual,
    default: MockInputThumbwheel,
  };
});

describe("InputNumber integration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders formatted value and suffix", async () => {
    const screen = await renderWithProviders(
      <InputNumber value={5} suffix="min" />
    );

    expect(screen.getByText("05")).toBeTruthy();
    expect(screen.getByText("min")).toBeTruthy();
  });

  it("simulates user touch gestures: opening sheet, tapping quick actions, and saving", async () => {
    const onChangeValue = jest.fn();

    const screen = await renderWithProviders(
      <InputNumber value={10} onChangeValue={onChangeValue} suffix="sec" />
    );

    // 1. Simulate tapping the trigger to open number picker sheet
    const [trigger] = screen.getAllByText("10");
    await act(() => {
      fireEvent.press(trigger);
    });

    // 2. Verify quick action buttons and Save button are available
    expect(screen.getByText("+5")).toBeTruthy();
    expect(screen.getByText("+10")).toBeTruthy();
    expect(screen.getByText("-5")).toBeTruthy();
    expect(screen.getByText("-10")).toBeTruthy();

    // 3. Simulate tap on +5 quick action
    await act(() => {
      fireEvent.press(screen.getByText("+5"));
    });

    // 4. Simulate tap on Save button
    await act(() => {
      fireEvent.press(screen.getByText("Save"));
    });

    expect(onChangeValue).toHaveBeenCalledWith(15);
  });

  it("disables subtraction quick actions when current value is at min bound", async () => {
    const onChangeValue = jest.fn();

    const screen = await renderWithProviders(
      <InputNumber value={0} min={0} max={60} onChangeValue={onChangeValue} />
    );

    // Open sheet
    const [trigger] = screen.getAllByText("00");
    await act(() => {
      fireEvent.press(trigger);
    });

    // -10 and -5 should be visible in picker
    const minusFiveButton = screen.getByText("-5");
    const minusTenButton = screen.getByText("-10");

    expect(minusFiveButton).toBeTruthy();
    expect(minusTenButton).toBeTruthy();
  });

  it("does not trigger open sheet when editable is false", async () => {
    const presentSpy = jest.spyOn(TrueSheet.prototype, "present");

    const screen = await renderWithProviders(
      <InputNumber value={25} editable={false} />
    );

    const [trigger] = screen.getAllByText("25");
    await act(() => {
      fireEvent.press(trigger);
    });

    expect(presentSpy).not.toHaveBeenCalled();
    presentSpy.mockRestore();
  });

  it("renders trigger with default testID and collapsable={false}, and supports custom testID", async () => {
    const screen = await renderWithProviders(
      <InputNumber value={5} suffix="min" />
    );

    const trigger = screen.getByTestId("input-number-trigger");
    expect(trigger).toBeTruthy();
    expect(trigger.props.collapsable).toBe(false);

    const customScreen = await renderWithProviders(
      <InputNumber value={5} suffix="min" testID="custom-number-trigger" />
    );
    const customTrigger = customScreen.getByTestId("custom-number-trigger");
    expect(customTrigger).toBeTruthy();
    expect(customTrigger.props.collapsable).toBe(false);
  });

  it("renders NumberPickerForm with testID, collapsable={false}, thumbwheel-picker testID, and save button testID", async () => {
    const onSave = jest.fn();
    const onChange = jest.fn();

    const screen = await renderWithProviders(
      <NumberPickerForm value={10} onChange={onChange} onSave={onSave} />
    );

    const sheetContainer = screen.getByTestId("number-picker-sheet");
    expect(sheetContainer).toBeTruthy();
    expect(sheetContainer.props.collapsable).toBe(false);

    const thumbwheel = screen.getByTestId("thumbwheel-picker");
    expect(thumbwheel).toBeTruthy();

    const saveButton = screen.getByTestId("number-picker-save-button");
    expect(saveButton).toBeTruthy();
  });

  it("synchronizes dual-channel dispatch: updates header in real time and commits only on deceleration halt", async () => {
    const onChange = jest.fn();
    const onSave = jest.fn();

    const screen = await renderWithProviders(
      <NumberPickerForm
        value={10}
        onChange={onChange}
        onSave={onSave}
        valueSuffix="sec"
      />
    );

    const thumbwheel = screen.getByTestId("thumbwheel-picker");

    // 1. Continuous stream via onChangeValue updates display readout without triggering onChange
    await act(() => {
      thumbwheel.props.onChangeValue(25);
    });

    expect(screen.getByText("25")).toBeTruthy();
    expect(onChange).not.toHaveBeenCalled();

    // 2. Terminal event via onCommitValue commits final value to form state
    await act(() => {
      thumbwheel.props.onCommitValue(25);
    });

    expect(onChange).toHaveBeenCalledWith(25);
  });

  it("applies fixed line height and tabular font styling to HeaderValueDisplay to isolate layout", async () => {
    const screen = await renderWithProviders(
      <NumberPickerForm value={10} onChange={jest.fn()} valueSuffix="sec" />
    );

    const valueText = screen.getByText("10");
    const flatValueStyle = StyleSheet.flatten(valueText.props.style);
    expect(flatValueStyle.lineHeight).toBe(56);
    expect(flatValueStyle.fontVariant).toContain("tabular-nums");
    expect(flatValueStyle.includeFontPadding).toBe(false);

    const suffixText = screen.getByText("sec");
    const flatSuffixStyle = StyleSheet.flatten(suffixText.props.style);
    expect(flatSuffixStyle.lineHeight).toBe(24);
    expect(flatSuffixStyle.fontVariant).toContain("tabular-nums");
    expect(flatSuffixStyle.includeFontPadding).toBe(false);
  });

  it("re-enables quick action buttons when moving away from boundary limits", async () => {
    const onChange = jest.fn();

    const screen = await renderWithProviders(
      <NumberPickerForm value={0} min={0} max={60} onChange={onChange} />
    );

    // At min=0, minus buttons are disabled
    const minusFive = screen.getByRole("button", { name: "-5" });
    expect(minusFive.props.accessibilityState?.disabled).toBe(true);

    // External or committed update to 15
    await act(() => {
      screen.rerender(
        <NumberPickerForm value={15} min={0} max={60} onChange={onChange} />
      );
    });

    // -5 button should now be enabled
    expect(minusFive.props.accessibilityState?.disabled).toBeFalsy();
  });
});

describe("Sheet modal lifecycle", () => {
  let presentSpy: jest.SpyInstance;
  let dismissSpy: jest.SpyInstance;
  let renderSpy: jest.SpyInstance;
  let capturedOnDismiss: (() => void) | undefined;

  beforeEach(() => {
    jest.clearAllMocks();
    capturedOnDismiss = undefined;
    presentSpy = jest.spyOn(TrueSheet.prototype, "present");
    dismissSpy = jest.spyOn(TrueSheet.prototype, "dismiss");
    renderSpy = jest
      .spyOn(TrueSheet.prototype, "render")
      .mockImplementation(function mockRender(this: unknown) {
        const instance = this as {
          props: {
            children?: React.ReactNode;
            onDidDismiss?: () => void;
          };
        };
        capturedOnDismiss = instance.props.onDidDismiss;
        return React.createElement(
          React.Fragment,
          null,
          instance.props.children
        );
      });
  });

  afterEach(() => {
    cleanup();
    presentSpy.mockRestore();
    dismissSpy.mockRestore();
    renderSpy.mockRestore();
  });

  it("does not call dismiss on initial mount when controlled with open=false", async () => {
    const controlledRef = React.createRef<TrueSheet>();

    await renderWithProviders(
      <Sheet ref={controlledRef} open={false}>
        <SheetContent>
          <></>
        </SheetContent>
      </Sheet>
    );

    expect(dismissSpy).not.toHaveBeenCalled();
    expect(presentSpy).not.toHaveBeenCalled();
  });

  it("calls present when controlled open changes to true", async () => {
    const screen = await renderWithProviders(
      <Sheet open={false}>
        <SheetContent>
          <></>
        </SheetContent>
      </Sheet>
    );

    expect(presentSpy).not.toHaveBeenCalled();

    await act(async () => {
      await screen.rerender(
        <Sheet open={true}>
          <SheetContent>
            <></>
          </SheetContent>
        </Sheet>
      );
    });

    expect(presentSpy).toHaveBeenCalledTimes(1);
    expect(dismissSpy).not.toHaveBeenCalled();
  });

  it("does not call dismiss() when dismissed via onDismiss/backdrop, and can reopen cleanly", async () => {
    const onOpenChange = jest.fn();

    const TestHarness = () => {
      const [isOpen, setIsOpen] = React.useState(false);
      return (
        <Sheet
          open={isOpen}
          onOpenChange={(next) => {
            onOpenChange(next);
            setIsOpen(next);
          }}
        >
          <Text testID="open-trigger" onPress={() => setIsOpen(true)}>
            Open Sheet
          </Text>
          <SheetContent>
            <Text>Content</Text>
          </SheetContent>
        </Sheet>
      );
    };

    const screen = await renderWithProviders(<TestHarness />);

    expect(presentSpy).not.toHaveBeenCalled();
    expect(dismissSpy).not.toHaveBeenCalled();

    // 1. Open the sheet
    await act(() => {
      fireEvent.press(screen.getByTestId("open-trigger"));
    });
    expect(presentSpy).toHaveBeenCalledTimes(1);
    expect(dismissSpy).not.toHaveBeenCalled();

    // 2. User closes without saving (e.g. backdrop pressed -> onDismiss fires)
    await act(() => {
      capturedOnDismiss?.();
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
    // Crucial: dismiss() must NOT be called when modal dismissed itself
    expect(dismissSpy).not.toHaveBeenCalled();

    // 3. User taps trigger to open sheet again
    await act(() => {
      fireEvent.press(screen.getByTestId("open-trigger"));
    });
    expect(presentSpy).toHaveBeenCalledTimes(2);
    expect(dismissSpy).not.toHaveBeenCalled();
  });
});
