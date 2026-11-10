import type { ExpoConfig } from "@expo/config";
import type {
  AndroidConfig,
  ExportedConfigWithProps,
} from "@expo/config-plugins";

import Env from "../env";
import {
  DEFAULT_ARCHITECTURES,
  generateAbiSplitsBlock,
  setAbiSplits,
  withAbiSplits,
} from "./with-abi-splits";

const createBaseBuildGradle = (options?: {
  customSplits?: string;
  hasExistingSplits?: boolean;
}): string => {
  if (options?.hasExistingSplits) {
    return [
      'apply plugin: "com.android.application"',
      "",
      "android {",
      options.customSplits ??
        [
          "    splits {",
          "        abi {",
          "            reset()",
          "            enable false",
          '            include "x86"',
          "        }",
          "    }",
        ].join("\n"),
      "",
      "    defaultConfig {",
      '        applicationId "com.pkcarreno.cron"',
      "    }",
      "}",
    ].join("\n");
  }

  return [
    'apply plugin: "com.android.application"',
    "",
    "android {",
    "    defaultConfig {",
    '        applicationId "com.pkcarreno.cron"',
    "    }",
    "}",
  ].join("\n");
};

type GradleModFunction = (props: {
  modResults: AndroidConfig.Paths.GradleProjectFile;
}) => Promise<{ modResults: AndroidConfig.Paths.GradleProjectFile }>;

