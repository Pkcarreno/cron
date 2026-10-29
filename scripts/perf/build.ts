import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import type {
  BuildOptions,
  BuildResult,
  CommandExecutor,
  CommandResult,
} from "./types";
import {
  defaultExecutor,
  isDirectScriptExecution,
  resolveGitCommitSha,
} from "./utils";

type BuildProfile = "preview" | "development" | "production";
type BuildType = "apk" | "bundle";

const isBuildProfile = (
  profileCandidate: string
): profileCandidate is BuildProfile =>
  profileCandidate === "preview" ||
  profileCandidate === "development" ||
  profileCandidate === "production";

const isBuildType = (
  buildTypeCandidate: string
): buildTypeCandidate is BuildType =>
  buildTypeCandidate === "apk" || buildTypeCandidate === "bundle";

const parseProfileAndTypeArgs = (
  argv: string[],
  currentIndex: number,
  options: BuildOptions
): number => {
  const arg = argv[currentIndex] ?? "";

  if (arg.startsWith("--profile=")) {
    const profileCandidate = arg.slice("--profile=".length).trim();
    if (isBuildProfile(profileCandidate)) {
      options.profile = profileCandidate;
    }
    return currentIndex;
  }

  if (arg === "--profile" && currentIndex + 1 < argv.length) {
    const profileCandidate = argv[currentIndex + 1]?.trim() ?? "";
    if (isBuildProfile(profileCandidate)) {
      options.profile = profileCandidate;
    }
    return currentIndex + 1;
  }

  if (arg.startsWith("--build-type=") || arg.startsWith("--type=")) {
    const buildTypeCandidate = arg.split("=")[1]?.trim() ?? "";
    if (isBuildType(buildTypeCandidate)) {
      options.buildType = buildTypeCandidate;
    }
    return currentIndex;
  }

  if (
    (arg === "--build-type" || arg === "--type") &&
    currentIndex + 1 < argv.length
  ) {
    const buildTypeCandidate = argv[currentIndex + 1]?.trim() ?? "";
    if (isBuildType(buildTypeCandidate)) {
      options.buildType = buildTypeCandidate;
    }
    return currentIndex + 1;
  }

  return currentIndex;
};

/**
 * Parses CLI arguments into typed BuildOptions.
 *
 * Supported flags:
 * - `--commit <sha>` or `--commit=<sha>`
 * - `--output <dir>` or `--output=<dir>`
 * - `--clean`
 * - `--profile <profile>` or `--profile=<profile>`
 * - `--build-type <type>` or `--type=<type>`
 *
 * @param argv - Argument array excluding node and script paths.
 * @returns Parsed build options.
 */
export const parseBuildCliArgs = (argv: string[]): BuildOptions => {
  const options: BuildOptions = {};
  let i = 0;

  while (i < argv.length) {
    const arg = argv[i] ?? "";

    if (arg === "--clean") {
      options.shouldClean = true;
    } else if (arg.startsWith("--commit=")) {
      options.customCommit = arg.slice("--commit=".length).trim();
    } else if (arg === "--commit" && i + 1 < argv.length) {
      i += 1;
      options.customCommit = argv[i]?.trim();
    } else if (arg.startsWith("--output=")) {
      options.outputDirectory = arg.slice("--output=".length).trim();
    } else if (arg === "--output" && i + 1 < argv.length) {
      i += 1;
      options.outputDirectory = argv[i]?.trim();
    } else if (arg.startsWith("--source-artifact=")) {
      options.sourceArtifactPath = arg
        .slice("--source-artifact=".length)
        .trim();
    } else if (arg === "--source-artifact" && i + 1 < argv.length) {
      i += 1;
      options.sourceArtifactPath = argv[i]?.trim();
    } else {
      i = parseProfileAndTypeArgs(argv, i, options);
    }

    i += 1;
  }

  return options;
};

export const parseBuildArgs = parseBuildCliArgs;

/**
 * Verifies whether candidatePath is identical to parentDir or located inside parentDir.
 *
 * @param parentDir - The parent directory path.
 * @param candidatePath - The candidate directory or file path.
 * @returns True if candidatePath is equal to or located inside parentDir.
 */
export const isPathInsideDirectory = (
  parentDir: string,
  candidatePath: string
): boolean => {
  const relative = path.relative(parentDir, candidatePath);
  return (
    relative === "" ||
    (!relative.startsWith("..") && !path.isAbsolute(relative))
  );
};

export const sanitizeTmpDir = (reporter?: (message: string) => void): void => {
  const currentTmpDir = process.env.TMP_DIR ?? process.env.TMPDIR;
  if (!currentTmpDir) {
    return;
  }

  const resolvedTmpDir = path.resolve(currentTmpDir);
  const resolvedCwd = path.resolve(process.cwd());

  if (isPathInsideDirectory(resolvedCwd, resolvedTmpDir)) {
    const fallbackTmpDir = os.tmpdir();
    reporter?.(
      `[perf:build] Warning: TMPDIR points inside repository (${resolvedTmpDir}). Redirecting to ${fallbackTmpDir} to prevent EAS self-nesting error.`
    );
    process.env.TMPDIR = fallbackTmpDir;
    process.env.TMP_DIR = fallbackTmpDir;
  } else {
    if (!fs.existsSync(resolvedTmpDir)) {
      fs.mkdirSync(resolvedTmpDir, { recursive: true });
    }
    process.env.TMPDIR = resolvedTmpDir;
    process.env.TMP_DIR = resolvedTmpDir;
  }
};

