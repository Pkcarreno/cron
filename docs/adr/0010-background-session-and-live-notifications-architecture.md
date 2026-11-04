# ADR 0010: Background Session Architecture with Local Foreground Service, Hardware Chronometer, and Deterministic Milestone Scheduling

- **Status**: Accepted
- **Date**: November 2026
- **Context**: React Native 0.88.0, Expo SDK 58 (`58.0.16`), Expo Modules API, New Architecture (Hermes & TurboModules), `react-native-audio-api` (`0.13.6`), Android API 26–35 (Material 3), iOS ActivityKit-ready stub.

---

## 1. Problem Statement & Context

Athletes utilizing `cron` frequently background the application during active workouts to switch music tracks (e.g., in Spotify or Apple Music), adjust headphone settings, or lock their device.

The previous timer engine implementation exhibited the following limitations:

1. **Frozen Background Loop**: In [`helpers/timer/controller.ts`](file:///home/pk/.t3/worktrees/cron/t3-4b654639/helpers/timer/controller.ts), `handleAppStateChange('background')` triggered `engine.pauseLoop()`, suspending both `requestAnimationFrame` and interval timers. While `catchUp()` calculated the elapsed time upon re-entry, no intermediate audio beeps, phase transitions, or round changes were dispatched while backgrounded.
2. **`expo-keep-awake` Boundaries**: `expo-keep-awake` prevents screen sleep exclusively while the app is foregrounded. It has zero effect when the user minimizes the app or presses the physical lock button.
3. **Third-Party Dependency Risk**: Archival of Notifee by Invertase highlighted the fragility of relying on third-party notification wrappers across major React Native and Expo SDK upgrades. Furthermore, `expo-notifications` does not support Android Foreground Services, native hardware chronometers, or live dynamic countdowns.
4. **Media Player Widget Pollution**: Improper audio session declaration can trigger Android's `MediaSessionCompat` quick-settings playback card, confusing athletes by representing a fitness timer as a media player.

---

## 2. Decision & Architecture

We adopt a **Three-Tier Agnostic Background Architecture** anchored by a lightweight, repository-owned local Expo Module (`modules/cron-foreground-service`) and deterministic milestone scheduling.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        TIER 1: DRIVER INTERFACE                        │
│                                                                        │
│                      LiveActivityDriver (Contract)                     │
│                       ├── AndroidForegroundDriver                      │
│                       └── IosNoopLiveActivityDriver (Ready for Kit)    │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│                    TIER 2: LOCAL NATIVE EXPO MODULE                    │
│                                                                        │
│                     modules/cron-foreground-service                    │
│          • Standard Android NotificationCompat.Builder (Material 3)    │
│          • Native Hardware Chronometer (setUsesChronometer: true)      │
│          • Android Foreground Service (health/fitness/specialUse)      │
│          • BroadcastReceiver -> JNI Native EventEmitter -> Controller │
│          • Zero MediaSessionCompat (No media playback card)            │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│              TIER 3: DETERMINISTIC MILESTONE SCHEDULER                 │
│                                                                        │
│         • Target-based single-shot timers (no 1 Hz polling jitter)     │
│         • DAC Prewarm scheduled at T_phase_end - 1500ms                │
│         • 3-2-1 Beeps scheduled at T_phase_end - 3000ms                │
│         • Phase Transition & Notification Update at T_phase_end        │
│         • Immediate timer clearance and chronometer freeze on PAUSE    │
└────────────────────────────────────────────────────────────────────────┘
```

---

### 2.1. Local Expo Native Module (`modules/cron-foreground-service`)

Rather than adopting external forks with uncertain longevity, `cron` maintains its own lightweight native module (~120 lines of Kotlin) leveraging the standard **Expo Modules API** (`expo-modules-core`):

1. **`CronForegroundService.kt` (~80 lines)**:
   - Implements `android.app.Service`.
   - Binds to an Android notification channel (`IMPORTANCE_LOW` to eliminate intrusive update sounds).
   - Utilizes `NotificationCompat.Builder` adhering 100% to native Material 3 design without custom XML layouts (`RemoteViews`).
   - Enables hardware chronometer countdown via `setUsesChronometer(true)` and `setChronometerCountDown(true)`. The Android System UI manages sub-second clock drawing on the GPU with **0% JavaScript CPU usage**.
   - Invokes `startForeground(NOTIFICATION_ID, notification, FOREGROUND_SERVICE_TYPE_HEALTH)`.
2. **`CronForegroundModule.kt` (~40 lines)**:
   - Exposes `start(payload)`, `update(payload)`, and `stop()` to TypeScript.
   - Listens to notification action clicks via a `BroadcastReceiver` and emits `onNotificationAction` events to JavaScript.

---

### 2.2. Notification Design, Copy, and Contextual Actions

All notification text is strictly in English matching the application domain standard:

- **Small Icon**: Monochromatic silhouette of the `cron` emblem (required by Android notification spec).
- **Headline**: Phase and round progression:
  - Intervals / EMOM: `WORK — Round 3/8` or `REST — Round 3/8`.
  - AMRAP / Stopwatch: `AMRAP — Round 5` or `STOPWATCH — Lap 4`.
  - For Time: `FOR TIME — Cap 20:00`.
- **Subtitle**: Immediate next phase contextual information:
  - `Next: REST (30s)` or `Next: WORK (60s)`.
- **Chronometer Chip**: Hardware countdown ticking to the active block's completion timestamp.
- **Color Accent**: Dynamic theme color based on active phase (`#008153` for Work, `#E7801F` for Rest/Preparation).
- **Deep Link**: Tapping the notification body dispatches an Intent opening the active timer screen directly.
- **Contextual Actions (Clean text labels, no brackets)**:
  - Primary Action (All Modes): `Pause` (alternating to `Resume` when paused).
  - Secondary Action (Strictly `AMRAP` and `STOP_WATCH`): `Lap` or `Record Round` (records checkpoint identical to the UI double-tap gesture).
  - `EMOM`, `INTERVAL`, and `FOR_TIME` omit secondary skip/advance buttons to eliminate accidental pocket presses during strenuous exercise.

---

### 2.3. Deterministic Milestone Scheduling (Target-Based)

To guarantee that audio cues and phase transitions fire with microsecond precision in the background without burning battery through a 1 Hz polling loop:

1. **Elimination of Polling**: The engine computes exact wall-clock timestamps for upcoming events in the active phase:
   $$ \begin{aligned}
   T_{\text{prewarm}} &= T_{\text{phase\_end}} - 1500\,\text{ms} \\
   T_{\text{countdown}} &= T_{\text{phase\_end}} - 3000\,\text{ms} \\
   T_{\text{transition}} &= T_{\text{phase\_end}}
   \end{aligned}$$
   $$
2. **Scheduled Execution**:
   - At $T_{\text{prewarm}}$: Calls `feedbackService.warmUp()`, which eagerly wakes the hardware DAC and claims transient ducking focus via `react-native-audio-api`.
   - At $T_{\text{countdown}}$: Dispatches the canonical 3-2-1 countdown beeps onto `audioContext.currentTime`.
   - At $T_{\text{transition}}$: Executes strategy recalculation, emits `PHASE_CHANGE` / `ROUND_CHANGE`, plays the transition tone (`GO` / `REST`), and calls `driver.update()` with the next phase's metadata.

---

### 2.4. Pause / Resume State Synchronization

When paused from either the notification action or in-app:

1. **On Pause**:
   - All pending milestone timeouts (`prewarm`, `countdown`, `transition`) are immediately cancelled (`clearTimeout`).
   - The native notification chronometer is frozen (`setUsesChronometer(false)`) and updated to static text: `Paused at MM:SS`.
   - The notification action label flips from `Pause` to `Resume`.
2. **On Resume**:
   - The remaining duration of the interrupted phase is evaluated.
   - The new target timestamp is projected ($T_{\text{target}} = \text{Date.now()} + \text{remainingMs}$).
   - Milestone timeouts for the remainder of the phase are rescheduled.
   - The notification chronometer re-engages (`setUsesChronometer(true)` with the new end timestamp).

---

### 2.5. Audio Ducking & Music Interplay

- The audio session maintains `mixWithOthers` and `duckOthers`.
- External music volume (Spotify, Apple Music) is temporarily attenuated when a cue triggers.
- Following the final tone of a sequence, the acoustic drain window elapses (~200 ms) and audio focus is released immediately, restoring external music volume to 100% without prolonged pumping.
- The app explicitly refrains from registering any `MediaSessionCompat`, ensuring zero interference with system media controls.

---

### 2.6. Permission Fallback Strategy

If the athlete denies notification permissions (`POST_NOTIFICATIONS`):

1. **Automatic Background Pause**: When `AppState` transitions to `'background'` without notification permissions, the timer **pauses automatically** to prevent the session from elapsing unseen.
2. **In-App Guidance**: Upon returning to the app, the session remains paused and an informative banner is displayed:
   > _"Session paused because notifications are disabled. Enable notifications in Settings to allow background workout tracking."_
3. **Conditional Settings Toggle**: An advanced fallback toggle, _"Allow background audio-only session (without notifications)"_, is rendered in Settings **only if notification permissions are denied/blocked**, catering to athletes who strictly prefer audio cues without notifications.

---

### 2.7. Platform-Agnostic Driver Contract

The timer engine remains completely decoupled from platform implementations via `LiveActivityDriver`:

```typescript
export interface ActiveSessionPayload {
  mode: TimerMode;
  phase: TimerPhase;
  currentRound: number;
  totalRounds: number;
  phaseDurationMs: number;
  targetTimestampMs: number;
  isPaused: boolean;
}

export interface LiveActivityDriver {
  start(session: ActiveSessionPayload): Promise<void>;
  update(session: ActiveSessionPayload): Promise<void>;
  pause(elapsedDisplayTime: string): Promise<void>;
  resume(session: ActiveSessionPayload): Promise<void>;
  stop(): Promise<void>;
}
```

- **Android**: `AndroidForegroundDriver` integrates with `modules/cron-foreground-service`.
- **iOS**: `IosNoopLiveActivityDriver` provides a clean pass-through stub, ready for drop-in ActivityKit / Dynamic Island integration.
- **Single Source of Truth**: Action events received by the driver dispatch directly into [`TimerController`](file:///home/pk/.t3/worktrees/cron/t3-4b654639/helpers/timer/controller.ts).

---

## 3. Consequences

### Positive

- **Rock-Solid Reliability**: Native Foreground Service prevents Android from killing the timer under memory pressure.
- **True Real-Time Presentation**: Hardware chronometer updates continuously on the lock screen and notification shade with zero JavaScript duty cycle.
- **Microsecond Audio Precision**: Target-based scheduling eliminates 1 Hz polling jitter and preserves DAC pre-warming.
- **Zero Third-Party Dependency Risk**: Local Expo Module isolates `cron` from upstream library abandonment.
- **Zero Music Scrubber Pollution**: Workout cues duck Spotify cleanly without generating unwanted media player widgets.

### Negative / Trade-Offs

- Requires a one-time build step (`npx expo prebuild` / development build) to compile the local Kotlin module on Android.
