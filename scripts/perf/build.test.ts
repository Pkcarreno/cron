import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  isPathInsideDirectory,
  parseBuildArgs,
  parseBuildCliArgs,
  runBuild,
  sanitizeTmpDir,
} from "./build";
import type { CommandExecutor, CommandResult } from "./types";
import { isDirectScriptExecution, resolveGitCommitSha } from "./utils";

const resolveCommitSha = resolveGitCommitSha;

interface RecordedCall {
  args: string[];
  command: string;
}

const createMockExecutor =
  (
    responses: Record<string, Partial<CommandResult>>,
    recordedCalls?: RecordedCall[]
  ): CommandExecutor =>
  (command: string, args: string[] = []): Promise<CommandResult> => {
    if (recordedCalls) {
      recordedCalls.push({ args, command });
    }
    const fullCmd = [command, ...args].join(" ");
    for (const [key, val] of Object.entries(responses)) {
      if (fullCmd.includes(key)) {
        return Promise.resolve({
          exitCode: val.exitCode ?? 0,
          stderr: val.stderr ?? "",
          stdout: val.stdout ?? "",
        });
      }
    }
    return Promise.resolve({
      exitCode: 1,
      stderr: `Unhandled command: ${fullCmd}`,
      stdout: "",
    });
  };

const throwingExecutor: CommandExecutor = () =>
  Promise.reject(new Error("Process spawn failure"));