interface ArtifactPaths {
  targetArtifactPath: string;
  targetDirectory: string;
}

const resolveArtifactPaths = (
  outputDirectory: string | undefined,
  commitSha: string
): ArtifactPaths => {
  const defaultOutputDir = path.resolve(process.cwd(), "benchmark", "outputs");
  const rawOutputDir = outputDirectory
    ? path.resolve(process.cwd(), outputDirectory)
    : defaultOutputDir;

  const isApkPath = rawOutputDir.endsWith(".apk");
  const targetDirectory = isApkPath ? path.dirname(rawOutputDir) : rawOutputDir;
  const targetArtifactPath = isApkPath
    ? rawOutputDir
    : path.join(targetDirectory, `cron-${commitSha}.apk`);

  return { targetArtifactPath, targetDirectory };
};

const executeEasBuild = async (
  executor: CommandExecutor,
  args: string[],
  targetArtifactPath: string,
  commitSha: string,
  reporter: (message: string) => void
): Promise<BuildResult> => {
  reporter(`[perf:build] Executing preview build: eas ${args.join(" ")}`);

  let buildResult: CommandResult;
  try {
    buildResult = await executor("eas", args);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    reporter(`[perf:build] Build command execution threw an error: ${message}`);
    return {
      artifactPath: targetArtifactPath,
      commit: commitSha,
      isSuccess: false,
    };
  }

  if (buildResult.exitCode !== 0) {
    const errorOutput =
      buildResult.stderr.trim() ||
      buildResult.stdout.trim() ||
      `exit code ${buildResult.exitCode}`;
    reporter(
      `[perf:build] Preview APK build failed with errors: ${errorOutput}`
    );
    return {
      artifactPath: targetArtifactPath,
      commit: commitSha,
      isSuccess: false,
    };
  }

  reporter(
    `[perf:build] Preview APK built successfully: ${targetArtifactPath}`
  );
  return {
    artifactPath: targetArtifactPath,
    commit: commitSha,
    isSuccess: true,
  };
};

/**
 * Compiles a preview APK tagged by git commit and stores it in the benchmark output directory.
 *
 * @param options - Build configuration options.
 * @returns Build result containing artifact path, commit SHA, and success status.
 */
export const runBuild = async (
  options: BuildOptions = {}
): Promise<BuildResult> => {
  const executor = options.executor ?? defaultExecutor;
  const reporter = options.reporter ?? console.log;
  const profile = options.profile ?? "preview";

  sanitizeTmpDir(reporter);

  let commitSha = "";
  try {
    reporter("[perf:build] Resolving git commit short SHA...");
    commitSha = await resolveGitCommitSha(executor, options.customCommit);
    reporter(`[perf:build] Using commit SHA: ${commitSha}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    reporter(`[perf:build] Failed to resolve git commit SHA: ${message}`);
    return {
      artifactPath: "",
      commit: "",
      isSuccess: false,
    };
  }

  const { targetArtifactPath, targetDirectory } = resolveArtifactPaths(
    options.outputDirectory,
    commitSha
  );

  if (!fs.existsSync(targetDirectory)) {
    reporter(`[perf:build] Creating output directory: ${targetDirectory}`);
    fs.mkdirSync(targetDirectory, { recursive: true });
  }

  if (options.sourceArtifactPath) {
    if (!fs.existsSync(options.sourceArtifactPath)) {
      reporter(
        `[perf:build] Source artifact not found at: ${options.sourceArtifactPath}`
      );
      return {
        artifactPath: targetArtifactPath,
        commit: commitSha,
        isSuccess: false,
      };
    }

    reporter(
      `[perf:build] Copying source artifact from ${options.sourceArtifactPath} to ${targetArtifactPath}`
    );
    fs.copyFileSync(options.sourceArtifactPath, targetArtifactPath);
    reporter(
      `[perf:build] Preview APK prepared successfully: ${targetArtifactPath}`
    );
    return {
      artifactPath: targetArtifactPath,
      commit: commitSha,
      isSuccess: true,
    };
  }

  const args: string[] = [
    "build",
    "--profile",
    profile,
    "--platform",
    "android",
    "--local",
  ];

  if (options.shouldClean) {
    reporter("[perf:build] Clean build requested. Cache will be cleared.");
    args.push("--clear-cache");
  }

  args.push("--output", targetArtifactPath);

  return executeEasBuild(
    executor,
    args,
    targetArtifactPath,
    commitSha,
    reporter
  );
};

if (isDirectScriptExecution(import.meta.filename)) {
  void (async () => {
    try {
      const parsedOptions = parseBuildCliArgs(process.argv.slice(2));
      const outcome = await runBuild(parsedOptions);
      process.exit(outcome.isSuccess ? 0 : 1);
    } catch (error) {
      console.error("[perf:build] Fatal error during build execution:", error);
      process.exit(1);
    }
  })();
}
