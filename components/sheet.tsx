import type {
  BottomSheetModalProps,
  BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import {
  BottomSheetModal,
  BottomSheetView,
  BottomSheetBackdrop,
} from "@gorhom/bottom-sheet";
import React, {
  createContext,
  useContext,
  useRef,
  useCallback,
  useEffect,
  useState,
  useImperativeHandle,
  useMemo,
} from "react";
import type {
  PressableProps,
  ViewProps,
  TextProps,
  GestureResponderEvent,
} from "react-native";
import { Pressable, View, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors } from "@/helpers/colors";

import { Text } from "./text";

interface SheetContextType {
  handleDismissed: () => void;
  open: boolean;
  setOpen: (open: boolean) => void;
  sheetRef: React.RefObject<BottomSheetModal | null>;
}

const SheetContext = createContext<SheetContextType | null>(null);

const useSheetContext = () => {
  const context = useContext(SheetContext);
  if (!context) {
    throw new Error("Sheet components must be used within a <Sheet>");
  }
  return context;
};

export interface SheetProps {
  children: React.ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  ref?: React.Ref<BottomSheetModal>;
}

export const Sheet: React.FC<SheetProps> = ({
  children,
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  ref,
}) => {
  const sheetRef = useRef<BottomSheetModal>(null);
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;
  const prevOpenRef = useRef<boolean>(defaultOpen);
  const isInternalDismissRef = useRef<boolean>(false);

  useImperativeHandle(ref, () => sheetRef.current as BottomSheetModal, []);

  const handleSetOpen = useCallback(
    (newOpen: boolean) => {
      if (!isControlled) {
        setUncontrolledOpen(newOpen);
      }
      onOpenChange?.(newOpen);
    },
    [isControlled, onOpenChange]
  );

  const handleDismissed = useCallback(() => {
    isInternalDismissRef.current = true;
    if (!isControlled) {
      setUncontrolledOpen(false);
    }
    onOpenChange?.(false);
  }, [isControlled, onOpenChange]);

  useEffect(() => {
    const wasOpen = prevOpenRef.current;
    prevOpenRef.current = open;

    if (!wasOpen && open) {
      isInternalDismissRef.current = false;
      const currentStatus = (
        sheetRef.current as unknown as { status?: { current: number } }
      )?.status?.current;
      // Do not present if already presented (1) or animating (5)
      if (currentStatus !== 1 && currentStatus !== 5) {
        sheetRef.current?.present();
      }
    } else if (wasOpen && !open) {
      if (isInternalDismissRef.current) {
        isInternalDismissRef.current = false;
        return;
      }
      const currentStatus = (
        sheetRef.current as unknown as { status?: { current: number } }
      )?.status?.current;
      // Do not dismiss if already INITIAL (0), CLOSED (2), DISMISSING (6), or DISMISSED (7)
      if (
        currentStatus !== undefined &&
        (currentStatus === 0 ||
          currentStatus === 2 ||
          currentStatus === 6 ||
          currentStatus === 7)
      ) {
        return;
      }
      sheetRef.current?.dismiss();
    }
  }, [open]);

  const value = useMemo(
    () => ({
      handleDismissed,
      open,
      setOpen: handleSetOpen,
      sheetRef,
    }),
    [handleDismissed, open, handleSetOpen, sheetRef]
  );

  return (
    <SheetContext.Provider value={value}>{children}</SheetContext.Provider>
  );
};

export type TriggerRenderProp = (props: {
  onPress: (e: GestureResponderEvent) => void;
}) => React.ReactNode;

export type SheetTriggerProps = Omit<PressableProps, "children"> &
  (
    | {
        asChild?: false | undefined;
        children: React.ReactNode;
      }
    | {
        asChild: true;
        children: TriggerRenderProp;
      }
  );

export const SheetTrigger: React.FC<SheetTriggerProps> = ({
  children,
  asChild,
  onPress,
  ...props
}) => {
  const { setOpen } = useSheetContext();

  const handlePress = useCallback(
    (e: GestureResponderEvent) => {
      setOpen(true);
      if (onPress) {
        onPress(e);
      }
    },
    [setOpen, onPress]
  );

  if (asChild && typeof children === "function") {
    return children({ ...props, onPress: handlePress });
  }

  return (
    <Pressable onPress={handlePress} {...props}>
      {children as React.ReactNode}
    </Pressable>
  );
};

export const SheetBackdrop: React.FC<BottomSheetBackdropProps> = (props) => (
  <BottomSheetBackdrop
    {...props}
    appearsOnIndex={0}
    disappearsOnIndex={-1}
    pressBehavior="close"
  />
);

export interface SheetContentProps extends Omit<BottomSheetModalProps, "ref"> {
  children: React.ReactNode;
  ref?: React.Ref<BottomSheetModal>;
}

export const SheetContent: React.FC<SheetContentProps> = ({
  children,
  onChange,
  onDismiss,
  snapPoints,
  enableDynamicSizing,
  backdropComponent = SheetBackdrop,
  ref,
  ...props
}) => {
  const { sheetRef, handleDismissed } = useSheetContext();
  const { bottom } = useSafeAreaInsets();

  const resolvedSnapPoints = useMemo(() => {
    if (snapPoints !== undefined) {
      return snapPoints;
    }
    if (enableDynamicSizing) {
      return;
    }
    return ["50%", "90%"];
  }, [snapPoints, enableDynamicSizing]);

  useEffect(() => {
    if (!ref) {
      return;
    }
    if (typeof ref === "function") {
      ref(sheetRef.current);
    } else {
      (ref as React.RefObject<BottomSheetModal | null>).current =
        sheetRef.current;
    }
  }, [ref, sheetRef]);

  const handleChange = useCallback(
    (...args: Parameters<NonNullable<BottomSheetModalProps["onChange"]>>) => {
      const [index] = args;
      if (index === -1) {
        handleDismissed();
      }
      if (onChange) {
        onChange(...args);
      }
    },
    [onChange, handleDismissed]
  );

  const handleDismiss = useCallback(() => {
    handleDismissed();
    if (onDismiss) {
      onDismiss();
    }
  }, [handleDismissed, onDismiss]);

  const bottomSheetViewStyles = useMemo(
    () => ({
      paddingBottom: bottom + 16,
    }),
    [bottom]
  );

  return (
    <BottomSheetModal
      {...props}
      enableDynamicSizing={enableDynamicSizing}
      ref={sheetRef}
      snapPoints={resolvedSnapPoints}
      backdropComponent={backdropComponent}
      onChange={handleChange}
      onDismiss={handleDismiss}
      backgroundStyle={styles.background}
      handleIndicatorStyle={styles.indicator}
    >
      <BottomSheetView style={[styles.contentContainer, bottomSheetViewStyles]}>
        {children}
      </BottomSheetView>
    </BottomSheetModal>
  );
};

export const SheetHeader: React.FC<ViewProps> = ({ style, ...props }) => (
  <View style={[styles.header, style]} {...props} />
);

export const SheetTitle: React.FC<TextProps> = ({ style, ...props }) => (
  <Text
    colorSubtone="200"
    size={18}
    weight="700"
    style={[styles.title, style]}
    {...props}
  />
);

export const SheetDescription: React.FC<TextProps> = ({ style, ...props }) => (
  <Text colorSubtone="400" style={[styles.description, style]} {...props} />
);

export const SheetFooter: React.FC<ViewProps> = ({ style, ...props }) => (
  <View style={[styles.footer, style]} {...props} />
);

const styles = StyleSheet.create({
  background: {
    backgroundColor: colors.neutral[800],
    borderRadius: 24,
  },
  contentContainer: {
    gap: 16,
    paddingHorizontal: 20,
  },
  description: {},
  footer: {
    flexDirection: "row",
    gap: 12,
    justifyContent: "flex-end",
  },
  header: {
    gap: 8,
  },
  indicator: {
    backgroundColor: colors.neutral[400],
  },
  title: {
    fontFamily: "Geist",
  },
});
