# Domain Glossary: cron

Canonical vocabulary for the `cron` high-intensity interval training (HIIT) timer application. When naming concepts in code, tests, issues, PRs, or architecture documents, use these terms verbatim.

---

## 1. Timer Modes (`TimerMode`)

- **AMRAP** (_As Many Rounds As Possible_): A fixed-duration countdown where the athlete attempts to complete as many exercise rounds as possible. Checkpoints increment completed rounds.
- **FOR_TIME**: An open countdown/count-up bounded by a maximum timecap. Ends when the athlete completes the prescribed work or reaches the timecap.
- **EMOM** (_Every Minute On The Minute / Round Timer_): A fixed-round cadence where each round lasts a set duration (`roundDurationMs`). Signals round transitions automatically.
- **INTERVAL**: Alternating cycles of active `WORK` and recovery `REST` phases across a set number of rounds.
- **STOP_WATCH**: Open-ended elapsed time measurement without timecap, allowing lap/checkpoint logging.

---

## 2. Timer Phases (`TimerPhase`)

- **PREPARATION**: Buffer phase (countdown) before workout start, giving the athlete time to get into position.
- **WORK**: Active exercise phase during an interval or workout.
- **REST**: Recovery period between work intervals.
- **DONE**: Terminal state indicating the workout or timecap has finished.

---

## 3. Session & Tracking

- **Checkpoint** (`CheckpointData`): A discrete timestamped lap or round marker logged by user interaction (e.g. double-tap) during `AMRAP` or `STOP_WATCH`. Holds `lap`, `elapsedTimeMs`, `lapDurationMs`, and `lapDeltaMs`.
- **Session Summary** (`SessionSummary`): The terminal record of a workout session, containing total elapsed time, active workout time, completed rounds, completion status, and logged checkpoints.
- **Timecap**: Maximum permissible duration for a `FOR_TIME` workout.

---

## 4. Engine Architecture (`helpers/timer/`)

- **Tick Engine** (`TickEngine`): Low-level, high-precision delta time accumulator decoupled from React rendering. Emits millisecond deltas using monotonic timestamps.
- **Timer Controller** (`TimerController`): The stateful coordinator managing lifecycle (`START`, `PAUSE`, `RESET`, `FINISH`), event dispatching, audio beeps, and session summaries.
- **Timer Strategy** (`TimerStrategy`): Deterministic, pure state calculation interface. Given a `TickEvent`, returns the current `TimerState` (`displayTimeMs`, `currentRound`, `totalRounds`, `phase`, `isFinished`).
  - `DownStrategy`: Decrements remaining duration to zero.
  - `UpStrategy`: Increments elapsed time up to timecap.
  - `RoundStrategy`: Computes current round and intra-round countdown for fixed round durations.
  - `IntervalStrategy`: Alternates between `WORK` and `REST` phases based on interval durations.
  - `StopwatchStrategy`: Accumulates unbounded elapsed time.

---

## 5. Performance & Benchmarking

- **Performance Harness**: Automated test coordinator (Maestro + Flashlight) executing reproducible user interaction scenarios against production-configured APKs without developer runtime overhead.
- **Performance Baseline**: Immutable reference benchmark capture (metrics artifact) against which candidate branches and pull requests are compared.
- **Frame Budget**: Target execution window per frame required to preserve hardware refresh cadence (8.33 ms for 120 Hz displays; 16.67 ms for 60 Hz displays).
- **Jank Rate**: Percentage of rendered frames that exceed the target frame budget or skip Choreographer / CADisplayLink ticks.
- **Thread Affinity**: Runtime isolation of execution between the Hermes JavaScript thread and the native UI / Render / Worklet thread, verifying zero non-essential work leaks to JS during active gestures.
- **Profileable Build**: Production binary containing `<profileable android:shell="true" />` that permits non-invasive kernel and hardware tracing through ADB without disabling AOT or compiler optimizations.
- **ART Speed Compilation**: Ahead-Of-Time dex-to-native machine code optimization pass (`cmd package compile -m speed`) executed before benchmarking to eliminate Android JIT compilation jitter.
