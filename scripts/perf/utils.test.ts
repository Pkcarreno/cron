import type { CommandExecutor, CommandResult } from "./types";
import {
  defaultExecutor,
  isDirectScriptExecution,
  resolveGitCommitSha,
} from "./utils";

interface RecordedCall {
  args: string[];
  command: string;
}

const createMockExecutor =
  (
    responses: Record<string, Partial<CommandResult>> = {},
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

describe("Performance Shared Utilities (scripts/perf/utils)", () => {
  describe("defaultExecutor", () => {
    it("executes echo command successfully and captures output", async () => {
      const result = await defaultExecutor("echo", ["hello"]);
      expect(result.exitCode).toBe(0);
      expect(result.stdout.trim()).toBe("hello");
      expect(result.stderr).toBe("");
    });

    it("captures non-zero exit code on command failure", async () => {
      const result = await defaultExecutor("node", [
        "-e",
        "\"process.stderr.write('fail'); process.exit(42);\"",
      ]);
      expect(result.exitCode).toBe(42);
      expect(result.stderr).toBe("fail");
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

  describe("resolveGitCommitSha", () => {
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

      const commit = await resolveGitCommitSha(executor, "custom-sha-123");

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

      await expect(resolveGitCommitSha(executor)).rejects.toThrow(
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

      await expect(resolveGitCommitSha(executor)).rejects.toThrow(
        /empty stdout returned by git/u
      );
    });
  });
});
