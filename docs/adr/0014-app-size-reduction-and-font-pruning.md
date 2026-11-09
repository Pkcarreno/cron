# ADR 0014: App Size Optimization, Typography Pruning, Native R8 Shrinking, and Valibot Migration

- **Status**: Accepted
- **Date**: November 2026
- **Context**: React Native 0.88.0, Expo SDK 58 (`58.0.16`), New Architecture (Fabric & TurboModules), React 19 (`19.3.0`), Hermes Bytecode, Jotai (`2.19.1`), `react-native-svg` (`15.16.0`).

---

## 1. Context & Problem Statement

Following the initial dependency streamlining in [ADR 0013](file:///home/pk/.t3/worktrees/cron/t3-8b8222f6/docs/adr/0013-dependency-pruning-and-local-architecture.md), a comprehensive binary and bundle size audit of the production application revealed three critical sources of weight inflation across the native, asset, and JavaScript layers:

1. **Massive Font Asset Bloat (`assets/fonts/`)**:
   - The application currently packages **36 distinct TrueType Font (`.ttf`) files** totaling **~4.97 MB**.
   - All 36 files are registered in [`app.config.ts`](file:///home/pk/.t3/worktrees/cron/t3-8b8222f6/app.config.ts) and embedded into native APK/IPA binaries.
   - **Zero Italic Usage**: The codebase contains **zero** usages of italic styling (`fontStyle: "italic"`), meaning the 18 `*Italic.ttf` files account for **~2.48 MB of dead weight**.
   - **Unused Font Weights**: The app only uses 7 weights for Geist Sans (`200`, `300`, `400`, `500`, `600`, `700`, `800`) and 3 weights for Geist Mono (`300`, `400`, `800`). The remaining weights (`100` Thin and `900` Black in Sans; `100`, `200`, `500`, `600`, `700`, `900` in Mono) are never referenced.
2. **Missing Native Code & Resource Shrinking (Android R8)**:
   - Compilations do not enable R8 minification or resource shrinking (`shrinkResources`).
   - Unused bytecode and unreferenced drawables/XML layouts from AndroidX, Jetpack, and native TurboModules remain packaged in release APKs.
3. **Disproportionate JavaScript Bundle Overhead (`zod`)**:
   - Production bundle inspection revealed that `zod` accounts for **536.2 KB of unminified JavaScript** (~150 KB Hermes bytecode).
   - This single library is nearly double the size of the entire `cron` application source code (293.3 KB), despite only being used for three small schemas ([`env.ts`](file:///home/pk/.t3/worktrees/cron/t3-8b8222f6/env.ts), [`schemas.ts`](file:///home/pk/.t3/worktrees/cron/t3-8b8222f6/helpers/timer/schemas.ts), and [`config-serializer.ts`](file:///home/pk/.t3/worktrees/cron/t3-8b8222f6/helpers/timer/utils/config-serializer.ts)) after the removal of TanStack Form in ADR 0013.

---

## 2. Decision & Architecture

We adopt a systematic size optimization architecture across all three application layers:

### 2.1. Typography: Static Weight Pruning & Strict Typing

1. **Delete 26 Unused Font Files from Working Tree**:
   - Remove all 18 `*Italic.ttf` files.
   - Remove unused static weights: `Geist-Thin.ttf`, `Geist-Black.ttf`, `GeistMono-Thin.ttf`, `GeistMono-ExtraLight.ttf`, `GeistMono-Medium.ttf`, `GeistMono-SemiBold.ttf`, `GeistMono-Bold.ttf`, `GeistMono-Black.ttf`.
   - Retain exactly **10 active TTF files** in [`assets/fonts/`](file:///home/pk/.t3/worktrees/cron/t3-8b8222f6/assets/fonts/):
     - **Geist Sans (7 weights)**: `200` (ExtraLight), `300` (Light), `400` (Regular), `500` (Medium), `600` (SemiBold), `700` (Bold), `800` (ExtraBold).
     - **Geist Mono (3 weights)**: `300` (Light), `400` (Regular), `800` (ExtraBold).
   - **Net Savings**: **~3.67 MB reduction** (from ~4.97 MB down to ~1.30 MB).
   - _Rationale_: All 36 original font files remain permanently tracked in Git history and can be restored on demand. Removing them from the working tree prevents accidental inclusion by Metro or EAS asset bundlers.
2. **Update Native Font Declarations in [`app.config.ts`](file:///home/pk/.t3/worktrees/cron/t3-8b8222f6/app.config.ts)**:
   - Clean up the `expo-font` configuration plugin to declare only the 10 active files in both the Android XML font families (`res/font/geist.xml`, `res/font/geist_mono.xml`) and the iOS font asset list.
3. **Strict TypeScript Typing in [`components/text.tsx`](file:///home/pk/.t3/worktrees/cron/t3-8b8222f6/components/text.tsx)**:
   - Restrict the `FontWeight` type union strictly to the available embedded weights:
     ```typescript
     type DefaultFontWeight =
       | "200"
       | "300"
       | "400"
       | "500"
       | "600"
       | "700"
       | "800";
     type MonoFontWeight = "300" | "400" | "800";
     ```
   - Prevents compile-time regressions and warns developers if an unsupported weight is applied.

### 2.2. Native Android: R8 Minification & Resource Shrinking

1. **Install `expo-build-properties`**:
   - Add `expo-build-properties` plugin to [`app.config.ts`](file:///home/pk/.t3/worktrees/cron/t3-8b8222f6/app.config.ts).
2. **Configure Release Optimization Flags**:
   ```typescript
   [
     "expo-build-properties",
     {
       android: {
         enableMinifyInReleaseBuilds: true,
         shrinkResources: true,
         enableBundleCompression: true,
       },
       ios: {
         deploymentTarget: "15.1",
       },
     },
   ];
   ```
   - Activates R8 code shrinking and Android resource shrinking in all release builds (both `preview` and `production`), shedding 15% to 30% of DEX bytecode and unreferenced native library resources.

### 2.3. JavaScript Bundle: Zod to Valibot Migration

1. **Eliminate `zod`**:
   - Remove `zod` from both `dependencies` and `devDependencies` in [`package.json`](file:///home/pk/.t3/worktrees/cron/t3-8b8222f6/package.json).
2. **Adopt `valibot`**:
   - Install `valibot` as the sole schema validation library.
   - Refactor schema validation in:
     - [`env.ts`](file:///home/pk/.t3/worktrees/cron/t3-8b8222f6/env.ts): environment variable validation via `v.object()`, `v.enum_()`, `v.safeParse()`.
     - [`helpers/timer/schemas.ts`](file:///home/pk/.t3/worktrees/cron/t3-8b8222f6/helpers/timer/schemas.ts): form validation schemas.
     - [`helpers/timer/utils/config-serializer.ts`](file:///home/pk/.t3/worktrees/cron/t3-8b8222f6/helpers/timer/utils/config-serializer.ts): discriminated union deserialization via `v.variant()`.
   - **Net Savings**: **~500 KB reduction** in unminified JavaScript bundle size (~150 KB in Hermes bytecode).

### 2.4. Tooling & Verification: Expo Atlas

1. **Add Bundle Inspection Script**:
   - Add `"bundle:analyze": "EXPO_ATLAS=true expo export -p android && npx expo-atlas .expo/atlas.jsonl"` to `package.json`.
   - Enables continuous inspection of module dependencies and bundle weights across releases.

---

## 3. Explicit Non-Goals & Invariants

1. **Non-Goal: Audio Compression**: Audio assets in [`assets/audio/default/`](file:///home/pk/.t3/worktrees/cron/t3-8b8222f6/assets/audio/default/) remain as 16-bit 44.1 kHz `.wav` PCM files.
2. **Non-Goal: Preview Architecture Splits**: The `preview` build profile in [`eas.json`](file:///home/pk/.t3/worktrees/cron/t3-8b8222f6/eas.json) continues to produce a universal multi-architecture APK to support testing across heterogeneous hardware.
3. **Invariant: Zero Visual or Behavior Regressions**: All 576 unit tests must pass deterministically, and all UI elements (including SVG digital readouts) must render identically.

---

## 4. Consequences

### Positive

- **~3.67 MB** removed from native binary packages through font pruning.
- **~500 KB** removed from JavaScript bundle through Valibot migration.
- **15% – 30%** native DEX code and resource reduction via Android R8.
- Compile-time safety against unbundled font weights in `components/text.tsx`.
- Standardized bundle introspection tool via Expo Atlas.

### Negative / Trade-offs

- Android release builds (`preview` and `production`) will take ~30–90 seconds longer to compile due to R8 global program analysis.
- Adding a new font weight in the future requires adding the `.ttf` file to `assets/fonts/` and registering it in `app.config.ts`.
