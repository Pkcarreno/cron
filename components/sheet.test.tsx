import type {
  DetentChangeEvent,
  DidDismissEvent,
  DismissAttemptEvent,
  DragBeginEvent,
  DragChangeEvent,
  DragEndEvent,
  PositionChangeEvent,
  TrueSheetProps,
} from "@lodev09/react-native-true-sheet";
import { TrueSheet } from "@lodev09/react-native-true-sheet";
import { act, cleanup, fireEvent } from "@testing-library/react-native";
import React, { createRef, useState } from "react";
import { Text } from "react-native";

import { colors } from "@/helpers/colors";
import { renderWithProviders } from "@/test-utils/render-with-providers";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "./sheet";

const getLastTrueSheetProps = (): TrueSheetProps | undefined =>
  (TrueSheet as unknown as { lastProps: TrueSheetProps | undefined }).lastProps;

describe("Sheet component (TrueSheet v4)", () => {
  let presentSpy: jest.SpyInstance;
  let dismissSpy: jest.SpyInstance;
  let resizeSpy: jest.SpyInstance;
  let dismissStackSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    (
      TrueSheet as unknown as { lastProps: TrueSheetProps | undefined }
    ).lastProps = undefined;

    presentSpy = jest.spyOn(TrueSheet.prototype, "present");
    dismissSpy = jest.spyOn(TrueSheet.prototype, "dismiss");
    resizeSpy = jest.spyOn(TrueSheet.prototype, "resize");
    dismissStackSpy = jest.spyOn(TrueSheet.prototype, "dismissStack");
  });

  afterEach(() => {
    cleanup();
    presentSpy.mockRestore();
    dismissSpy.mockRestore();
    resizeSpy.mockRestore();
    dismissStackSpy.mockRestore();
  });

  describe("Detents configuration", () => {
    it("resolves to ['auto'] when enableDynamicSizing is true by default", async () => {
      await renderWithProviders(
        <Sheet open={false}>
          <SheetContent>
            <Text>Dynamic Content</Text>
          </SheetContent>
        </Sheet>
      );

      expect(getLastTrueSheetProps()?.detents).toEqual(["auto"]);
    });

    it("resolves to [0.5, 0.9] when enableDynamicSizing is false without explicit detents", async () => {
      await renderWithProviders(
        <Sheet open={false}>
          <SheetContent enableDynamicSizing={false}>
            <Text>Fixed Detents</Text>
          </SheetContent>
        </Sheet>
      );

      expect(getLastTrueSheetProps()?.detents).toEqual([0.5, 0.9]);
    });

    it("respects explicitly provided detents over dynamic sizing defaults", async () => {
      await renderWithProviders(
        <Sheet open={false}>
          <SheetContent detents={["auto", 0.6, 1]}>
            <Text>Multi-detent Content</Text>
          </SheetContent>
        </Sheet>
      );

      expect(getLastTrueSheetProps()?.detents).toEqual(["auto", 0.6, 1]);
    });
  });

  describe("Drag gestures and detent change events", () => {
    it("forwards drag and position event handlers to TrueSheet", async () => {
      const onDragBegin = jest.fn();
      const onDragChange = jest.fn();
      const onDragEnd = jest.fn();
      const onDetentChange = jest.fn();
      const onPositionChange = jest.fn();

      await renderWithProviders(
        <Sheet open={false}>
          <SheetContent
            onDragBegin={onDragBegin}
            onDragChange={onDragChange}
            onDragEnd={onDragEnd}
            onDetentChange={onDetentChange}
            onPositionChange={onPositionChange}
            draggable={true}
          >
            <Text>Interactive Content</Text>
          </SheetContent>
        </Sheet>
      );

      const props = getLastTrueSheetProps();
      expect(props?.draggable).toBe(true);

      const dummyDetentPayload = {
        detent: 0.5,
        index: 1,
        position: 300,
      };

      await act(() => {
        props?.onDragBegin?.({
          nativeEvent: dummyDetentPayload,
        } as DragBeginEvent);
        props?.onDragChange?.({
          nativeEvent: dummyDetentPayload,
        } as DragChangeEvent);
        props?.onDragEnd?.({
          nativeEvent: dummyDetentPayload,
        } as DragEndEvent);
        props?.onDetentChange?.({
          nativeEvent: dummyDetentPayload,
        } as DetentChangeEvent);
        props?.onPositionChange?.({
          nativeEvent: { ...dummyDetentPayload, realtime: true },
        } as PositionChangeEvent);
      });

      expect(onDragBegin).toHaveBeenCalledTimes(1);
      expect(onDragChange).toHaveBeenCalledTimes(1);
      expect(onDragEnd).toHaveBeenCalledTimes(1);
      expect(onDetentChange).toHaveBeenCalledTimes(1);
      expect(onPositionChange).toHaveBeenCalledTimes(1);
    });
  });

  describe("Dismiss behaviors and events", () => {
    it("handles onDidDismiss and triggers onDismiss and onOpenChange", async () => {
      const onDismiss = jest.fn();
      const onDidDismiss = jest.fn();
      const onOpenChange = jest.fn();

      const Harness = () => {
        const [isOpen, setIsOpen] = useState(false);
        return (
          <Sheet
            open={isOpen}
            onOpenChange={(next) => {
              onOpenChange(next);
              setIsOpen(next);
            }}
          >
            <SheetTrigger asChild>
              {({ onPress }) => (
                <Text testID="trigger" onPress={onPress}>
                  Open
                </Text>
              )}
            </SheetTrigger>
            <SheetContent onDismiss={onDismiss} onDidDismiss={onDidDismiss}>
              <Text>Dismissible Content</Text>
            </SheetContent>
          </Sheet>
        );
      };

      const screen = await renderWithProviders(<Harness />);

      await act(() => {
        fireEvent.press(screen.getByTestId("trigger"));
      });

      expect(onOpenChange).toHaveBeenCalledWith(true);

      await act(() => {
        getLastTrueSheetProps()?.onDidDismiss?.({
          nativeEvent: null,
        } as DidDismissEvent);
      });

      expect(onDismiss).toHaveBeenCalledTimes(1);
      expect(onDidDismiss).toHaveBeenCalledTimes(1);
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it("passes dismissible and onDismissAttempt props to TrueSheet", async () => {
      const onDismissAttempt = jest.fn();

      await renderWithProviders(
        <Sheet open={false}>
          <SheetContent dismissible={false} onDismissAttempt={onDismissAttempt}>
            <Text>Locked Sheet</Text>
          </SheetContent>
        </Sheet>
      );

      const props = getLastTrueSheetProps();
      expect(props?.dismissible).toBe(false);

      await act(() => {
        props?.onDismissAttempt?.({
          nativeEvent: null,
        } as unknown as DismissAttemptEvent);
      });

      expect(onDismissAttempt).toHaveBeenCalledTimes(1);
    });
  });

  describe("Imperative handles and refs", () => {
    it("exposes TrueSheet methods via Sheet ref and SheetContent ref", async () => {
      const sheetRef = createRef<TrueSheet>();
      const contentRef = createRef<TrueSheet>();

      await renderWithProviders(
        <Sheet ref={sheetRef} open={false}>
          <SheetContent ref={contentRef}>
            <Text>Ref Content</Text>
          </SheetContent>
        </Sheet>
      );

      expect(sheetRef.current).toBeTruthy();
      expect(contentRef.current).toBeTruthy();

      await act(async () => {
        await sheetRef.current?.present();
        await sheetRef.current?.resize(1);
        await sheetRef.current?.dismissStack();
        await sheetRef.current?.dismiss();
      });

      expect(presentSpy).toHaveBeenCalledTimes(1);
      expect(resizeSpy).toHaveBeenCalledTimes(1);
      expect(dismissStackSpy).toHaveBeenCalledTimes(1);
      expect(dismissSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("Trigger and Subcomponents", () => {
    it("toggles open state via SheetTrigger and render-prop trigger", async () => {
      const onOpenChange = jest.fn();

      const screen = await renderWithProviders(
        <Sheet onOpenChange={onOpenChange}>
          <SheetTrigger asChild>
            {({ onPress }) => (
              <Text testID="custom-trigger" onPress={onPress}>
                Open
              </Text>
            )}
          </SheetTrigger>
          <SheetContent>
            <SheetHeader testID="sheet-header">
              <SheetTitle>
                <Text>Sheet Title</Text>
              </SheetTitle>
              <SheetDescription>
                <Text>Sheet Subtitle</Text>
              </SheetDescription>
            </SheetHeader>
            <Text>Body</Text>
            <SheetFooter testID="sheet-footer">
              <Text>Footer Action</Text>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      );

      await act(() => {
        fireEvent.press(screen.getByTestId("custom-trigger"));
      });

      expect(onOpenChange).toHaveBeenCalledWith(true);
      expect(presentSpy).toHaveBeenCalledTimes(1);
      expect(screen.getByText("Sheet Title")).toBeTruthy();
      expect(screen.getByText("Sheet Subtitle")).toBeTruthy();
      expect(screen.getByTestId("sheet-header")).toBeTruthy();
      expect(screen.getByTestId("sheet-footer")).toBeTruthy();
    });

    it("applies default visual props (cornerRadius, grabber, grabberOptions, backgroundColor)", async () => {
      await renderWithProviders(
        <Sheet open={false}>
          <SheetContent
            cornerRadius={32}
            backgroundColor="#111111"
            grabberOptions={{ height: 6 }}
          >
            <Text>Styled Sheet</Text>
          </SheetContent>
        </Sheet>
      );

      const props = getLastTrueSheetProps();
      expect(props?.cornerRadius).toBe(32);
      expect(props?.backgroundColor).toBe("#111111");
      expect(props?.grabber).toBe(true);
      expect(props?.grabberOptions).toEqual({
        color: colors.neutral[600],
        height: 6,
      });
    });
  });
});
