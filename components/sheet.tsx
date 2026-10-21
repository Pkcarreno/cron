import type { SheetDetent } from "@lodev09/react-native-true-sheet";
import { TrueSheet } from "@lodev09/react-native-true-sheet";
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

import { colors } from "@/helpers/colors";

import { Text } from "./text";

interface SheetContextType {
  handleDismissed: () => void;
  open: boolean;
  setOpen: (open: boolean) => void;
  sheetRef: React.RefObject<TrueSheet | null>;
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
  ref?: React.Ref<TrueSheet>;
}

export const Sheet: React.FC<SheetProps> = ({
  children,
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  ref,
}) => {
  const sheetRef = useRef<TrueSheet>(null);
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;
  const prevOpenRef = useRef<boolean>(defaultOpen);
  const isInternalDismissRef = useRef<boolean>(false);

  useImperativeHandle(ref, () => sheetRef.current as TrueSheet, []);

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
      sheetRef.current?.present();
    } else if (wasOpen && !open) {
      if (isInternalDismissRef.current) {
        isInternalDismissRef.current = false;
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

export interface SheetContentProps extends Omit<ViewProps, "ref"> {
  children: React.ReactNode;
  detents?: SheetDetent[];
  enableDynamicSizing?: boolean;
  onDismiss?: () => void;
  ref?: React.Ref<TrueSheet>;
}

export const SheetContent: React.FC<SheetContentProps> = ({
  children,
  detents,
  enableDynamicSizing = true,
  onDismiss,
  ref,
  style,
  ...props
}) => {
  const { sheetRef, handleDismissed } = useSheetContext();

  const resolvedDetents = useMemo(() => {
    if (detents !== undefined) {
      return detents;
    }
    if (enableDynamicSizing) {
      return ["auto"] as SheetDetent[];
    }
    return [0.5, 0.9] as SheetDetent[];
  }, [detents, enableDynamicSizing]);

  useEffect(() => {
    if (!ref) {
      return;
    }
    if (typeof ref === "function") {
      ref(sheetRef.current);
    } else {
      (ref as React.RefObject<TrueSheet | null>).current = sheetRef.current;
    }
  }, [ref, sheetRef]);

  const handleDidDismiss = useCallback(() => {
    handleDismissed();
    if (onDismiss) {
      onDismiss();
    }
  }, [handleDismissed, onDismiss]);

  return (
    <TrueSheet
      ref={sheetRef}
      detents={resolvedDetents}
      cornerRadius={24}
      backgroundColor={colors.neutral[800]}
      grabber={true}
      grabberOptions={{
        color: colors.neutral[600],
      }}
      onDidDismiss={handleDidDismiss}
      {...props}
    >
      <View style={[styles.contentContainer, style]}>{children}</View>
    </TrueSheet>
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
  contentContainer: {
    gap: 16,
    paddingBottom: 24,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  description: {},
  footer: {
    flexDirection: "row",
    gap: 12,
    justifyContent: "flex-end",
  },
  header: {
    gap: 4,
    marginBottom: 8,
  },
  title: {},
});
