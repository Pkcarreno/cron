# ADR 0011: Platform Capability Matrix and Four-Tier Notification Architecture

- **Status**: Accepted
- **Date**: November 2026
- **Context**: Amends ADR 0010. React Native 0.88.0, Expo SDK 58 (`58.0.16`), Android API 26–36 (Material 3), iOS ActivityKit-ready stub, `modules/cron-foreground-service`.

---

## 1. Problem Statement & Context

In ADR 0010 and Issue #120, a multi-tier fallback architecture was introduced to handle background workout tracking across varying device capabilities. However, the initial implementation conflated two orthogonal platform capabilities under a single boolean flag (`supportsLiveUpdates`):

1. **Native Notification Chronometer** (`NotificationCompat.Builder.setUsesChronometer(true)`):
   - Available natively in Android since API 11 / API 24 (`setChronometerCountDown`).
   - Supported across **100%** of `cron`'s Android target devices (minSdkVersion 26+).
   - Renders sub-second ticks in Android's notification shade via `SystemUI` on the GPU with **0% JavaScript CPU usage**.

2. **Promoted Live Updates / Status Bar Chip** (`android.requestPromotedOngoing`):
   - Introduced in Android 16 (API 36+) for persistent status bar pill presentation (conceptually analogous to iOS Dynamic Island / Live Activities).

Because `areLiveUpdatesSupported()` evaluated `Build.VERSION.SDK_INT >= 36`, all Android devices running Android 8.0 to Android 15 (API 26–35) were treated as "unsupported", falling back to "Tier 2" static notification cards. In Tier 2, the native chronometer was deliberately suppressed (`setUsesChronometer(false)`) and the phase duration was rendered as frozen text in the headline (e.g. `Round 1/8 | WORK (00:20)`), creating the false perception that the hardware chronometer was unsupported on those devices.

On iOS, standard notifications cannot run live chronometers without ActivityKit (iOS 16.1+), requiring a genuine static card fallback. Android, by contrast, has never had this limitation for notification shade displays.

---

## 2. Decision & Architecture

