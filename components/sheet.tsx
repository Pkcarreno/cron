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
  sheetRef: React.RefObject<BottomSheetModal | null>;
  open: boolean;
  setOpen: (open: boolean) => void;
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

  useImperativeHandle(ref, () => sheetRef.current as BottomSheetModal, []);

  const handleSetOpen = useCallback(
    (newOpen: boolean) => {
      if (!isControlled) {
        setUncontrolledOpen(newOpen);
      }
      onOpenChange?.(newOpen);

      if (newOpen) {
        sheetRef.current?.present();
      } else {
        sheetRef.current?.dismiss();
      }
    },
    [isControlled, onOpenChange]
  );

  useEffect(() => {
    if (!isControlled) {
      return;
    }

    const wasOpen = prevOpenRef.current;
    prevOpenRef.current = controlledOpen;

    if (!wasOpen && controlledOpen) {
      sheetRef.current?.present();
    } else if (wasOpen && !controlledOpen) {
      sheetRef.current?.dismiss();
    }
  }, [controlledOpen, isControlled]);

  const value = useMemo(
    () => ({
      open,
      setOpen: handleSetOpen,
      sheetRef,
    }),
    [open, handleSetOpen, sheetRef]
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
  snapPoints,
  enableDynamicSizing,
  backdropComponent = SheetBackdrop,
  ref,
  ...props
}) => {
  const { sheetRef, setOpen } = useSheetContext();
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
        setOpen(false);
      }
      if (onChange) {
        onChange(...args);
      }
    },
    [onChange, setOpen]
  );

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