describe("withAbiSplits config plugin", () => {
  describe("generateAbiSplitsBlock", () => {
    it("generates default block with arm64-v8a, armeabi-v7a, and x86_64 with universalApk true", () => {
      const block = generateAbiSplitsBlock();

      expect(block).toContain("splits {");
      expect(block).toContain("abi {");
      expect(block).toContain("reset()");
      expect(block).toContain("enable true");
      expect(block).toContain("universalApk true");
      expect(block).toContain('include "arm64-v8a", "armeabi-v7a", "x86_64"');
      expect(block).not.toContain('"x86"');
    });

    it("respects universalApk false when configured", () => {
      const block = generateAbiSplitsBlock({ universalApk: false });

      expect(block).toContain("universalApk false");
    });

    it("formats custom architectures list", () => {
      const block = generateAbiSplitsBlock({
        architectures: ["arm64-v8a", "x86_64"],
      });

      expect(block).toContain('include "arm64-v8a", "x86_64"');
      expect(block).not.toContain("armeabi-v7a");
    });

    it("falls back to DEFAULT_ARCHITECTURES when empty architecture array is provided", () => {
      const block = generateAbiSplitsBlock({
        architectures: [],
      });

      expect(block).toContain(
        `include ${DEFAULT_ARCHITECTURES.map((arch) => `"${arch}"`).join(", ")}`
      );
    });
  });

  describe("setAbiSplits", () => {
    it("injects splits.abi block into android block when enabled is true", () => {
      const initialGradle = createBaseBuildGradle();
      const updatedGradle = setAbiSplits(initialGradle, { enabled: true });

      expect(updatedGradle).toContain("splits {");
      expect(updatedGradle).toContain("abi {");
      expect(updatedGradle).toContain("reset()");
      expect(updatedGradle).toContain("enable true");
      expect(updatedGradle).toContain("universalApk true");
      expect(updatedGradle).toContain(
        'include "arm64-v8a", "armeabi-v7a", "x86_64"'
      );
      expect(updatedGradle).toContain("defaultConfig {");
    });

    it("accepts a boolean true as options parameter", () => {
      const initialGradle = createBaseBuildGradle();
      const updatedGradle = setAbiSplits(initialGradle, true);

      expect(updatedGradle).toContain("splits {");
      expect(updatedGradle).toContain("universalApk true");
    });

    it("leaves build.gradle untouched when enabled is false", () => {
      const initialGradle = createBaseBuildGradle();
      const updatedGradle = setAbiSplits(initialGradle, { enabled: false });

      expect(updatedGradle).toBe(initialGradle);
      expect(updatedGradle).not.toContain("splits {");
    });

    it("leaves build.gradle untouched when boolean false is supplied", () => {
      const initialGradle = createBaseBuildGradle();
      const updatedGradle = setAbiSplits(initialGradle, false);

      expect(updatedGradle).toBe(initialGradle);
      expect(updatedGradle).not.toContain("splits {");
    });

    it("leaves existing splits block untouched when enabled is false", () => {
      const initialGradle = createBaseBuildGradle({
        hasExistingSplits: true,
      });
      const updatedGradle = setAbiSplits(initialGradle, { enabled: false });

      expect(updatedGradle).toBe(initialGradle);
      expect(updatedGradle).toContain("enable false");
      expect(updatedGradle).toContain('include "x86"');
    });

    it("replaces existing splits block cleanly without duplication when enabled is true", () => {
      const initialGradle = createBaseBuildGradle({
        hasExistingSplits: true,
      });
      const updatedGradle = setAbiSplits(initialGradle, { enabled: true });

      // Count occurrences of splits {
      const splitsCount = (updatedGradle.match(/splits\s*\{/gu) || []).length;
      expect(splitsCount).toBe(1);

      // Verify replaced values
      expect(updatedGradle).toContain("enable true");
      expect(updatedGradle).toContain(
        'include "arm64-v8a", "armeabi-v7a", "x86_64"'
      );
      expect(updatedGradle).not.toContain('include "x86"');
      expect(updatedGradle).not.toContain("enable false");
    });

    it("ensures idempotency when called multiple times consecutively", () => {
      const initialGradle = createBaseBuildGradle();
      const firstPass = setAbiSplits(initialGradle, { enabled: true });
      const secondPass = setAbiSplits(firstPass, { enabled: true });

      expect(firstPass).toBe(secondPass);

      const splitsCount = (secondPass.match(/splits\s*\{/gu) || []).length;
      expect(splitsCount).toBe(1);
    });

    it("injects custom architectures and universalApk options into existing splits block", () => {
      const initialGradle = createBaseBuildGradle({
        hasExistingSplits: true,
      });
      const updatedGradle = setAbiSplits(initialGradle, {
        architectures: ["arm64-v8a"],
        enabled: true,
        universalApk: false,
      });

      const splitsCount = (updatedGradle.match(/splits\s*\{/gu) || []).length;
      expect(splitsCount).toBe(1);
      expect(updatedGradle).toContain('include "arm64-v8a"');
      expect(updatedGradle).toContain("universalApk false");
      expect(updatedGradle).not.toContain("universalApk true");
      expect(updatedGradle).not.toContain("x86_64");
    });

    it("throws an error when android block is missing in build.gradle", () => {
      const invalidGradle = 'apply plugin: "com.android.application"\n';

      expect(() => {
        setAbiSplits(invalidGradle, { enabled: true });
      }).toThrow(
        "Could not find 'android {' block in android/app/build.gradle"
      );
    });
  });

  describe("withAbiSplits plugin wrapper", () => {
    it("modifies appBuildGradle mod when enabled via options", async () => {
      const baseConfig: ExpoConfig = {
        name: "test-app",
        slug: "test-app",
      };

      const configured = withAbiSplits(baseConfig, { enabled: true });
      const gradleMod = (
        configured as ExportedConfigWithProps<AndroidConfig.Paths.GradleProjectFile>
      ).mods?.android?.appBuildGradle as unknown as GradleModFunction;

      expect(gradleMod).toBeDefined();

      const initialGradle: AndroidConfig.Paths.GradleProjectFile = {
        contents: createBaseBuildGradle(),
        language: "groovy",
        path: "android/app/build.gradle",
      };

      const modResult = await gradleMod({
        modResults: initialGradle,
      });

      expect(modResult.modResults.contents).toContain("splits {");
      expect(modResult.modResults.contents).toContain("enable true");
      expect(modResult.modResults.contents).toContain(
        'include "arm64-v8a", "armeabi-v7a", "x86_64"'
      );
    });

    it("leaves appBuildGradle mod untouched when enabled: false via options", async () => {
      const baseConfig: ExpoConfig = {
        name: "test-app",
        slug: "test-app",
      };

      const configured = withAbiSplits(baseConfig, { enabled: false });
      const gradleMod = (
        configured as ExportedConfigWithProps<AndroidConfig.Paths.GradleProjectFile>
      ).mods?.android?.appBuildGradle as unknown as GradleModFunction;

      expect(gradleMod).toBeDefined();

      const initialGradle: AndroidConfig.Paths.GradleProjectFile = {
        contents: createBaseBuildGradle(),
        language: "groovy",
        path: "android/app/build.gradle",
      };

      const modResult = await gradleMod({
        modResults: initialGradle,
      });

      expect(modResult.modResults.contents).toBe(initialGradle.contents);
      expect(modResult.modResults.contents).not.toContain("splits {");
    });

    it("passes custom architectures and universalApk options through config plugin", async () => {
      const baseConfig: ExpoConfig = {
        name: "test-app",
        slug: "test-app",
      };

      const configured = withAbiSplits(baseConfig, {
        architectures: ["arm64-v8a"],
        enabled: true,
        universalApk: false,
      });
      const gradleMod = (
        configured as ExportedConfigWithProps<AndroidConfig.Paths.GradleProjectFile>
      ).mods?.android?.appBuildGradle as unknown as GradleModFunction;

      const initialGradle: AndroidConfig.Paths.GradleProjectFile = {
        contents: createBaseBuildGradle(),
        language: "groovy",
        path: "android/app/build.gradle",
      };

      const modResult = await gradleMod({
        modResults: initialGradle,
      });

      expect(modResult.modResults.contents).toContain('include "arm64-v8a"');
      expect(modResult.modResults.contents).toContain("universalApk false");
      expect(modResult.modResults.contents).not.toContain("universalApk true");
    });

    it("defaults enabled state to production app environment when options omitted", async () => {
      const baseConfig: ExpoConfig = {
        name: "test-app",
        slug: "test-app",
      };

      const configured = withAbiSplits(baseConfig);
      const gradleMod = (
        configured as ExportedConfigWithProps<AndroidConfig.Paths.GradleProjectFile>
      ).mods?.android?.appBuildGradle as unknown as GradleModFunction;

      expect(gradleMod).toBeDefined();

      const initialGradle: AndroidConfig.Paths.GradleProjectFile = {
        contents: createBaseBuildGradle(),
        language: "groovy",
        path: "android/app/build.gradle",
      };

      const modResult = await gradleMod({
        modResults: initialGradle,
      });

      const isProduction = Env.EXPO_PUBLIC_APP_ENV === "production";
      if (isProduction) {
        expect(modResult.modResults.contents).toContain("splits {");
      } else {
        expect(modResult.modResults.contents).not.toContain("splits {");
      }
    });

    it("does not modify build.gradle if language is not groovy", async () => {
      const baseConfig: ExpoConfig = {
        name: "test-app",
        slug: "test-app",
      };

      const configured = withAbiSplits(baseConfig, { enabled: true });
      const gradleMod = (
        configured as ExportedConfigWithProps<AndroidConfig.Paths.GradleProjectFile>
      ).mods?.android?.appBuildGradle as unknown as GradleModFunction;

      const initialGradle: AndroidConfig.Paths.GradleProjectFile = {
        contents: createBaseBuildGradle(),
        language: "kt" as unknown as "groovy",
        path: "android/app/build.gradle.kts",
      };

      const modResult = await gradleMod({
        modResults: initialGradle,
      });

      expect(modResult.modResults.contents).toBe(initialGradle.contents);
    });
  });
});
