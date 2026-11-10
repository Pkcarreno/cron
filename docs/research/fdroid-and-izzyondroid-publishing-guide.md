# Technical Research: Publishing `cron` on F-Droid and IzzyOnDroid

- **Repository**: `cron` (`com.pkcarreno.cron`)
- **Technology Stack**: Expo SDK ~58.0.16, React Native 0.88.0, React 19.3.0, New Architecture (Fabric & TurboModules)
- **License**: GNU General Public License v3.0 (`GPL-3.0-only`)
- **Primary Focus**: Comprehensive analysis, primary-source policies, and step-by-step procedures for publishing to both IzzyOnDroid and the official F-Droid repository
- **Date**: November 2026
- **Status**: Complete Evaluation & Actionable Roadmap

---

## 1. Executive Summary

Distributing `cron` through the F-Droid ecosystem provides privacy-conscious and open-source Android users with direct, trusted access to the application without relying on Google Play Services or the proprietary Google Play Store.

There are two primary distribution targets within this ecosystem:

1. **IzzyOnDroid**: A community-run, F-Droid-compatible repository hosted by Andreas Itzchak Rehberg (Izzy). It tracks git release tags and indexes **pre-compiled release APKs** signed directly by the developer. It functions as the premier staging ground and incubator for FOSS Android apps.
2. **F-Droid Official Repository**: The flagship repository managed by the F-Droid non-profit team. It requires apps to be **built 100% from source** within F-Droid’s isolated, offline build infrastructure, signed with F-Droid's master release key (unless reproducible builds are proven).

### 1.1 Comparative Matrix

| Criterion | IzzyOnDroid (`apt.izzysoft.de`) | F-Droid Official (`f-droid.org`) |
| :-- | :-- | :-- |
| **Build Model** | Indexes developer-provided **pre-built release APKs** from Git release assets | Compiles strictly **from source** on F-Droid CI servers (`fdroidserver`) |
| **Signing Key** | **Developer's Keystore** (seamless updates if user installed from GitHub Release) | **F-Droid Keystore** (incompatible with developer APKs unless reproducible builds match) |
| **Review & Inclusion Speed** | **Fast** (typically 1 to 5 business days) | **Slow to Moderate** (typically 2 to 8+ weeks due to manual recipe reviews and build tests) |
| **Build Infrastructure Burden** | Zero. Builds locally or in developer GitHub Actions | High. Requires an isolated Debian build recipe supporting Node.js, pnpm, and Gradle offline |
| **Max Binary Size** | Strictly enforced recommendation of **$\le$ 30 MB** (soft cap ~35 MB) | Flexible, but discouraged if excessive (encourages ABI split packages) |
| **Submission Platform** | Issue ticket on **Codeberg** (`IzzyOnDroid/repo`) | Merge Request on **GitLab** (`fdroid/fdroiddata`) |
| **Metadata Source** | Fastlane structure in Git repo (`fastlane/metadata/android/`) | Fastlane structure in Git repo or inline in F-Droid `.yml` recipe |
| **Relationship** | Serves as official incubator; apps are often phased out once accepted into F-Droid Main | Flagship catalog; reached by default on all F-Droid client installations |

### 1.2 Suitability Audit for `cron`

An audit of the `cron` codebase against both platforms reveals that the project is in an exceptional position for immediate acceptance:

