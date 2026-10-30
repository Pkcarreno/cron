import { useAtomValue } from "jotai";
import type { FC, ReactNode } from "react";

import { PressableArea } from "@/components/pressable-area";
import { timerFlagsAtom } from "@/screens/timer/atoms";
import { useTimerContext } from "@/screens/timer/context";

export interface TimerGestureOverlayProps {
  children: ReactNode;
  deadZone?: number;
  onDoublePress?: () => void;
  onLongPress?: () => void;
  onPress?: () => void;
}

export const TimerGestureOverlay: FC<TimerGestureOverlayProps> = ({
  children,
  deadZone = 14,
  onDoublePress,
  onLongPress,
  onPress,
}) => {
  const flags = useAtomValue(timerFlagsAtom);
  const actions = useTimerContext();

  const handleDoublePress =
    onDoublePress ??
    (flags.hasCheckpointsBehavior ? actions.recordCheckpoint : undefined);

  const handleLongPress = onLongPress ?? actions.pause;

  return (
    <PressableArea
      deadZone={deadZone}
      onDoublePress={handleDoublePress}
      onLongPress={handleLongPress}
      onPress={onPress}
    >
      {children}
    </PressableArea>
  );
};
