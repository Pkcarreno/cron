# Architecture Research: Deterministic Performance Measurement (Expo 58, Fabric, Flashlight, and Maestro)

- **Repository**: `cron`
- **Environment**: React Native 0.88.0, Expo SDK ~58.0.16, New Architecture (Fabric), React 19.3.0
- **Key Libraries**: `react-native-reanimated@4.7.1`, `@lodev09/react-native-true-sheet@^3.11.18`, `react-native-worklets@0.13.0`
- **Evaluation Tools**: Flashlight (`/bamlab/flashlight`), Maestro (`maestro.mobile.dev`), Android ADB / UIAutomator
- **Date**: October 2026
- **Status**: Approved / Test Architecture Specification

---

## 1. Executive Summary and Critical Findings

Research against primary sources (Flashlight `BAMPerfProfiler` source code, Android Developers documentation on `<profileable>`, and Fabric traces in React Native 0.88) validates the **Flashlight + Maestro** stack. The research identified **six critical technical pitfalls** that teams must mitigate to prevent biased measurements:

1. **Thread Attribution in Reanimated 4**: Animation worklets do not run on the JavaScript thread (`mqt_js`). They run on the **UI Thread** (main thread). Heavy animation load saturates the UI thread while `mqt_js` reports 0% CPU usage.
2. **Frame Budget and 120 Hz Displays**: Flashlight assumes a 60 Hz baseline (16.66 ms) by default. Displays with adaptive refresh rates (LTPO) introduce random measurement variance. Lock the display refresh rate to 60 Hz or 120 Hz with ADB before measurement.
3. **Requirement for `<profileable android:shell="true" />`**: On Android 10+ (API 29+), the operating system blocks native application traces and Simpleperf in release builds unless this tag exists in `AndroidManifest.xml`.
4. **Fabric View Flattening and `testID`**: Fabric removes structural native views. To ensure Maestro resolves a `testID` on a flat container, you must set `collapsable={false}`.
5. **Gesture Alignment in TrueSheet**: Gestures inside native modals require explicit relative coordinates and fixed durations. This prevents accidental dismissal of the backdrop sheet.
6. **Elimination of Android JIT Variance**: To prevent runtime compiler variance from the Just-In-Time (JIT) compiler, force Android Runtime (ART) Ahead-Of-Time (AOT) compilation (`cmd package compile -m speed`) before test execution.

---

## 2. Flashlight on Android with New Architecture

### 2.1 Thread Identification and Kernel Monitoring

Flashlight does not inject libraries into the application source code. It deploys a native C++ executable (`BAMPerfProfiler`) to `/data/local/tmp/` through ADB:

- It reads `/proc/<PID>/stat` and `/proc/<PID>/task/<TID>/stat` kernel files directly.
- It calculates the delta consumption $(\Delta \text{utime} + \Delta \text{stime}) / \Delta \text{total\_time}$ for each execution thread.
- In React Native 0.88 (Fabric), the Hermes execution thread keeps the native name `mqt_js` in `/proc/<PID>/task/<TID>/comm`.
- **Difference from Legacy Architecture**: The legacy `mqt_native_modules` thread does not exist in Fabric. TurboModule calls resolve synchronously in C++ or on auxiliary thread pools.

### 2.2 Manifest Requirement (`<profileable>`)

In release builds (`android:debuggable="false"`), Android security policies restrict `atrace` and Perfetto application-level traces. Declaring `<profileable android:shell="true" />`:

- Enables complete capture of native traces and performance counters by the ADB `shell` user.
- Preserves all production optimizations from R8, Hermes bytecode optimizations, and native C++ Release compilation.

---

## 3. Maestro in React Native Release and Fabric

### 3.1 Identifier Resolution and View Optimization

Maestro locates elements through the Android accessibility API (`AccessibilityNodeInfo`). In React Native:

- The `testID` property propagates as the accessible view identifier.
- Fabric C++ optimizers flatten (_view flattening_) any `<View>` that lacks visual styles or gesture detectors.
- **Mandatory test rule**: Every parent container referenced by `testID` in Maestro flows must include `collapsable={false}`.

### 3.2 Deterministic and Repeatable Gestures

Commands with generic directional gestures (`swipe: UP`) produce variable velocities across different devices. Flows in `.maestro/perf/` must use percentage coordinates and a fixed duration:

```yaml
- swipe:
    start: "50%, 75%"
    end: "50%, 35%"
    duration: 800
```

After each swipe interaction, include a settling delay. This delay gives Reanimated inertial decay algorithms enough time to reach rest.

---

## 4. Hardware Variance Mitigation Protocol

To ensure metrics between baseline and candidate versions are comparable within a ±2% error margin, the benchmark harness must execute the following phases:

1. **Warmup**: Execute an unmeasured initial run to preload native libraries (`.so`), compile worklet closures, and initialize JSI structures.
2. **ART AOT Compilation**:
   ```bash
   adb shell cmd package compile -m speed -f com.pkcarreno.cron.preview
   ```
3. **Display Refresh Rate Lock**:
   ```bash
   adb shell settings put system min_refresh_rate 60.0
   adb shell settings put system peak_refresh_rate 60.0
   ```
4. **Thermal and Network Isolation**:
   - Enable airplane mode (`adb shell cmd connectivity airplane-mode enable`).
   - Add a 5 to 6 second rest delay between iterations for thermal dissipation.
   - Keep device battery charge between 60% and 85% to prevent thermal throttling and battery saver limits.
5. **Statistical Sample**: Run a minimum of 10 iterations per test scenario. Report the median and 90th percentile (p90).

---

## 5. Technical Tool Comparison

| Dimension | Flashlight + Maestro | Android Jetpack Macrobenchmark | In-App Performance Marks |
| :-- | :-- | :-- | :-- |
| **Code Intrusion** | None (zero native code in `android/`) | High (requires `:benchmark` Gradle module) | Medium (manual markers in components) |
| **Expo Upgrade Resistance** | High (independent of SDK changes) | Low (fragile with AGP and Expo prebuild) | High |
| **Separate Thread Monitoring** | Yes (distinguishes `mqt_js` and UI Thread) | Not direct (requires Perfetto trace analysis) | No (only measures JS thread times) |
| **Frame Precision** | Based on SurfaceFlinger and atrace | Based on Perfetto kernel counters | Does not measure native frames |
| **E2E Automation** | Declarative YAML with Maestro | Kotlin code with UIAutomator | Requires custom test harness |

---

## 6. Cited Primary Sources

- [Flashlight Source & Architecture](https://github.com/bamlab/flashlight)
- [Flashlight Issue #349: 120 Hz Display Handling](https://github.com/bamlab/flashlight/issues/349)
- [Android Developers: Profileable Element Documentation](https://developer.android.com/guide/topics/manifest/profileable-element)
- [Android Developers: Android Runtime (ART) Compilation Options](https://source.android.com/docs/core/runtime/configure)
- [Maestro Documentation: Commands and Selectors](https://maestro.mobile.dev/)
- [React Native New Architecture: Fabric Renderer Invariants](https://reactnative.dev/docs/new-architecture-intro)