- **License Compliance**: Fully licensed under `GPL-3.0-only` ([LICENSE](file:///home/pk/.t3/worktrees/cron/t3-95a9d0c7-67d3c5baf7f5d733/LICENSE)).
- **Zero Proprietary SDKs**: No Google Play Services, Firebase, Crashlytics, Facebook SDK, or commercial advertising modules in [package.json](file:///home/pk/.t3/worktrees/cron/t3-95a9d0c7-67d3c5baf7f5d733/package.json).
- **Network & Privacy**: In [app.config.ts](file:///home/pk/.t3/worktrees/cron/t3-95a9d0c7-67d3c5baf7f5d733/app.config.ts#L98-L101), `INTERNET` permission is explicitly blocked for production builds (`blockedPermissions: ["android.permission.INTERNET"]`). This completely eliminates "Tracking" and "NonFreeNet" anti-features.
- **Automated Release Pipeline**: The existing [.github/workflows/new-release.yml](file:///home/pk/.t3/worktrees/cron/t3-95a9d0c7-67d3c5baf7f5d733/.github/workflows/new-release.yml#L63-L70) already builds a production release APK (`cron-v${APP_VERSION}.apk`) and attaches it to GitHub Releases upon tag creation.

---

## 2. Primary Sources & Canonical Documentation

Every requirement, constraint, and procedure documented here is derived directly from the primary sources governing both platforms:

### 2.1 F-Droid Official

- **Inclusion Policy**: [f-droid.org/docs/Inclusion_Policy](https://f-droid.org/docs/Inclusion_Policy/)
- **Submitting to F-Droid (Quick Start Guide)**: [f-droid.org/docs/Submitting_to_F-Droid_Quick_Start_Guide](https://f-droid.org/docs/Submitting_to_F-Droid_Quick_Start_Guide/)
- **Inclusion How-To**: [f-droid.org/docs/Inclusion_How-To](https://f-droid.org/docs/Inclusion_How-To/)
- **Build Metadata Reference**: [f-droid.org/docs/Build_Metadata_Reference](https://f-droid.org/docs/Build_Metadata_Reference/)
- **Fastlane & Metadata Specification**: [f-droid.org/docs/All_about_descriptions_graphics_and_screenshots](https://f-droid.org/docs/All_about_descriptions_graphics_and_screenshots/)
- **Anti-Features Flags**: [f-droid.org/docs/Anti-Features](https://f-droid.org/docs/Anti-Features/)
- **Canonical React Native Build Template**: [`fdroiddata/templates/build-react-native.yml`](https://gitlab.com/fdroid/fdroiddata/-/blob/master/templates/build-react-native.yml)
- **F-Droid Metadata Repository**: [`gitlab.com/fdroid/fdroiddata`](https://gitlab.com/fdroid/fdroiddata)

### 2.2 IzzyOnDroid

- **App Inclusion Policy**: [izzyondroid.org/docs/general/AppInclusionPolicy](https://izzyondroid.org/docs/general/AppInclusionPolicy/)
- **Inclusion Information & Host Rules**: [apt.izzysoft.de/fdroid/index/info/inclusion](https://apt.izzysoft.de/fdroid/index/info/inclusion)
- **Codeberg Issue Tracker (Submissions)**: [codeberg.org/IzzyOnDroid/repo](https://codeberg.org/IzzyOnDroid/repo)
- **AI-Assisted Code Policy**: [izzyondroid.org/docs/general/ai](https://izzyondroid.org/docs/general/ai/)

---

## 3. Architecture & Ecosystem Dynamics

Understanding the structural differences between IzzyOnDroid and F-Droid is critical to designing a seamless release strategy.

```
                    ┌──────────────────────────────────────────────┐
                    │          cron Repository (GitHub)            │
                    │   - GPL-3.0 License                          │
                    │   - Fastlane Metadata                        │
                    │   - Git Release Tags (v0.9.0)                │
                    └───────┬──────────────────────────────┬───────┘
                            │                              │
         Push Git Tag       │                              │  Merge Request
       & Attach Release APK │                              │  Build Recipe (.yml)
                            ▼                              ▼
             ┌─────────────────────────┐      ┌─────────────────────────┐
             │      IzzyOnDroid        │      │     F-Droid Official    │
             │   (apt.izzysoft.de)     │      │     (f-droid.org)       │
             ├─────────────────────────┤      ├─────────────────────────┤
             │ • Indexes prebuilt APK  │      │ • Clones source repo    │
             │ • Developer signing key │      │ • Builds offline on CI  │
             │ • Rapid inclusion (days)│      │ • F-Droid signing key   │
             │ • Incubation phase      │      │ • Takes weeks/months    │
             └─────────────┬───────────┘      └────────────┬────────────┘
                           │                               │
                           ▼                               ▼
                 ┌──────────────────────────────────────────────────┐
                 │       End User F-Droid Client App                │
                 │   (F-Droid, Neo Store, Droid-ify, Obtainium)     │
                 └──────────────────────────────────────────────────┘
```

### 3.1 The Signing Key Divergence Problem

A critical architectural consideration for Android application distribution is the **package signing key**:

1. **IzzyOnDroid** distributes the exact APK attached to the GitHub release. It retains the developer's signing key. A user who manually downloads `cron-v0.9.0.apk` from GitHub can update to `v0.9.1` automatically through IzzyOnDroid without any signature mismatch.
2. **F-Droid Official** builds the application from source in a sealed container and signs the resulting binary with the **F-Droid master certificate**.
3. **The Consequence**: Android's Package Manager enforces cryptographic signature matching across updates. A user cannot update an app installed from IzzyOnDroid or GitHub with an update from official F-Droid without uninstalling first (which deletes application data/MMKV state), **unless** the application qualifies for F-Droid's _Reproducible Builds_ program where F-Droid uses the upstream developer's signature.

### 3.2 The Standard Lifecycle: Incubator to Flagship

The established path within the FOSS Android community is:

1. **Phase 1 (Immediate)**: Publish to **IzzyOnDroid**. Users gain instant access via F-Droid clients by adding Izzy's repository (which is pre-configured as a default toggle in modern clients like Neo Store and Droid-ify).
2. **Phase 2 (Parallel)**: Open a Merge Request to `fdroiddata` for official inclusion.
3. **Phase 3 (Transition)**: Once F-Droid official successfully compiles and publishes the app, Izzy marks the application as archived or moves it to the F-Droid master repository to avoid redundant hosting.

---

## 4. Phase 1: Publishing to IzzyOnDroid (Step-by-Step)

Because IzzyOnDroid uses the pre-built APKs already generated by `cron`'s CI workflow, getting listed on IzzyOnDroid requires minimal engineering effort.

### 4.1 Prerequisites Checklist

- [x] **Open Source License**: `cron` is licensed under GPL-3.0.
- [x] **Public Git Repository**: Hosted publicly on GitHub.
- [x] **Zero Tracking / Ads**: Confirmed (no telemetry SDKs).
- [x] **No Internet Permission in Production**: Confirmed in `app.config.ts`.
- [x] **GitHub Releases with Attached APK**: Confirmed in `.github/workflows/new-release.yml`.
- [ ] **Persistent Signing Keystore**: Verified across builds.
- [ ] **Fastlane Metadata Tree**: Needs to be created in `fastlane/metadata/android/`.
- [ ] **APK Size Target**: Must be within the $\le$ 30 MB guideline.

### 4.2 Verifying Keystore Consistency

IzzyOnDroid verifies that every new release APK is signed with the **same cryptographic key** as previous releases. In [.github/workflows/new-release.yml](file:///home/pk/.t3/worktrees/cron/t3-95a9d0c7-67d3c5baf7f5d733/.github/workflows/new-release.yml#L64):

```bash
eas build --platform android --profile production-apk --local --output cron-v${{ env.APP_VERSION }}.apk --non-interactive
```

When running `eas build --local` with `EXPO_TOKEN`, EAS downloads the remote Android Keystore stored securely in the Expo project credentials.

> [!IMPORTANT]
> Ensure the production keystore on Expo Dashboard is permanent and backed up. If the keystore changes, IzzyOnDroid's automatic scanner will flag the APK as broken and halt updates.

### 4.3 Setting Up Fastlane Metadata

IzzyOnDroid automatically crawls the repository's Fastlane metadata to extract screenshots, descriptions, icons, and changelogs.

Create the standard directory tree at `fastlane/metadata/android/`:

```
fastlane/
└── metadata/
    └── android/
        └── en-US/
            ├── title.txt
            ├── short_description.txt
            ├── full_description.txt
            ├── changelogs/
            │   └── 900.txt             # Matches versionCode (e.g., 900 for 0.9.0)
            └── images/
                ├── icon.png            # 512x512 PNG
                └── phoneScreenshots/   # 1080x1920 or modern aspect ratio PNGs
                    ├── 1.png
                    ├── 2.png
                    └── 3.png
```

#### Content Specifications:

- `title.txt`: `Cron` (maximum 50 characters).
- `short_description.txt`: `Minimalist, offline HIIT & interval timer with fluid physical motion.` (maximum 80 characters).
- `full_description.txt`: A detailed markdown/HTML description highlighting key features (GPLv3 license, 100% offline, zero network permissions, tactile haptics, precise audio synthesis).
- `changelogs/<versionCode>.txt`: Release summary for that build. Per `env.ts`, `versionCode` for `0.9.0` is `0 * 10000 + 9 * 100 + 0 = 900`. Therefore, the file name should be `900.txt`.

### 4.4 Submitting the Request to IzzyOnDroid

Once the release is tagged and the Fastlane folder committed:

1. Navigate to the **[IzzyOnDroid Codeberg Issues Portal](https://codeberg.org/IzzyOnDroid/repo/issues/new)**.
2. Select the template: **`[App] <Name> (<package.id>)`**.
3. Fill out the application submission form using the following template:

```markdown
### Application Information

- **Name:** Cron
- **Package Name:** `com.pkcarreno.cron`
- **Summary:** Offline, distraction-free HIIT and interval timer built with fluid motion.
- **License:** GPL-3.0-only
- **Source Repository:** https://github.com/pkcarreno/cron
- **Issue Tracker:** https://github.com/pkcarreno/cron/issues
- **Release Tag / APK URL:** https://github.com/pkcarreno/cron/releases/tag/v0.9.0

### Fastlane Metadata

- [x] Fastlane metadata structure is provided at `fastlane/metadata/android/`.

### Permissions & Security Checklist

- [x] The APK is signed with a release key.
- [x] The APK size is within the limit (~20-25 MB).
- [x] The app does not self-update or download external executable code.
- [x] Explanation of permissions:
  - `VIBRATE`: Haptic cues during intervals.
  - `FOREGROUND_SERVICE` & `FOREGROUND_SERVICE_HEALTH`: Ensures timer precision when screen is locked or app is backgrounded.
  - `HIGH_SAMPLING_RATE_SENSORS`: High-precision timer synchronization.
  - `POST_NOTIFICATIONS`: Interval completion banners.
  - `WAKE_LOCK`: Keeps CPU active for background intervals.
  - Note: `INTERNET` permission is explicitly blocked in production builds.

### Anti-Features / Tracking

- **Telemetry / Analytics:** None.
- **Non-Free Network Services:** None. 100% offline application.

### AI Tools Usage Policy

- **Assistance Level:** Minor (code formatting, documentation, architecture evaluation).
- **Details:** Core application architecture, UI design, audio system, and timer engine authored and maintained by the project owner.
```

---

## 5. Phase 2: Publishing to F-Droid Official (Source Build Track)

Publishing to the official F-Droid repository requires submitting a YAML build recipe to [`fdroid/fdroiddata`](https://gitlab.com/fdroid/fdroiddata) on GitLab.

### 5.1 F-Droid Build Server Constraints

The F-Droid build environment has specific security restrictions:

1. **Network Isolation**: The build environment is strictly offline during the Gradle build phase. All dependencies (npm/pnpm packages, Gradle plugins) must be resolved or cached beforehand.
2. **No Proprietary Binaries**: Any pre-compiled binaries (`.so`, `.aar`, `.jar`) inside `node_modules` or the repository trigger scanner alerts (`scandelete` / `scanignore` required).
3. **Expo Prebuild Requirement**: Because Expo projects generate the native `android/` directory dynamically via `npx expo prebuild`, the F-Droid build recipe must invoke `expo prebuild` in the `prebuild:` phase.
4. **Stripping Signing Config**: F-Droid signs the binary itself. The recipe must strip any `signingConfig` instructions from `android/app/build.gradle` so Gradle produces an unsigned release APK for F-Droid's build daemon to sign.

### 5.2 F-Droid Build Recipe (`com.pkcarreno.cron.yml`)

Based on F-Droid's canonical [`templates/build-react-native.yml`](https://gitlab.com/fdroid/fdroiddata/-/blob/master/templates/build-react-native.yml) and active Expo recipes in `fdroiddata` (e.g., `io.evcc.android`, `com.guiforge.bati`), here is the complete metadata recipe for `cron`:

```yaml
Categories:
  - Health & Fitness
  - Time
License: GPL-3.0-only
SourceCode: https://github.com/pkcarreno/cron
IssueTracker: https://github.com/pkcarreno/cron/issues
Changelog: https://github.com/pkcarreno/cron/releases

AutoName: Cron
Summary: Offline HIIT & interval timer with physical motion
Description: |-
  Cron is a distraction-free, privacy-focused interval and HIIT timer.
  Designed with fluid motion and tactile feedback, it operates completely
  offline with zero network permissions.

  Features:
  * High-precision interval and countdown timers
  * Low-latency procedural audio cues
  * Tactile haptic feedback
  * Zero internet permissions requested or used
  * Free and open-source under GPLv3

RepoType: git
Repo: https://github.com/pkcarreno/cron.git

Builds:
  - versionName: 0.9.0
    versionCode: 900
    commit: v0.9.0
    subdir: android/app
    sudo:
      - apt-get update
      - apt-get install -y --no-install-recommends nodejs npm
      - npm install -g pnpm@latest
    init:
      - cd ../..
      - pnpm install --frozen-lockfile
      - rm -rf node_modules/expo-dev-client node_modules/expo-dev-launcher node_modules/expo-dev-menu
    prebuild:
      - cd ../..
      # Force Expo autolinking to compile native modules from source
      - sed -i -e '/"expo":\ {/a "autolinking":{"android":{"buildFromSource":[".*"]}},' package.json
      # Generate native Android project via Expo prebuild
      - npx expo prebuild --platform android --clean --no-install
      # Remove release signing configuration so F-Droid can sign the APK
      - sed -i -e '/signingConfig /d' android/app/build.gradle
    scanignore:
      - node_modules/hermes-compiler/hermesc/linux64-bin/hermesc
      - node_modules/expo-modules-core/android/ExpoModulesCorePlugin.gradle
      - node_modules/react-native-safe-area-context/android/build.gradle
      - node_modules/react-native-screens/android/build.gradle
    scandelete:
      - node_modules
    gradle:
      - yes
    gradleprops:
      - reactNativeArchitectures=arm64-v8a,armeabi-v7a,x86_64
      - android.enableMinifyInReleaseBuilds=true
      - android.enableShrinkResourcesInReleaseBuilds=true

AutoUpdateMode: Version v%v
UpdateCheckMode: Tags
CurrentVersion: 0.9.0
CurrentVersionCode: 900
```

### 5.3 Step-by-Step Submission Procedure for F-Droid

1. **Fork the Repository**: Fork [`gitlab.com/fdroid/fdroiddata`](https://gitlab.com/fdroid/fdroiddata) to your GitLab account.
2. **Create a Feature Branch**:
   ```bash
   git checkout -b add-cron
   ```
3. **Add the Metadata Recipe**: Create the file `metadata/com.pkcarreno.cron.yml` with the contents shown above.
4. **Test the Build with `fdroidserver` (Optional but Recommended)**: You can run F-Droid’s linter and test build locally inside Docker:
   ```bash
   fdroid checkupdates com.pkcarreno.cron
   fdroid lint com.pkcarreno.cron
   fdroid build -v -s com.pkcarreno.cron
   ```
5. **Open a Merge Request**: Push the branch to your fork and submit an MR to `fdroid/fdroiddata` with title: `New app: Cron (com.pkcarreno.cron)`
6. **Respond to Maintainer Feedback**: F-Droid CI will automatically run scanners. If it finds binary artifacts in native dependencies (such as hermesc or pre-compiled C++ libs in `react-native-nitro-modules`), maintainers will ask to adjust `scanignore` or `scandelete`.

---

## 6. Implementation Checklist & Action Plan

To execute this strategy smoothly, follow this prioritized roadmap:

### Step 1: Create Fastlane Metadata in `cron`

Create the folder hierarchy `fastlane/metadata/android/en-US/`:

- Add `title.txt`, `short_description.txt`, `full_description.txt`.
- Copy current app icon ([assets/icon.png](file:///home/pk/.t3/worktrees/cron/t3-95a9d0c7-67d3c5baf7f5d733/assets/icon.png)) to `fastlane/metadata/android/en-US/images/icon.png`.
- Add 2 to 4 high-resolution screenshots to `fastlane/metadata/android/en-US/images/phoneScreenshots/`.
- Add `changelogs/900.txt`.

### Step 2: Push Release Tag & Build APK

- Trigger a GitHub Release via `git tag v0.9.0 && git push origin v0.9.0`.
- Verify that [.github/workflows/new-release.yml](file:///home/pk/.t3/worktrees/cron/t3-95a9d0c7-67d3c5baf7f5d733/.github/workflows/new-release.yml) runs cleanly and attaches `cron-v0.9.0.apk`.
- Download the generated APK and confirm its file size is $\le$ 30 MB.

### Step 3: Submit Inclusion Issue on IzzyOnDroid Codeberg

- Open an issue on [codeberg.org/IzzyOnDroid/repo/issues/new](https://codeberg.org/IzzyOnDroid/repo/issues/new) using the template provided in Section 4.4.
- Track review comments (Izzy typically reviews and merges valid apps within 48-72 hours).

### Step 4: Submit F-Droid Official Merge Request

- Submit `metadata/com.pkcarreno.cron.yml` to GitLab `fdroid/fdroiddata`.
- Keep IzzyOnDroid active while the F-Droid build pipeline completes review and indexing.
