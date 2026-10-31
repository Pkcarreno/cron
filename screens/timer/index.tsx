import { LocalClock } from "./components/local-clock";
import { OledBurnInProtector } from "./components/oled-burn-in-protector";
import { SummaryFace } from "./components/summary-face";
import { ContextBannerSvg } from "./components/svg/context-banner-svg";
import { MinutesSvg } from "./components/svg/minutes-svg";
import { SecondsSvg } from "./components/svg/seconds-svg";
import {
  TimerContextBanner,
  TimerDisplay,
  TimerMinutes,
  TimerQuickAccess,
  TimerSeconds,
} from "./components/timer-display";
import { TimerGestureOverlay } from "./components/timer-gesture-overlay";
import { TimerHeader } from "./components/timer-header";
import { TimerRoot } from "./components/timer-root";

export const Timer = Object.assign(TimerRoot, {
  ContextBanner: TimerContextBanner,
  ContextBannerSvg,
  Display: TimerDisplay,
  GestureOverlay: TimerGestureOverlay,
  Header: TimerHeader,
  LocalClock,
  Minutes: TimerMinutes,
  MinutesSvg,
  OledBurnInProtector,
  QuickAccess: TimerQuickAccess,
  Root: TimerRoot,
  Seconds: TimerSeconds,
  SecondsSvg,
  Summary: SummaryFace,
});

export type { TimerRootProps } from "./components/timer-root";
export type { TimerHeaderProps } from "./components/timer-header";
export type { TimerDisplayProps } from "./components/timer-display";
export type { TimerGestureOverlayProps } from "./components/timer-gesture-overlay";
export type { LocalClockProps } from "./components/local-clock";
