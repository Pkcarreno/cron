import { exec } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

import type {
  BuildOptions,
  BuildResult,
  CommandExecutor,
  CommandResult,
} from "./types";

const execAsync = promisify(exec);

type BuildProfile = "preview" | "development" | "production";
type BuildType = "apk" | "bundle";

const isBuildProfile = (val: string): val is BuildProfile =>
  val === "preview" || val === "development" || val === "production";

const isBuildType = (val: string): val is BuildType =>
  val === "apk" || val === "bundle";

/**
 * Executes a system command asynchronously and captures exit status, stdout, and stderr.
 *
 * @param command - The base executable name or path.
 * @param args - Array of command-line arguments.
 * @returns Exit code and output streams.
 */
export const defaultExecutor: CommandExecutor = async (
  command: string,
  args: string[] = []
): Promise<CommandResult> => {
  const fullCommand = [command, ...args].join(" ");
  try {
    const { stderr, stdout } = await execAsync(fullCommand);
    return {
      exitCode: 0,
      stderr: stderr.toString(),
      stdout: stdout.toString(),
    };
  } catch (error: unknown) {
    const err = error as { code?: number; stderr?: string; stdout?: string };
    return {
      exitCode: err.code ?? 1,
      stderr: err.stderr?.toString() ?? String(error),
      stdout: err.stdout?.toString() ?? "",
    };
  }
};

/**
 * Resolves the short git commit SHA for artifact tagging.
 *
 * If a custom commit SHA is specified, returns the custom value.
 * Otherwise, retrieves the short SHA using `git rev-parse --short HEAD`.
 *
 * @param executor - The command executor implementation.
 * @param customCommit - Optional commit SHA override.
 * @returns The resolved commit short SHA string.
 */
export const resolveCommitSha = async (
  executor: CommandExecutor,
  customCommit?: string
): Promise<string> => {
  if (customCommit && customCommit.trim().length > 0) {
    return customCommit.trim();
  }

  const result = await executor("git", ["rev-parse", "--short", "HEAD"]);
  if (result.exitCode !== 0) {
    const errorDetail =
      result.stderr.trim() || result.stdout.trim() || "Unknown git error";
    throw new Error(`Failed to resolve git commit SHA: ${errorDetail}`);
  }

  const sha = result.stdout.trim();
  if (!sha) {
    throw new Error(
      "Failed to resolve git commit SHA: empty stdout returned by git"
    );
  }

  return sha;
};

const parseProfileAndTypeArgs = (
  argv: string[],
  currentIndex: number,
  options: BuildOptions
): number => {
  const arg = argv[currentIndex] ?? "";

  if (arg.startsWith("--profile=")) {
    const val = arg.slice("--profile=".length).trim();
    if (isBuildProfile(val)) {
      options.profile = val;
    }
    return currentIndex;
  }

  if (arg === "--profile" && currentIndex + 1 < argv.length) {
    const nextVal = argv[currentIndex + 1]?.trim() ?? "";
    if (isBuildProfile(nextVal)) {
      options.profile = nextVal;
    }
    return currentIndex + 1;
  }

  if (arg.startsWith("--build-type=") || arg.startsWith("--type=")) {
    const val = arg.split("=")[1]?.trim() ?? "";
    if (isBuildType(val)) {
      options.buildType = val;
    }
    return currentIndex;
  }

  if (
    (arg === "--build-type" || arg === "--type") &&
    currentIndex + 1 < argv.length
  ) {
    const nextVal = argv[currentIndex + 1]?.trim() ?? "";
    if (isBuildType(nextVal)) {
      options.buildType = nextVal;
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
export const parseBuildArgs = (argv: string[]): BuildOptions => {
  const options: BuildOptions = {};
  let i = 0;

  while (i < argv.length) {
    const arg = argv[i] ?? "";

    if (arg === "--clean") {
      options.clean = true;
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
    } else {
      i = parseProfileAndTypeArgs(argv, i, options);
    }

    i += 1;
  }

  return options;
};

/**
 * Determines whether the script was executed directly from the command line.
 *
 * @param scriptPath - Absolute path of this module.
 * @param processArgv - Process argument vector.
 * @returns True when executed directly; false when imported as a library.
 */
export const isDirectScriptExecution = (
  scriptPath?: string,
  processArgv: string[] = process.argv
): boolean => {
  const targetScript = scriptPath ?? import.meta.filename;
  if (!targetScript || !processArgv[1]) {
    return false;
  }
  return path.resolve(targetScript) === path.resolve(processArgv[1]);
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

  let commitSha = "";
  try {
    reporter("[perf:build] Resolving git commit short SHA...");
    commitSha = await resolveCommitSha(executor, options.customCommit);
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

  const defaultOutputDir = path.resolve(process.cwd(), "benchmark", "outputs");
  const rawOutputDir = options.outputDirectory
    ? path.resolve(process.cwd(), options.outputDirectory)
    : defaultOutputDir;

  const isApkPath = rawOutputDir.endsWith(".apk");
  const targetDirectory = isApkPath ? path.dirname(rawOutputDir) : rawOutputDir;
  const targetArtifactPath = isApkPath
    ? rawOutputDir
    : path.join(targetDirectory, `cron-${commitSha}.apk`);

  if (!fs.existsSync(targetDirectory)) {
    reporter(`[perf:build] Creating output directory: ${targetDirectory}`);
    fs.mkdirSync(targetDirectory, { recursive: true });
  }

  const args: string[] = [
    "build",
    "--profile",
    profile,
    "--platform",
    "android",
    "--local",
  ];

  if (options.clean) {
    reporter("[perf:build] Clean build requested. Cache will be cleared.");
    args.push("--clear-cache");
  }

  args.push("--output", targetArtifactPath);

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

  if (options.sourceArtifactPath && fs.existsSync(options.sourceArtifactPath)) {
    reporter(
      `[perf:build] Copying source artifact from ${options.sourceArtifactPath} to ${targetArtifactPath}`
    );
    fs.copyFileSync(options.sourceArtifactPath, targetArtifactPath);
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

if (isDirectScriptExecution()) {
  void (async () => {
    try {
      const parsedOptions = parseBuildArgs(process.argv.slice(2));
      const outcome = await runBuild(parsedOptions);
      process.exit(outcome.isSuccess ? 0 : 1);
    } catch (error) {
      console.error("[perf:build] Fatal error during build execution:", error);
      process.exit(1);
    }
  })();
}
