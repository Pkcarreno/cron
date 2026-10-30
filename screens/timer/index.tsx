import type { FC } from "react";

import { LocalClock } from "./components/local-clock";
import { OledBurnInProtector } from "./components/oled-burn-in-protector";
import { SummaryFace } from "./components/summary-face";
import {
  TimerContextBanner,
  TimerDisplay,
  TimerMinutes,
  TimerQuickAccess,
  TimerSeconds,
} from "./components/timer-display";
import { TimerGestureOverlay } from "./components/timer-gesture-overlay";
import { TimerHeader } from "./components/timer-header";
import type { TimerRootProps } from "./components/timer-root";
import { TimerRoot } from "./components/timer-root";

const TimerScreen: FC<TimerRootProps> = (props) => <TimerRoot {...props} />;

export const Timer = Object.assign(TimerScreen, {
  ContextBanner: TimerContextBanner,
  Display: TimerDisplay,
  GestureOverlay: TimerGestureOverlay,
  Header: TimerHeader,
  LocalClock,
  Minutes: TimerMinutes,
  OledBurnInProtector,
  QuickAccess: TimerQuickAccess,
  Root: TimerRoot,
  Seconds: TimerSeconds,
  Summary: SummaryFace,
});

export type { TimerRootProps } from "./components/timer-root";
export type { TimerHeaderProps } from "./components/timer-header";
export type { TimerDisplayProps } from "./components/timer-display";
export type { TimerGestureOverlayProps } from "./components/timer-gesture-overlay";
export type { LocalClockProps } from "./components/local-clock";
