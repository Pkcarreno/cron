# ADR 0015: Multi-Architecture Compilation (ABI Splits) and CI Pipeline Integration

- **Status**: Accepted
- **Date**: November 2026
- **Context**: React Native 0.88.0, Expo SDK 58 (`58.0.16`), New Architecture (Fabric & TurboModules), EAS Build Local, GitHub Actions, F-Droid & IzzyOnDroid Distribution.

---

## 1. Context & Problem Statement

Following the font asset pruning and R8 shrinking introduced in [ADR 0014](file:///home/pk/.t3/worktrees/cron/t3-95a9d0c7-67d3c5baf7f5d733/docs/adr/0014-app-size-reduction-and-font-pruning.md), production APK builds generated via EAS (`production-apk`) still resulted in a universal fat APK weighing **over 100 MB**.

In React Native 0.88 with the New Architecture, a universal APK compiles and duplicates C++ shared libraries (`.so`) across four architectures (`arm64-v8a`, `armeabi-v7a`, `x86_64`, `x86`). Under AGP 8+, uncompressed native libraries (`extractNativeLibs="false"`) inflate the downloadable binary, which:

1. Violates the strict $\le$ 30 MB package size limit enforced by **IzzyOnDroid** (`apt.izzysoft.de`).
2. Imposes massive download overhead on end users on GitHub Releases who only need the binary corresponding to their phone's processor.
3. Wastefully bundles obsolete 32-bit Intel (`x86`) code.

---

## 2. Decision & Architecture

We adopt a native **ABI Split Compilation Pipeline** integrated directly into Expo via a custom config plugin and GitHub Actions release workflow:

### 2.1. Target Architectures & Universal Variant

In a single compilation run (`assembleRelease`), the build produces distinct APKs for:

- **`arm64-v8a`**: Modern 64-bit ARM devices (>95% of active Android devices). Expected size: **~18 MB – 24 MB**.
- **`armeabi-v7a`**: Legacy 32-bit ARM devices. Expected size: **~16 MB – 20 MB**.
- **`x86_64`**: Modern Android emulators and x86_64 Chromebooks. Expected size: **~20 MB – 25 MB**.
- **`universal`** (`universalApk true`): Fat APK containing all bundled ABIs for manual sideloading.
- **Excluded**: `x86` (32-bit Intel) is explicitly omitted to conserve CI build times and disk footprint.

### 2.2. Deterministic Expo Config Plugin (`plugins/with-abi-splits.ts`)

Since the native `android/` directory is generated dynamically via `expo prebuild`, we implement an idempotent Config Plugin using `@expo/config-plugins`:

- Injects Gradle `splits { abi { enable true ... } }` into `android/app/build.gradle`.
- Conditionally activated only in production (`Env.EXPO_PUBLIC_APP_ENV === "production"`), keeping local development builds (`expo run:android`) fast and untangled.
- Fully typed and tested via unit tests in `plugins/with-abi-splits.test.ts`.

### 2.3. Uniform `versionCode`

All generated APK variants share the exact same `versionCode` derived deterministically from `package.json` in [`env.ts`](file:///home/pk/.t3/worktrees/cron/t3-95a9d0c7-67d3c5baf7f5d733/env.ts). No manual architecture offsets are injected, maintaining consistency across runtime version reporting (`Env.EXPO_PUBLIC_BUILD_NUMBER`), IzzyOnDroid metadata, and GitHub Releases.

### 2.4. CI/CD Pipeline Automation ([`.github/workflows/new-release.yml`](file:///home/pk/.t3/worktrees/cron/t3-95a9d0c7-67d3c5baf7f5d733/.github/workflows/new-release.yml))

The GitHub Actions release workflow is updated to:

1. Run `eas build --platform android --profile production-apk --local --non-interactive` without restricting `--output` to a single file.
2. Automatically rename the generated APKs from default Gradle outputs (`app-<abi>-release.apk`) to semantic release filenames: `cron-v${APP_VERSION}-<abi>.apk`.
3. Attach all generated variant APKs to the GitHub Release via `softprops/action-gh-release`.

---

## 3. Consequences & Compatibility

- **IzzyOnDroid Acceptance**: The `arm64-v8a` and `armeabi-v7a` APKs fall comfortably beneath the 30 MB ceiling, enabling direct inclusion via `ApkMatch: /arm64-v8a/`.
- **F-Droid Source Builds**: Unaffected; F-Droid compiles from source using its own recipe specifying `reactNativeArchitectures`.
- **Play Store Track**: Unaffected; Google Play distribution uses Android App Bundles (`production-store` profile producing `.aab`), where Google Play handles dynamic delivery.
