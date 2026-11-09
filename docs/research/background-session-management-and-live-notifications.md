# Technical Research: Background Session Management, Live Notifications, and Acoustic Feedback for HIIT Timers in React Native & Expo

**Date:** November 2026  
**Project Context:** Cron (Expo SDK 58 / React Native 0.88 / New Architecture / Hermes / `react-native-audio-api` 0.13.6 / Jotai 2.19 / MMKV)  
**Objective:** Design the background session architecture so that `cron` athletes receive real-time visual progress (live hardware chronometers) and microsecond-exact audio cues (pre-warming, 3-2-1 countdown beeps, phase changes) when navigating away from the app (e.g., switching Spotify playlists or locking the screen), overcoming iOS/Android lifecycle limits without battery drain.

---

## 1. Diagnosis: Root Cause of the Current Suspension

### 1.1. Current Engine State Flow

In [`helpers/timer/controller.ts`](file:///home/pk/.t3/worktrees/cron/t3-4b654639/helpers/timer/controller.ts) and [`helpers/timer/tick-engine.ts`](file:///home/pk/.t3/worktrees/cron/t3-4b654639/helpers/timer/tick-engine.ts):

```typescript
public handleAppStateChange(nextAppState: AppStateStatus): void {
  // ...
  if (wasActive && !isNowActive) {
    this.isVisualUpdatesPaused = true;
    this.engine.pauseLoop(); // Cancels both requestAnimationFrame and setInterval
  } else if (!wasActive && isNowActive) {
    this.isVisualUpdatesPaused = false;
    if (this.engine.getIsRunning()) {
      this.catchUp();        // Wall-clock jump
      if (!this.previousState?.isFinished) {
        this.engine.resumeLoop();
      }
    }
  }
}
```

When an athlete backgrounds the app:

1. `engine.pauseLoop()` completely halts all ticks.
2. The JavaScript thread sleeps; no intermediate audio beeps (`BEEP`), phase transitions (`PHASE_CHANGE`), or round changes are dispatched.
3. Upon foregrounding, `catchUp()` jumps forward to compute total elapsed time, but all training events that occurred during absence were lost.

### 1.2. The Limitations of `expo-keep-awake`

`expo-keep-awake` configures screen-on flags (`FLAG_KEEP_SCREEN_ON` on Android, `isIdleTimerDisabled` on iOS) **exclusively while the app window is visible in the foreground**. The moment the athlete switches apps or presses the physical power button, the operating system ignores keep-awake and suspends background execution.

---

## 2. Operating System Lifecycle & Platform Constraints

### 2.1. Android (AOSP / Linux Kernel)

1. **Background Execution Limits:** Android 8.0+ restricts arbitrary background services.
2. **Foreground Service Requirement:** To run continuously, user-facing background tasks must declare an ongoing `ForegroundService` with a non-dismissible notification (`ongoing: true`).
3. **Android 14+ (API 34+) Types:** Requires declaring `foregroundServiceType` (`health` / `specialUse`).
4. **Hardware Chronometer API:** `NotificationCompat.Builder` supports native chronometers (`setUsesChronometer(true)` and `setChronometerCountDown(true)`). Android's System UI renders the countdown on the GPU with **0% JavaScript CPU usage**.
5. **No Media Playback Pollution:** By avoiding `MediaSessionCompat`, the app never triggers an intrusive media scrubber card in quick settings.

### 2.2. iOS (Darwin Kernel / Cocoa Touch)

1. **Immediate JS Suspension:** iOS gives a ~5-second grace window before freezing the Hermes JavaScript thread.
2. **Audio Mode (`UIBackgroundModes: ["audio"]`):** Permits background audio execution if an active audio session is producing sound.
3. **ActivityKit (Live Activities & Dynamic Island):** The canonical iOS mechanism. The app provides a closed date range (`ClosedRange<Date>`); iOS WidgetKit renders the ticking timer on the lock screen and Dynamic Island without CPU wakeup.

---

## 3. Evaluated Notification Technologies

1. **`expo-notifications`:** Does not support Android Foreground Services, native hardware chronometers, or live updates. Strictly suited for static banners.
2. **`@notifee/react-native`:** Archived by Invertase; creates dependency vulnerabilities.
3. **`react-native-notify-kit`:** Community fork of Notifee, but carries long-term maintenance risks across React Native major upgrades.
4. **Local Native Expo Module (`modules/cron-foreground-service`) (Adopted):** A repository-owned Kotlin module (~120 lines total) using the official Expo Modules API. Guarantees 100% native Material 3 styling, hardware chronometer support, and complete immunity from third-party library obsolescence.

---

## 4. Multi-Tier Capability Architecture

To ensure a continuous experience across all platform tiers (formalized in ADR 0011):

- **Tier 1 — Promoted Live Notification (Primary):** On devices supporting status-bar chips / Live Updates (Android 16+ API 36+, iOS 16.1+ ActivityKit), displays a live pill in the status bar and an ongoing lock-screen countdown with action buttons (`Pause`/`Resume` and contextual `Lap`/`Record Round`).
- **Tier 2 — Standard Dynamic Notification (Android Default):** On devices without status-bar chip support (Android API 26–35), displays standard Material 3 notification cards with live ticking hardware chronometer (`setUsesChronometer(true)`) in the notification shade with 0% JS CPU duty cycle.
- **Tier 3 — Static Card Fallback:** On platforms without native notification chronometers (iOS without ActivityKit, or explicit suppression), displays standard notification cards updated discretely upon phase transitions (`PHASE_CHANGE`, `ROUND_CHANGE`, `PAUSE`) with static duration in headline.
- **Tier 4 — Auto-Pause Fallback (Permissions Denied):** Automatically pauses the workout upon backgrounding to prevent unguided time loss, showing an in-app banner upon return.

---

## 5. Deterministic Target-Based Milestone Scheduling

Eliminating background polling jitter:

- $T_{\text{prewarm}} = T_{\text{phase\_end}} - 1500\,\text{ms}$ -> Awakens native DAC (`warmUp()`) and claims transient ducking focus.
- $T_{\text{countdown}} = T_{\text{phase\_end}} - 3000\,\text{ms}$ -> Schedules 3-2-1 beeps onto hardware audio clock (`audioContext.currentTime`).
- $T_{\text{phase\_end}}$ -> Executes state transition and updates notification payload.
- Audio ducking releases ~200 ms after the cue finishes, restoring external music (Spotify) to 100% volume.
