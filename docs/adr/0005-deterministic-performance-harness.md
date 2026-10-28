# ADR 0005: Deterministic Performance Measurement Harness (Flashlight + Maestro)

- **Status**: Accepted
- **Date**: October 2026
- **Context**: React Native 0.88.0, Expo SDK 58 (`58.0.16`), New Architecture (Fabric), Reanimated 4 (`4.7.1`)

## Context

When optimizing high-frequency interactions (such as thumbwheel scrolling inside `TrueSheet`, tab transitions in `PagerView`, and active HIIT interval countdowns), developers and autonomous agents require objective, reproducible performance metrics.

Relying on development builds (`expo start`) produces invalid performance measurements because:

1. Metro bundling, JIT compilation, and React DevTools inject substantial runtime latency.
2. Hermes bytecode optimizations and R8 shrinking remain disabled in debug builds.
3. Thread attribution in Reanimated 4 executes animation worklets on the **UI Thread** (main thread), leaving `mqt_js` at near 0% utilization while the native thread saturates.
4. Hardware variance—such as adaptive display refresh rates (LTPO 1–120 Hz), Android JIT compilation jitter, thermal throttling, and background network traffic—causes wild measurement swings between consecutive runs.

## Decision

We adopt an automated, non-intrusive Performance Measurement Harness orchestrated with **Flashlight** and **Maestro** against production-optimized Android preview builds.

### 1. Tooling Architecture

- **Flashlight (`/bamlab/flashlight`)**: Deploys a lightweight native profiler (`BAMPerfProfiler`) to monitor `/proc/<PID>/stat` kernel counters and SurfaceFlinger metrics via ADB without adding native SDK dependencies to the application source code.
- **Maestro (`maestro.mobile.dev`)**: Drives deterministic, declarative interaction scenarios (`.maestro/perf/*.yaml`) via OS accessibility channels with percentage-based coordinates and fixed durations.
- **Expo Config Plugin (`plugins/with-profileable`)**: Injects `<profileable android:shell="true" />` into `AndroidManifest.xml` during preview builds (`EXPO_PUBLIC_APP_ENV=preview`). This grants ADB profiling access without setting `android:debuggable="true"`, ensuring R8 and Hermes optimizations remain intact.

### 2. Hardware Stabilization Protocol

To ensure benchmark reproducibility within a ±2% error margin, test execution enforces five stabilization gates prior to measurement:

1. **Display Refresh Rate Lock**: ADB locks system display refresh rates to a fixed frequency (60 Hz or 120 Hz) to eliminate LTPO scaling artifacts.
2. **ART Ahead-Of-Time (AOT) Speed Compilation**: Executes `cmd package compile -m speed -f <package>` to compile all bytecode into machine code, removing JIT compilation spikes.
3. **Network Isolation**: Toggles Android airplane mode (`cmd connectivity airplane-mode enable`) during profiling to block background sync and push notifications.
4. **Warmup Pass**: Executes an unmeasured initial run to warm filesystem caches, load dynamic `.so` libraries, and initialize JSI worklet runtimes.
5. **Thermal Dissipation Cooldown**: Enforces a 5–6 second rest delay between iterations to prevent SoC thermal throttling.

### 3. Soft Budget Gates and Governance

The comparison runner (`pnpm perf:compare`) evaluates baseline against candidate benchmark runs, printing an aligned terminal delta table and emitting warnings when soft budgets are violated:

| Metric | Budget Limit | Rationale |
| :-- | :-- | :-- |
| **Frame Time (120 Hz)** | $\le 8.33\text{ ms}$ | Prevents dropped frames on high-refresh-rate flagship displays. |
| **Frame Time (60 Hz)** | $\le 16.67\text{ ms}$ | Baseline standard Android refresh rate requirement. |
| **Jank Rate** | $\le 2.0\%$ | Flags stutter during continuous gestures or rapid interval transitions. |
| **JS Thread CPU** | $\le 15.0\%$ | Identifies unintended worklet leaks from the UI thread to Hermes. |

## Consequences

- **Positive**:
  - Provides autonomous agents with an automated, objective verification loop (`pnpm perf:doctor`, `pnpm perf:build`, `pnpm perf:measure`, `pnpm perf:compare`).
  - Zero intrusion into release production application bundles (`cron`).
  - Disentangles UI Thread vs. JS Thread CPU utilization for Reanimated 4 and Fabric architecture.
- **Negative**:
  - Requires a connected Android device or hardware-accelerated emulator configured with ADB.
  - Benchmarking runs require several minutes per scenario to complete statistical multi-iteration passes with warmup and cooldown intervals.
