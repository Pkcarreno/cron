# ADR 0007: Low-Latency Audio Buffer Playback Engine with Ducking and Hardware Scheduling

- **Status**: Accepted
- **Date**: October 2026
- **Context**: React Native 0.88.0, Expo SDK 58 (`58.0.16`), New Architecture (Fabric & TurboModules), React 19 (`19.3.0`), `react-native-audio-api` (`0.13.6`), CoreAudio (iOS), AAudio/Oboe (Android)

## Context

Athletes utilizing `cron` in loud gym environments (CrossFit boxes, track workouts, HIIT training) rely on clear acoustic cues for pacing and interval transitions. The initial audio implementation (`WebAudioOscillatorService`) synthesized basic waveforms via `OscillatorNode` connected directly to `audioContext.destination`, with cadence coordinated via JavaScript `setTimeout` promises.

This architecture presented three fundamental points of failure:

1. **Timing Drift & Rhythmic Jitter**: JavaScript `setTimeout` and Promise delays run on the Hermes event loop, competing with React re-renders, layout recalculations, and Garbage Collection pauses. In benchmark testing, interval silences drifted by 20–150 ms, making countdown cadences feel arrhythmic.
2. **Spectral Splatter & Timbral Inconsistency**: Abrupt oscillator starts/stops without amplitude envelopes caused DC step discontinuities, resulting in harsh, random clicks and pops that altered the perceived pitch and timbre on every trigger.
3. **Ducking & Silent Switch Non-Compliance**: Without explicit system audio session configuration (`AudioManager`), timer sounds were silenced when the device's physical mute switch was enabled and could not duck external audio players (e.g., Spotify or Apple Music).

## Decision

We replace real-time synthetic oscillators with an in-memory **AudioBufferSourceNode Playback Engine** (`AudioBufferPlaybackEngine`) leveraging `react-native-audio-api`:

### 1. Pre-Decoded Float32 In-Memory PCM Buffers

- The engine pre-loads and decodes the 5 canonical 16-bit Mono PCM WAV assets (`countdown_beep`, `go`, `rest`, `round_change`, `finish`) into native uncompressed `AudioBuffer` memory during `prepare()`.
- Once decoded into native RAM, cue dispatch requires zero decoding overhead or disk I/O during timer ticks.

### 2. Hardware Audio Clock Scheduling

- Sound playback is dispatched strictly on `audioContext.currentTime` via `AudioBufferSourceNode.start(when)`.
- Eliminates all JavaScript `setTimeout` delays from multi-tone sequences (such as finish fanfares and countdowns). All sequence steps are scheduled directly onto the hardware audio timeline.

### 3. Audio Session & Ducking Configuration

- System audio session is configured via `AudioManager.setAudioSessionOptions` with:
  - `iosCategory: "playback"`: Ensures cues play aloud through the loudspeaker even when the device's physical mute/silent switch is turned on.
  - `iosMode: "default"`: Maintains standard full-fidelity routing without falling back to low-sample-rate telephony/HFP profiles.
  - `iosOptions: ["duckOthers", "mixWithOthers", "defaultToSpeaker"]`: Configures external background music (Spotify, Apple Music) to duck while cues play, without cutting or pausing the athlete's workout soundtrack.
  - `iosNotifyOthersOnDeactivation: true`: Notifies external audio apps immediately upon session deactivation so normal volume is restored.