describe("Performance Build Runner (scripts/perf/build)", () => {
  let tempTestDirectory: string;

  beforeEach(() => {
    tempTestDirectory = fs.mkdtempSync(
      path.join(os.tmpdir(), "cron-perf-build-test-")
    );
  });

  afterEach(() => {
    if (fs.existsSync(tempTestDirectory)) {
      fs.rmSync(tempTestDirectory, { force: true, recursive: true });
    }
  });

  describe("resolveCommitSha / resolveGitCommitSha", () => {
    it("retrieves short git commit SHA from git rev-parse", async () => {
      const calls: RecordedCall[] = [];
      const executor = createMockExecutor(
        {
          "git rev-parse --short HEAD": {
            exitCode: 0,
            stdout: "faeb08d\n",
          },
        },
        calls
      );

      const commit = await resolveGitCommitSha(executor);

      expect(commit).toBe("faeb08d");
      expect(calls).toHaveLength(1);
      expect(calls[0]).toEqual({
        args: ["rev-parse", "--short", "HEAD"],
        command: "git",
      });
    });

    it("uses custom commit override without running git", async () => {
      const calls: RecordedCall[] = [];
      const executor = createMockExecutor({}, calls);

      const commit = await resolveCommitSha(executor, "custom-sha-123");

      expect(commit).toBe("custom-sha-123");
      expect(calls).toHaveLength(0);
    });

    it("throws descriptive error when git rev-parse exits with failure", async () => {
      const executor = createMockExecutor({
        "git rev-parse": {
          exitCode: 128,
          stderr: "fatal: not a git repository",
        },
      });

      await expect(resolveCommitSha(executor)).rejects.toThrow(
        /Failed to resolve git commit SHA: fatal: not a git repository/u
      );
    });

    it("throws error when git returns empty commit output", async () => {
      const executor = createMockExecutor({
        "git rev-parse": {
          exitCode: 0,
          stdout: "   \n",
        },
      });

      await expect(resolveCommitSha(executor)).rejects.toThrow(
        /empty stdout returned by git/u
      );
    });
  });

  describe("parseBuildCliArgs", () => {
    it("returns default empty options for empty arguments", () => {
      const options = parseBuildCliArgs([]);
      expect(options).toEqual({});
    });

    it("parses --commit flag with space and equals separator", () => {
      expect(parseBuildCliArgs(["--commit", "a1b2c3d"])).toEqual({
        customCommit: "a1b2c3d",
      });
      expect(parseBuildCliArgs(["--commit=a1b2c3d"])).toEqual({
        customCommit: "a1b2c3d",
      });
    });

    it("parses --output directory flag with space and equals separator", () => {
      expect(parseBuildCliArgs(["--output", "custom/outputs"])).toEqual({
        outputDirectory: "custom/outputs",
      });
      expect(parseBuildCliArgs(["--output=custom/outputs"])).toEqual({
        outputDirectory: "custom/outputs",
      });
    });

    it("parses --clean flag", () => {
      expect(parseBuildCliArgs(["--clean"])).toEqual({
        shouldClean: true,
      });
      expect(parseBuildArgs(["--clean"])).toEqual({
        shouldClean: true,
      });
    });

    it("parses --profile flag", () => {
      expect(parseBuildCliArgs(["--profile", "development"])).toEqual({
        profile: "development",
      });
      expect(parseBuildCliArgs(["--profile=production"])).toEqual({
        profile: "production",
      });
    });

    it("parses --build-type flag", () => {
      expect(parseBuildCliArgs(["--build-type", "bundle"])).toEqual({
        buildType: "bundle",
      });
      expect(parseBuildCliArgs(["--type=apk"])).toEqual({
        buildType: "apk",
      });
    });

    it("parses --source-artifact flag", () => {
      expect(
        parseBuildCliArgs(["--source-artifact", "/tmp/prebuilt.apk"])
      ).toEqual({
        sourceArtifactPath: "/tmp/prebuilt.apk",
      });
      expect(
        parseBuildCliArgs(["--source-artifact=/tmp/prebuilt.apk"])
      ).toEqual({
        sourceArtifactPath: "/tmp/prebuilt.apk",
      });
    });

    it("combines multiple CLI flags into single options object", () => {
      const options = parseBuildCliArgs([
        "--commit",
        "faeb08d",
        "--output",
        "custom/out",
        "--clean",
        "--profile",
        "preview",
      ]);

      expect(options).toEqual({
        customCommit: "faeb08d",
        outputDirectory: "custom/out",
        profile: "preview",
        shouldClean: true,
      });
    });
  });

  describe("isPathInsideDirectory", () => {
    it("returns true when candidate path is equal to parent directory", () => {
      expect(isPathInsideDirectory("/home/user/cron", "/home/user/cron")).toBe(
        true
      );
    });

    it("returns true when candidate path is a subdirectory inside parent directory", () => {
      expect(
        isPathInsideDirectory("/home/user/cron", "/home/user/cron/.tmp")
      ).toBe(true);
      expect(
        isPathInsideDirectory("/home/user/cron", "/home/user/cron/sub/deep/dir")
      ).toBe(true);
    });

    it("returns false when candidate path shares prefix but is a sibling directory", () => {
      expect(
        isPathInsideDirectory("/home/user/cron", "/home/user/cron-tmp")
      ).toBe(false);
      expect(
        isPathInsideDirectory("/home/user/cron", "/home/user/cron-other")
      ).toBe(false);
    });

    it("returns false when candidate path is completely outside parent directory", () => {
      expect(isPathInsideDirectory("/home/user/cron", "/tmp")).toBe(false);
      expect(
        isPathInsideDirectory("/home/user/cron", "/var/tmp/cron-cache")
      ).toBe(false);
    });
  });

  describe("sanitizeTmpDir", () => {
    const originalTmpDir = process.env.TMPDIR;
    const originalTmp_Dir = process.env.TMP_DIR;

    afterEach(() => {
      if (originalTmpDir === undefined) {
        delete process.env.TMPDIR;
      } else {
        process.env.TMPDIR = originalTmpDir;
      }
      if (originalTmp_Dir === undefined) {
        delete process.env.TMP_DIR;
      } else {
        process.env.TMP_DIR = originalTmp_Dir;
      }
    });

    it("leaves TMPDIR untouched when pointing to an external directory", () => {
      process.env.TMPDIR = path.resolve(process.cwd(), "..", "cron-tmp");
      sanitizeTmpDir();
      expect(process.env.TMPDIR).toBe(
        path.resolve(process.cwd(), "..", "cron-tmp")
      );
    });

    it("respects TMP_DIR when set to an external directory", () => {
      process.env.TMP_DIR = path.resolve(process.cwd(), "..", "cron-tmp");
      sanitizeTmpDir();
      expect(process.env.TMPDIR).toBe(
        path.resolve(process.cwd(), "..", "cron-tmp")
      );
    });

    it("redirects TMPDIR to os.tmpdir when pointing inside repository", () => {
      const messages: string[] = [];
      process.env.TMPDIR = path.resolve(process.cwd(), ".tmp");
      sanitizeTmpDir((msg) => messages.push(msg));
      expect(process.env.TMPDIR).toBe(os.tmpdir());
      expect(
        messages.some((msg) => msg.includes("TMPDIR points inside repository"))
      ).toBe(true);
    });

    it("handles undefined TMPDIR gracefully without modifying environment", () => {
      delete process.env.TMPDIR;
      delete process.env.TMP_DIR;
      sanitizeTmpDir();
      expect(process.env.TMPDIR).toBeUndefined();
    });
  });

  describe("isDirectScriptExecution", () => {
    it("returns true when process argument matches script path", () => {
      const script = "/home/pk/cron/scripts/perf/build.ts";
      const argv = ["node", "/home/pk/cron/scripts/perf/build.ts"];
      expect(isDirectScriptExecution(script, argv)).toBe(true);
    });

    it("returns false when executed via test runner or secondary module", () => {
      const script = "/home/pk/cron/scripts/perf/build.ts";
      const argv = ["node", "/home/pk/cron/node_modules/jest/bin/jest.js"];
      expect(isDirectScriptExecution(script, argv)).toBe(false);
    });

    it("returns false when argv[1] is undefined", () => {
      const script = "/home/pk/cron/scripts/perf/build.ts";
      expect(isDirectScriptExecution(script, ["node"])).toBe(false);
    });
  });

  describe("runBuild", () => {
    it("builds preview APK with default configuration and commit tagging", async () => {
      const calls: RecordedCall[] = [];
      const messages: string[] = [];
      const outputDir = path.join(tempTestDirectory, "outputs");

      const executor = createMockExecutor(
        {
          "eas build": {
            exitCode: 0,
            stdout: "Build completed successfully",
          },
          "git rev-parse": {
            exitCode: 0,
            stdout: "9c3f4e1\n",
          },
        },
        calls
      );

      const result = await runBuild({
        executor,
        outputDirectory: outputDir,
        reporter: (msg) => messages.push(msg),
      });

      expect(result.isSuccess).toBe(true);
      expect(result.commit).toBe("9c3f4e1");
      expect(result.artifactPath).toBe(
        path.join(outputDir, "cron-9c3f4e1.apk")
      );
      expect(fs.existsSync(outputDir)).toBe(true);

      expect(calls).toHaveLength(2);
      expect(calls[0]).toEqual({
        args: ["rev-parse", "--short", "HEAD"],
        command: "git",
      });
      expect(calls[1].command).toBe("eas");
      expect(calls[1].args).toEqual([
        "build",
        "--profile",
        "preview",
        "--platform",
        "android",
        "--local",
        "--output",
        path.join(outputDir, "cron-9c3f4e1.apk"),
      ]);

      expect(messages.some((m) => m.includes("9c3f4e1"))).toBe(true);
      expect(messages.some((m) => m.includes("successfully"))).toBe(true);
    });

    it("supports custom commit override without git query", async () => {
      const calls: RecordedCall[] = [];
      const outputDir = path.join(tempTestDirectory, "custom-outputs");

      const executor = createMockExecutor(
        {
          "eas build": { exitCode: 0, stdout: "Build OK" },
        },
        calls
      );

      const result = await runBuild({
        customCommit: "release-v1",
        executor,
        outputDirectory: outputDir,
        reporter: () => {},
      });

      expect(result.isSuccess).toBe(true);
      expect(result.commit).toBe("release-v1");
      expect(result.artifactPath).toBe(
        path.join(outputDir, "cron-release-v1.apk")
      );

      // git was not called
      expect(calls.some((call) => call.command === "git")).toBe(false);
      expect(calls).toHaveLength(1);
    });

    it("creates output directory recursively if it does not exist", async () => {
      const nestedDir = path.join(
        tempTestDirectory,
        "deep",
        "nested",
        "outputs"
      );
      expect(fs.existsSync(nestedDir)).toBe(false);

      const executor = createMockExecutor({
        "eas build": { exitCode: 0, stdout: "OK" },
        "git rev-parse": { exitCode: 0, stdout: "1122334\n" },
      });

      const result = await runBuild({
        executor,
        outputDirectory: nestedDir,
        reporter: () => {},
      });

      expect(result.isSuccess).toBe(true);
      expect(fs.existsSync(nestedDir)).toBe(true);
    });

    it("passes --clear-cache to EAS command when clean option is enabled", async () => {
      const calls: RecordedCall[] = [];
      const outputDir = path.join(tempTestDirectory, "outputs");

      const executor = createMockExecutor(
        {
          "eas build": { exitCode: 0, stdout: "Clean build done" },
          "git rev-parse": { exitCode: 0, stdout: "clean123\n" },
        },
        calls
      );

      const result = await runBuild({
        executor,
        outputDirectory: outputDir,
        reporter: () => {},
        shouldClean: true,
      });

      expect(result.isSuccess).toBe(true);
      const easCall = calls.find((call) => call.command === "eas");
      expect(easCall).toBeDefined();
      expect(easCall?.args).toContain("--clear-cache");
    });

    it("passes custom profile to EAS command", async () => {
      const calls: RecordedCall[] = [];
      const outputDir = path.join(tempTestDirectory, "outputs");

      const executor = createMockExecutor(
        {
          "eas build": { exitCode: 0, stdout: "Production build OK" },
          "git rev-parse": { exitCode: 0, stdout: "prod456\n" },
        },
        calls
      );

      const result = await runBuild({
        executor,
        outputDirectory: outputDir,
        profile: "production",
        reporter: () => {},
      });

      expect(result.isSuccess).toBe(true);
      const easCall = calls.find((call) => call.command === "eas");
      expect(easCall).toBeDefined();
      expect(easCall?.args).toContain("production");
    });

    it("handles git commit resolution failure gracefully", async () => {
      const messages: string[] = [];
      const executor = createMockExecutor({
        "git rev-parse": {
          exitCode: 1,
          stderr: "Not a git repo",
        },
      });

      const result = await runBuild({
        executor,
        outputDirectory: tempTestDirectory,
        reporter: (msg) => messages.push(msg),
      });

      expect(result.isSuccess).toBe(false);
      expect(result.commit).toBe("");
      expect(
        messages.some((msg) => msg.includes("Failed to resolve git commit"))
      ).toBe(true);
    });

    it("handles EAS build process failure gracefully", async () => {
      const messages: string[] = [];
      const executor = createMockExecutor({
        "eas build": {
          exitCode: 1,
          stderr: "Gradle build failed with errors",
        },
        "git rev-parse": {
          exitCode: 0,
          stdout: "faeb08d\n",
        },
      });

      const result = await runBuild({
        executor,
        outputDirectory: tempTestDirectory,
        reporter: (msg) => messages.push(msg),
      });

      expect(result.isSuccess).toBe(false);
      expect(result.commit).toBe("faeb08d");
      expect(
        messages.some((msg) => msg.includes("Gradle build failed with errors"))
      ).toBe(true);
    });

    it("handles executor unexpected exception thrown during execution", async () => {
      const messages: string[] = [];

      const result = await runBuild({
        executor: throwingExecutor,
        outputDirectory: tempTestDirectory,
        reporter: (msg) => messages.push(msg),
      });

      expect(result.isSuccess).toBe(false);
      expect(
        messages.some((msg) => msg.includes("Process spawn failure"))
      ).toBe(true);
    });

    it("copies source artifact to destination when sourceArtifactPath is provided", async () => {
      const outputDir = path.join(tempTestDirectory, "copied-output");
      const dummySourceApk = path.join(tempTestDirectory, "original.apk");
      fs.writeFileSync(dummySourceApk, "DUMMY_APK_DATA");

      const executor = createMockExecutor({
        "eas build": { exitCode: 0, stdout: "OK" },
        "git rev-parse": { exitCode: 0, stdout: "copy123\n" },
      });

      const result = await runBuild({
        executor,
        outputDirectory: outputDir,
        reporter: () => {},
        sourceArtifactPath: dummySourceApk,
      });

      expect(result.isSuccess).toBe(true);
      expect(fs.existsSync(result.artifactPath)).toBe(true);
      expect(fs.readFileSync(result.artifactPath, "utf-8")).toBe(
        "DUMMY_APK_DATA"
      );
    });

    it("returns failure when sourceArtifactPath does not exist on disk", async () => {
      const messages: string[] = [];
      const executor = createMockExecutor({
        "git rev-parse": { exitCode: 0, stdout: "fail123\n" },
      });

      const result = await runBuild({
        executor,
        outputDirectory: tempTestDirectory,
        reporter: (msg) => messages.push(msg),
        sourceArtifactPath: "/path/that/does/not/exist.apk",
      });

      expect(result.isSuccess).toBe(false);
      expect(
        messages.some((msg) => msg.includes("Source artifact not found"))
      ).toBe(true);
    });
  });
});