We supersede the 3-tier hierarchy of ADR 0010 with a decoupled **Four-Tier Platform Capability Architecture**:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                               FOUR-TIER HIERARCHY                                      │
├────────┬───────────────────────────────────┬───────────────────────────────────────────┤
│ Tier 1 │ Promoted / Dynamic Island         │ Android 16+ Promoted Ongoing Chip         │
│        │                                   │ iOS 16.1+ ActivityKit / Dynamic Island    │
├────────┼───────────────────────────────────┼───────────────────────────────────────────┤
│ Tier 2 │ Standard Dynamic Notification     │ Android API 26–35 (Default on Android)    │
│        │ (Native Hardware Chronometer)     │ • Clean headline (no static duration)     │
│        │                                   │ • setUsesChronometer(true) in shade       │
│        │                                   │ • Zero JavaScript CPU duty cycle          │
├────────┼───────────────────────────────────┼───────────────────────────────────────────┤
│ Tier 3 │ Static Card Fallback              │ iOS without ActivityKit (or explicit off) │
│        │ (Discrete State Updates)          │ • Headline with duration: "WORK (00:20)"  │
│        │                                   │ • setUsesChronometer(false)               │
├────────┼───────────────────────────────────┼───────────────────────────────────────────┤
│ Tier 4 │ Defensive Auto-Pause Guard        │ Notification permissions denied / blocked │
│        │ (Auto-Pause + Guidance Banner)    │ • Auto-pause on background transition     │
│        │                                   │ • In-app guidance banner + Audio-only opt │
└────────┴───────────────────────────────────┴───────────────────────────────────────────┘
```

---

### 2.1. Decoupled Capability Attributes

In [`modules/cron-foreground-service`](file:///home/pk/.t3/worktrees/cron/t3-c5c324ea/modules/cron-foreground-service) and [`helpers/background/live-activity-driver.ts`](file:///home/pk/.t3/worktrees/cron/t3-c5c324ea/helpers/background/live-activity-driver.ts), the payload contract decouples clock rendering from status bar promotion:

```typescript
export interface ForegroundNotificationPayload {
  headline: string;
  subtitle: string;
  subText?: string;
  color?: string;
  targetTimestampMs?: number;
  isPaused?: boolean;
  isCountDown?: boolean;
  secondaryLabel?: string;
  /** Whether the notification renders the real-time hardware chronometer widget (Tier 1 & Tier 2). */
  useChronometer?: boolean;
  /** Whether the platform supports promoted status bar chips (Tier 1, Android 16+ API 36+). */
  supportsLiveUpdates?: boolean;
}
```

1. **`useChronometer`**:
   - Defaults to `true` on Android for active sessions with `targetTimestampMs > 0`.
   - When `true`:
     - Renders clean headline via `formatHeadline(session)` without appending static duration strings.
     - Android `CronForegroundService` executes `builder.setUsesChronometer(true)` and `builder.setChronometerCountDown(isCountDown)`.
   - When `false` (Tier 3 fallback):
     - Renders static card headline via `formatStaticCardHeadline(session)` (e.g. `Round 1/8 | WORK (00:20)`).
     - Android `CronForegroundService` executes `builder.setUsesChronometer(false)`.

2. **`supportsLiveUpdates`**:
   - Evaluated by `areLiveUpdatesSupported()` (`Build.VERSION.SDK_INT >= 36`).
   - When `true`, requests promotion to the Android 16 status bar chip via `builder.extras.putBoolean("android.requestPromotedOngoing", true)`.
   - When `false`, standard ongoing notification presentation is used without status bar promotion.

---

### 2.2. Visual Presentation Matrix

| Tier | Platform / Context | Headline Format | Chronometer | Status Bar Chip | Subtitle |
| :-- | :-- | :-- | :-- | :-- | :-- |
| **Tier 1** | Android 16+ / iOS ActivityKit | `Round 1/8 \| WORK` | Live ticking (`true`) | Promoted Pill | `[Mode]. Next: REST (00:10)` |
| **Tier 2** | Android API 26–35 (Default) | `Round 1/8 \| WORK` | Live ticking (`true`) | Standard icon | `[Mode]. Next: REST (00:10)` |
| **Tier 3** | iOS without ActivityKit | `Round 1/8 \| WORK (00:20)` | Static (`false`) | None | `[Mode]. Next: REST (00:10)` |
| **Tier 4** | Permissions Denied | _(Session Auto-Paused)_ | N/A | None | In-app guidance banner |

---

### 2.3. Pause / Resume Synchronization

In both Tier 1 and Tier 2:

- **On Pause**:
  - The native notification chronometer is frozen (`setUsesChronometer(false)`).
  - Headline remains clean (`Round 1/8 \| WORK`).
  - Subtitle displays frozen point: `[Mode]. Paused at MM:SS`.
  - Notification action button flips from `Pause` to `Resume`.
- **On Resume**:
  - Target timestamp is recomputed ($T_{\text{target}} = \text{Date.now()} + \text{remainingMs}$).
  - Chronometer is re-engaged (`setUsesChronometer(true)`).
  - Action button flips back to `Pause`.

---

## 3. Consequences

### Positive

- **Instant Fix for Android Devices**: All Android users (API 26+) immediately receive live, real-time ticking countdowns in their notification shade with zero JavaScript battery impact.
- **Clean Separation of Concerns**: Decouples the Android 16 status bar chip capability from the universal notification chronometer capability.
- **Cross-Platform Readiness**: Preserves `formatStaticCardHeadline` as an explicit fallback for iOS standard notifications where native chronometers are unavailable.
- **Architectural Traceability**: Documents the technical justification for multi-tier fallbacks without erasing ADR 0010 history.

### Negative / Trade-Offs

- None. `NotificationCompat.Builder.setUsesChronometer` is backwards compatible to API 24+, fully covered within `cron`'s `minSdkVersion` 26.
