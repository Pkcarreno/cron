import type { ExpoConfig } from "@expo/config";
import { withAppBuildGradle } from "@expo/config-plugins";

import Env from "../env";

export interface WithAbiSplitsOptions {
  enabled?: boolean;
  universalApk?: boolean;
  architectures?: string[];
}

export const DEFAULT_ARCHITECTURES = ["arm64-v8a", "armeabi-v7a", "x86_64"];

interface BlockRange {
  endIndex: number;
  startIndex: number;
}

/**
 * Generates the Gradle `splits.abi` configuration block.
 *
 * @param options - Configuration options for universal APK and target architectures.
 * @returns The formatted Groovy Gradle splits block.
 */
export const generateAbiSplitsBlock = (
  options?: Pick<WithAbiSplitsOptions, "universalApk" | "architectures">
): string => {
  const universalApk = options?.universalApk ?? true;
  const architectures =
    options?.architectures && options.architectures.length > 0
      ? options.architectures
      : DEFAULT_ARCHITECTURES;

  const formattedArchitectures = architectures
    .map((arch) => `"${arch}"`)
    .join(", ");

  return [
    "    splits {",
    "        abi {",
    "            reset()",
    "            enable true",
    `            universalApk ${universalApk}`,
    `            include ${formattedArchitectures}`,
    "        }",
    "    }",
  ].join("\n");
};

/**
 * Locates the slice bounds of an existing `splits { ... }` block in build.gradle.
 *
 * @param buildGradle - The contents of android/app/build.gradle.
 * @returns Start and end character offsets of the block, or null if absent.
 */
const findSplitsBlockRange = (buildGradle: string): BlockRange | null => {
  const splitsRegex = /(?:^|\n)(?<prefix>[ \t]*splits\s*\{)/u;
  const splitsMatch = splitsRegex.exec(buildGradle);

  if (!splitsMatch || splitsMatch.index === undefined) {
    return null;
  }

  const matchPrefixLength = splitsMatch[0].startsWith("\n") ? 1 : 0;
  const startIndex = splitsMatch.index + matchPrefixLength;
  const openBraceIndex = buildGradle.indexOf("{", startIndex);

  if (openBraceIndex === -1) {
    return null;
  }

  let depth = 0;
  let inSingleQuote = false;
  let inDoubleQuote = false;

  for (let i = openBraceIndex; i < buildGradle.length; i += 1) {
    const char = buildGradle[i];
    const prevChar = i > 0 ? buildGradle[i - 1] : "";

    if (char === "'" && prevChar !== "\\" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
    } else if (char === '"' && prevChar !== "\\" && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
    } else if (!inSingleQuote && !inDoubleQuote) {
      if (char === "{") {
        depth += 1;
      } else if (char === "}") {
        depth -= 1;
        if (depth === 0) {
          return { endIndex: i + 1, startIndex };
        }
      }
    }
  }

  return null;
};

/**
 * Injects or replaces the Gradle `splits.abi` configuration in `android/app/build.gradle`.
 *
 * Multi-Architecture Compilation (ABI Splits) compiles native C++ shared libraries (.so)
 * into individual per-CPU architecture APKs (arm64-v8a, armeabi-v7a, x86_64) plus an optional
 * universal APK. This reduces package sizes from >100 MB down to ~18-25 MB, satisfying IzzyOnDroid
 * distribution ceilings (<= 30 MB).
 *
 * @param buildGradle - The contents of android/app/build.gradle.
 * @param options - Plugin options or boolean flag enabling ABI splits.
 * @returns The updated build.gradle contents.
 */
export const setAbiSplits = (
  buildGradle: string,
  options?: WithAbiSplitsOptions | boolean
): string => {
  const normalizedOptions: WithAbiSplitsOptions =
    typeof options === "boolean" ? { enabled: options } : (options ?? {});

  if (normalizedOptions.enabled === false) {
    return buildGradle;
  }

  const splitsBlock = generateAbiSplitsBlock(normalizedOptions);
  const existingSplits = findSplitsBlockRange(buildGradle);

  if (existingSplits) {
    return `${buildGradle.slice(0, existingSplits.startIndex)}${splitsBlock}${buildGradle.slice(existingSplits.endIndex)}`;
  }

  // Inject inside the top of the android { ... } configuration block.
  const androidRegex = /(?<androidBlock>android\s*\{)/u;
  const androidMatch = androidRegex.exec(buildGradle);

  if (!androidMatch || androidMatch.index === undefined) {
    throw new Error(
      "Could not find 'android {' block in android/app/build.gradle"
    );
  }

  const insertIndex = androidMatch.index + androidMatch[0].length;
  return `${buildGradle.slice(0, insertIndex)}\n${splitsBlock}\n${buildGradle.slice(insertIndex)}`;
};

export const setAbiSplitsBuildGradle = setAbiSplits;

/**
 * Injects Gradle's `splits.abi` block into `android/app/build.gradle` for multi-architecture compilation.
 *
 * This configuration plugin enables native ABI splitting into distinct APKs per CPU architecture
 * (`arm64-v8a`, `armeabi-v7a`, `x86_64`) plus an optional universal APK, reducing binary download sizes
 * for end-users and meeting IzzyOnDroid package limits.
 *
 * @param config - The Expo project configuration object.
 * @param options - Plugin configuration options (enabled, universalApk, architectures).
 * @returns The modified Expo configuration with app/build.gradle modifications applied.
 */
export const withAbiSplits = (
  config: ExpoConfig,
  options?: WithAbiSplitsOptions
): ExpoConfig => {
  const isEnabled =
    options?.enabled ?? Env.EXPO_PUBLIC_APP_ENV === "production";

  return withAppBuildGradle(config, (gradleConfig) => {
    if (gradleConfig.modResults.language === "groovy") {
      gradleConfig.modResults.contents = setAbiSplits(
        gradleConfig.modResults.contents,
        {
          ...options,
          enabled: isEnabled,
        }
      );
    }
    return gradleConfig;
  });
};

export default withAbiSplits;
