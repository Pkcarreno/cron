import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

import type { CommandExecutor, CommandResult } from "./types";

const execFileAsync = promisify(execFile);

// 10MB buffer for build and trace outputs
const DEFAULT_MAX_BUFFER_BYTES = 10 * 1024 * 1024;

/**
 * Executes a system binary asynchronously without shell interpretation.
 * Captures exit status, stdout, and stderr.
 *
 * @param command - The executable binary name or path.
 * @param args - Array of command-line arguments.
 * @returns Exit code and output streams.
 */
export const defaultExecutor: CommandExecutor = async (
  command: string,
  args: string[] = []
): Promise<CommandResult> => {
  try {
    const { stderr, stdout } = await execFileAsync(command, args, {
      maxBuffer: DEFAULT_MAX_BUFFER_BYTES,
    });
    return {
      exitCode: 0,
      stderr: stderr.toString(),
      stdout: stdout.toString(),
    };
  } catch (error: unknown) {
    const commandError = error as {
      code?: number;
      stderr?: string;
      stdout?: string;
    };
    return {
      exitCode: commandError.code ?? 1,
      stderr: commandError.stderr?.toString() ?? String(error),
      stdout: commandError.stdout?.toString() ?? "",
    };
  }
};

/**
 * Determines whether a script module was executed directly from the command line.
 *
 * @param scriptPath - Absolute path of the target script module. Defaults to caller module filename.
 * @param processArgv - Process argument vector. Defaults to process.argv.
 * @returns True when executed directly. False when imported as a library.
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
 * Resolves the short git commit SHA for artifact tagging and benchmark metadata.
 *
 * If a custom commit SHA is provided, returns the trimmed custom value.
 * Otherwise, retrieves the short commit SHA with `git rev-parse --short HEAD`.
 *
 * @param executor - The command executor implementation.
 * @param customCommit - Optional commit SHA override.
 * @returns The resolved commit short SHA string.
 * @throws {Error} If git command execution fails or returns an empty commit hash.
 */
export const resolveGitCommitSha = async (
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