- **Demand-driven transient audio focus & session activation**:
  - On engine initialization and during `prepare()`, audio focus is **not claimed** and the audio session remains inactive to ensure external music players are never paused or ducked while the timer screen is opened or idle.
  - When playing a sound cue (`playSound`), the engine requests transient focus with ducking on Android (`AudioManager.observeAudioInterruptions("gainTransientMayDuck")`) and activates the iOS audio session (`AudioManager.setAudioSessionActivity(true)`).
  - **Anticipatory Warmup (`warmUp()`)**: To prevent cold-start DAC pops and buffer underruns, `TimerController` emits a sound-agnostic `TimerEventType.TRANSITION_APPROACHING` event ~500ms before upcoming cues (calculated via deterministic strategy lookahead `calculateState(elapsed + 500)`). If sound is enabled, `FeedbackService` triggers `audioEngine.warmUp()`, which eagerly claims transient ducking focus and resumes the suspended `AudioContext` so the audio thread is completely warm and stable before the note triggers.
  - **Acoustic Drain Window (`AUDIO_DRAIN_TIME_MS = 200`)**: Speaker hardware FIFO and platform DMA buffers retain audio for ~30–50ms after JavaScript `sourceNode.onended` fires. Immediate focus release or suspension creates an abrupt DC offset cut / acoustic pop. An intentional 200ms drain delay ensures all physical samples clear the hardware speaker buffer before external volume restores.
  - **Countdown Ducking Hold (`COUNTDOWN_HOLD_DUCKING_MS = 1200`)**: During 1-second countdown cadences (3... 2... 1... GO), ducking is maintained across ticks for 1200ms to eliminate nauseating "volume pumping" in external music.
  - **Idle DAC Sleep (`AUDIO_IDLE_SLEEP_MS = 1500`)**: After audio focus is released and the speaker drain window elapses, an idle timer suspends `AudioContext` after 1500ms, conserving device battery during long workout intervals without sacrificing immediate response.
  - When playback explicitly stops (`stopAudio`/`dispose`), release timers are cancelled, focus is relinquished, and `AudioContext` suspends immediately.

### 4. Lifecycle & Energy Management

- `prepare()` provides idempotent, eager decoding of canonical sound buffers into native RAM before interval countdowns begin. The workout timer screen (`screens/timer/index.tsx`) calls `prepare()` on mount to pre-load buffers into memory without waking the DAC or stealing audio focus while idle.
- `dispose()` releases native audio graph resources, detaches controller observers, and terminates store subscriptions when the athlete finishes or leaves the timer screen.
- `suspend()` pauses DAC hardware time progression when the timer is idle, conserving battery.
- `stopAudio()` immediately halts and disconnects active buffer sources upon pause, reset, or finish.

### 5. Unified Observer Feedback Service & Audio-Haptic Coordination

- `FeedbackService` implements the Observer pattern, attaching to `TimerController` lifecycle events (`BEEP`, `GO`, `FINISH`, `PHASE_CHANGE`, `ROUND_CHANGE`) and mapping them to semantic `FeedbackCue` triggers (`COUNTDOWN`, `GO`, `REST`, `ROUND_CHANGE`, `FINISH`).
- `TimerController` is completely freed of all transducer logic, becoming a pure interval time accumulator.
- The hook layer (`hooks/use-timer.tsx`) attaches `FeedbackService` directly to the active `TimerController` instance, replacing imperative callback routing with declarative observer dispatch.
- Transducer dispatch executes synchronously without unawaited blocking promises: native audio buffer sources schedule on `currentTime` while `expo-haptics` impacts trigger concurrently in fire-and-forget fashion.
- User preference toggles (`isSoundEnabledAtom` and `hasHapticEnabledAtom`) are observed reactively via Jotai store subscriptions, keeping boolean flags synchronized in memory for zero-overhead evaluation during critical ticks.

### 6. Legacy Service Deprecation & Removal

- Deprecated and removed legacy oscillator services (`WebAudioOscillatorService`, `NullAudioFeedbackService`, and `helpers/playback-service.ts`) without dead code leftovers.
- Removed legacy `AudioFeedbackService` interface and `audioService` props in favor of direct `FeedbackService` observer attachment.

## Consequences

### Positive

- **Deterministic Cadence**: Microsecond hardware audio clock accuracy on iOS and Android. Zero timing jitter from Hermes event loop load.
- **Gym-Grade Audibility**: Mastered canonical WAV assets at 2.4 kHz – 3.2 kHz pierce loud ambient noise and cut through background music via automatic ducking.
- **Silent Mode Compliance**: Cues reliably fire through speakers even if the athlete forgot to flip off the phone's silent switch.

### Negative / Trade-offs

- **Memory Footprint**: ~150 KB of uncompressed PCM Float32 audio data held in native memory when the audio engine is prepared.
