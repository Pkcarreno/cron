import fs from "node:fs";
import path from "node:path";

import {
  lockDisplayRefreshRate,
  measureBenchmark,
  parseCliArguments,
  parseCpuMetrics,
  parseGfxInfo,
  parseMeasureCliArgs,
  resolveScenarioName,
  runArtCompilation,
  runHardwareStabilization,
  runWarmupPass,
  setAirplaneMode,
} from "./measure";
import type { CommandExecutor, CommandResult } from "./types";
import { resolveGitCommitSha } from "./utils";

const resolveGitCommit = resolveGitCommitSha;

const createMockExecutor =
  (
    responses: Record<string, Partial<CommandResult>> = {},
    commandLog: string[] = []
  ): CommandExecutor =>
  (command: string, args: string[] = []) => {
    const fullCmd = [command, ...args].join(" ");
    commandLog.push(fullCmd);

    for (const [pattern, res] of Object.entries(responses)) {
      if (fullCmd.includes(pattern)) {
        return Promise.resolve({
          exitCode: res.exitCode ?? 0,
          stderr: res.stderr ?? "",
          stdout: res.stdout ?? "",
        });
      }
    }

    return Promise.resolve({
      exitCode: 0,
      stderr: "",
      stdout: "",
    });
  };

describe("Performance Measurement Runner (scripts/perf/measure)", () => {
  const testOutputDir = path.resolve(process.cwd(), "benchmark/test-results");

  afterEach(() => {
    if (fs.existsSync(testOutputDir)) {
      fs.rmSync(testOutputDir, { force: true, recursive: true });
    }
  });

  describe("Hardware Stabilization Functions", () => {
    it("lockDisplayRefreshRate sets min and peak refresh rate to target frequency", async () => {
      const commandLog: string[] = [];
      const executor = createMockExecutor({}, commandLog);

      await lockDisplayRefreshRate(executor, 60);

      expect(commandLog).toContain(
        "adb shell settings put system min_refresh_rate 60.0"
      );
      expect(commandLog).toContain(
        "adb shell settings put system peak_refresh_rate 60.0"
      );
    });

    it("lockDisplayRefreshRate supports 120 Hz and device serial targeting", async () => {
      const commandLog: string[] = [];
      const executor = createMockExecutor({}, commandLog);

      await lockDisplayRefreshRate(executor, 120, "emulator-5554");

      expect(commandLog).toContain(
        "adb -s emulator-5554 shell settings put system min_refresh_rate 120.0"
      );
      expect(commandLog).toContain(
        "adb -s emulator-5554 shell settings put system peak_refresh_rate 120.0"
      );
    });

    it("runArtCompilation compiles target package with speed filter", async () => {
      const commandLog: string[] = [];
      const executor = createMockExecutor({}, commandLog);

      await runArtCompilation(
        executor,
        "com.pkcarreno.cron.preview",
        "emulator-5554"
      );

      expect(commandLog).toContain(
        "adb -s emulator-5554 shell cmd package compile -m speed -f com.pkcarreno.cron.preview"
      );
    });

    it("setAirplaneMode enables and disables airplane mode via connectivity service", async () => {
      const commandLog: string[] = [];
      const executor = createMockExecutor({}, commandLog);

      await setAirplaneMode(executor, true, "emulator-5554");
      expect(commandLog).toContain(
        "adb -s emulator-5554 shell cmd connectivity airplane-mode enable"
      );

      await setAirplaneMode(executor, false, "emulator-5554");
      expect(commandLog).toContain(
        "adb -s emulator-5554 shell cmd connectivity airplane-mode disable"
      );
    });

    it("runWarmupPass executes unmeasured Maestro test run", async () => {
      const commandLog: string[] = [];
      const executor = createMockExecutor({}, commandLog);

      await runWarmupPass(
        executor,
        ".maestro/perf/thumbwheel-scroll.yaml",
        "maestro",
        "emulator-5554"
      );

      expect(commandLog).toContain(
        "maestro test --device emulator-5554 .maestro/perf/thumbwheel-scroll.yaml"
      );
    });
  });

  describe("Metric Parsers", () => {
    describe("parseGfxInfo", () => {
      it("extracts frame percentiles and jank percentage from dumpsys gfxinfo output", () => {
        const sampleOutput = `
** GRAPHICS INFO (TOTAL) **
Total frames rendered: 2450
Janky frames: 32 (1.31%)
50th percentile: 5ms
90th percentile: 8ms
95th percentile: 11ms
99th percentile: 14ms
Number Slow UI thread: 4
`;
        const metrics = parseGfxInfo(sampleOutput);

        expect(metrics.frameTime.p50Ms).toBe(5);
        expect(metrics.frameTime.p90Ms).toBe(8);
        expect(metrics.frameTime.p99Ms).toBe(14);
        expect(metrics.jankPercentage).toBe(1.31);
      });

      it("returns zeros when output lacks percentile indicators", () => {
        const metrics = parseGfxInfo("No graphics information found.");

        expect(metrics.frameTime.p50Ms).toBe(0);
        expect(metrics.frameTime.p90Ms).toBe(0);
        expect(metrics.frameTime.p99Ms).toBe(0);
        expect(metrics.jankPercentage).toBe(0);
      });
    });

    describe("parseCpuMetrics", () => {
      it("aggregates and computes average UI thread and mqt_js thread CPU", () => {
        const rawResult = {
          iterations: [
            {
              measures: [
                {
                  cpu: {
                    perName: {
                      "UI Thread": 10,
                      mqt_js: 6,
                      other_worker: 2,
                    },
                  },
                },
                {
                  cpu: {
                    perName: {
                      "UI Thread": 20,
                      mqt_js: 12,
                      other_worker: 4,
                    },
                  },
                },
              ],
            },
          ],
        };

        const metrics = parseCpuMetrics(rawResult);

        expect(metrics.uiThreadCpuPercent).toBe(15);
        expect(metrics.jsThreadCpuPercent).toBe(9);
        expect(metrics.totalCpuPercent).toBe(27);
      });

      it("supports mqt_v_js thread name under bridgeless architecture", () => {
        const rawResult = {
          iterations: [
            {
              measures: [
                {
                  cpu: {
                    perName: {
                      "UI Thread": 12,
                      mqt_v_js: 8,
                    },
                  },
                },
              ],
            },
          ],
        };

        const metrics = parseCpuMetrics(rawResult);
        expect(metrics.jsThreadCpuPercent).toBe(8);
        expect(metrics.uiThreadCpuPercent).toBe(12);
      });

      it("handles empty measures without NaN errors", () => {
        const metrics = parseCpuMetrics({ iterations: [] });

        expect(metrics.jsThreadCpuPercent).toBe(0);
        expect(metrics.uiThreadCpuPercent).toBe(0);
        expect(metrics.totalCpuPercent).toBe(0);
      });
    });

    describe("resolveScenarioName and resolveGitCommit", () => {
      it("extracts scenario name without path and yaml extensions", () => {
        expect(
          resolveScenarioName(".maestro/perf/thumbwheel-scroll.yaml")
        ).toBe("thumbwheel-scroll");
        expect(resolveScenarioName("menu-tabs-swipe.yml")).toBe(
          "menu-tabs-swipe"
        );
        expect(resolveScenarioName("timer-workout-run")).toBe(
          "timer-workout-run"
        );
      });

      it("queries current git commit hash via executor", async () => {
        const executor = createMockExecutor({
          "git rev-parse --short HEAD": {
            stdout: "faeb08d\n",
          },
        });

        const commit = await resolveGitCommitSha(executor);
        expect(commit).toBe("faeb08d");
        const commitAlias = await resolveGitCommit(executor);
        expect(commitAlias).toBe("faeb08d");
      });
    });
  });

  describe("runHardwareStabilization", () => {
    it("executes full hardware stabilization sequence with warmup and cooldown", async () => {
      const commandLog: string[] = [];
      const executor = createMockExecutor({}, commandLog);
      const sleepFn = jest.fn(() => Promise.resolve());

      await runHardwareStabilization({
        cooldownSleepMs: 5000,
        deviceId: "emulator-5554",
        executor,
        packageId: "com.pkcarreno.cron.preview",
        refreshRateHz: 60,
        scenarioPath: ".maestro/perf/thumbwheel-scroll.yaml",
        shouldWarmup: true,
        sleepFn,
      });

      expect(commandLog).toEqual([
        "adb -s emulator-5554 shell settings put system min_refresh_rate 60.0",
        "adb -s emulator-5554 shell settings put system peak_refresh_rate 60.0",
        "adb -s emulator-5554 shell cmd package compile -m speed -f com.pkcarreno.cron.preview",
        "adb -s emulator-5554 shell cmd connectivity airplane-mode enable",
        "maestro test --device emulator-5554 .maestro/perf/thumbwheel-scroll.yaml",
      ]);
      expect(sleepFn).toHaveBeenCalledWith(5000);
    });

    it("skips warmup and cooldown sleep when warmup is false", async () => {
      const commandLog: string[] = [];
      const executor = createMockExecutor({}, commandLog);
      const sleepFn = jest.fn(() => Promise.resolve());

      await runHardwareStabilization({
        deviceId: "emulator-5554",
        executor,
        packageId: "com.pkcarreno.cron.preview",
        refreshRateHz: 120,
        scenarioPath: ".maestro/perf/thumbwheel-scroll.yaml",
        shouldWarmup: false,
        sleepFn,
      });

      expect(commandLog).not.toContain(expect.stringContaining("maestro test"));
      expect(sleepFn).not.toHaveBeenCalled();
    });
  });

  describe("measureBenchmark", () => {
    const mockGfxInfoOutput = `
** GRAPHICS INFO (TOTAL) **
Total frames rendered: 1200
Janky frames: 12 (1.00%)
50th percentile: 6ms
90th percentile: 8ms
99th percentile: 13ms
`;

    const mockFlashlightJson = JSON.stringify({
      iterations: [
        {
          measures: [
            {
              cpu: {
                perName: {
                  "UI Thread": 14,
                  mqt_js: 8.5,
                },
              },
            },
          ],
        },
      ],
    });

    it("runs complete benchmark lifecycle and writes structured BenchmarkResult JSON", async () => {
      const commandLog: string[] = [];
      const executor = createMockExecutor(
        {
          "dumpsys gfxinfo": {
            stdout: mockGfxInfoOutput,
          },
          "getprop ro.product.model": {
            stdout: "Pixel 8 Pro\n",
          },
        },
        commandLog
      );

      // Custom executor behavior to simulate Flashlight writing resultsFilePath
      const customExecutor: CommandExecutor = (command, args = []) => {
        const fullCmd = [command, ...args].join(" ");
        if (fullCmd.includes("flashlight test")) {
          const resultsPathIndex = args.indexOf("--resultsFilePath");
          const targetPath = args[resultsPathIndex + 1];
          if (resultsPathIndex !== -1 && targetPath) {
            fs.mkdirSync(path.dirname(targetPath), {
              recursive: true,
            });
            fs.writeFileSync(targetPath, mockFlashlightJson);
          }
        }
        return executor(command, args);
      };

      const sleepFn = jest.fn(() => Promise.resolve());
      const reporter = jest.fn();

      const result = await measureBenchmark({
        cooldownSleepMs: 5000,
        customCommit: "testcommit123",
        deviceId: "emulator-5554",
        executor: customExecutor,
        iterationCount: 10,
        outputDirectory: testOutputDir,
        packageId: "com.pkcarreno.cron.preview",
        refreshRateHz: 60,
        reporter,
        scenarioPath: ".maestro/perf/thumbwheel-scroll.yaml",
        shouldWarmup: true,
        sleepFn,
      });

      expect(result.commit).toBe("testcommit123");
      expect(result.scenario).toBe("thumbwheel-scroll");
      expect(result.packageId).toBe("com.pkcarreno.cron.preview");
      expect(result.iterationCount).toBe(10);
      expect(result.hasWarmupExecuted).toBe(true);
      expect(result.device?.refreshRateHz).toBe(60);
      expect(result.device?.model).toBe("Pixel 8 Pro");
      expect(result.metrics.frameTime.p50Ms).toBe(6);
      expect(result.metrics.frameTime.p90Ms).toBe(8);
      expect(result.metrics.frameTime.p99Ms).toBe(13);
      expect(result.metrics.jankPercentage).toBe(1);
      expect(result.metrics.cpu.uiThreadCpuPercent).toBe(14);
      expect(result.metrics.cpu.jsThreadCpuPercent).toBe(8.5);

      const expectedJsonFile = path.join(
        testOutputDir,
        "thumbwheel-scroll-testcommit123.json"
      );
      expect(fs.existsSync(expectedJsonFile)).toBe(true);
      const writtenJson = JSON.parse(
        fs.readFileSync(expectedJsonFile, "utf-8")
      );
      expect(writtenJson.scenario).toBe("thumbwheel-scroll");
      expect(writtenJson.metrics.jankPercentage).toBe(1);

      // Verifies airplane mode was restored on completion
      expect(commandLog).toContain(
        "adb -s emulator-5554 shell cmd connectivity airplane-mode disable"
      );
    });

    it("restores airplane mode even when benchmark execution throws", async () => {
      const commandLog: string[] = [];
      const failingExecutor: CommandExecutor = (command, args = []) => {
        const full = [command, ...args].join(" ");
        commandLog.push(full);
        if (full.includes("flashlight test")) {
          return Promise.resolve({
            exitCode: 1,
            stderr: "Flashlight process crash",
            stdout: "",
          });
        }
        return Promise.resolve({ exitCode: 0, stderr: "", stdout: "" });
      };

      const sleepFn = jest.fn(() => Promise.resolve());

      await expect(
        measureBenchmark({
          customCommit: "failcommit",
          deviceId: "emulator-5554",
          executor: failingExecutor,
          outputDirectory: testOutputDir,
          reporter: jest.fn(),
          scenarioPath: ".maestro/perf/thumbwheel-scroll.yaml",
          sleepFn,
        })
      ).rejects.toThrow("Flashlight execution failed");

      expect(commandLog).toContain(
        "adb -s emulator-5554 shell cmd connectivity airplane-mode disable"
      );
    });

    it("falls back to sequential Maestro iterations and native telemetry when atrace is unsupported", async () => {
      const commandLog: string[] = [];
      const messages: string[] = [];

      const atraceFailingExecutor: CommandExecutor = (command, args = []) => {
        const full = [command, ...args].join(" ");
        commandLog.push(full);
        if (full.includes("flashlight test")) {
          return Promise.resolve({
            exitCode: 1,
            stderr:
              "Error: Did not find trace folder. Unable to find Atrace output file",
            stdout: "",
          });
        }
        if (full.includes("dumpsys gfxinfo")) {
          return Promise.resolve({
            exitCode: 0,
            stderr: "",
            stdout: mockGfxInfoOutput,
          });
        }
        if (full.includes("pidof")) {
          return Promise.resolve({
            exitCode: 0,
            stderr: "",
            stdout: "12345\n",
          });
        }
        if (full.includes("top -b -n 1")) {
          return Promise.resolve({
            exitCode: 0,
            stderr: "",
            stdout:
              "12345 u0 0 0 100M 50M 20M S 5.5 1.0 0:01 no.cron.preview com.pkcarreno.cron.preview\n12346 u0 0 0 100M 50M 20M S 4.0 1.0 0:01 mqt_v_js com.pkcarreno.cron.preview\n",
          });
        }
        return Promise.resolve({
          exitCode: 0,
          stderr: "",
          stdout: "fallback123\n",
        });
      };

      const result = await measureBenchmark({
        customCommit: "fallback123",
        executor: atraceFailingExecutor,
        iterationCount: 2,
        outputDirectory: testOutputDir,
        reporter: (msg) => messages.push(msg),
        scenarioPath: ".maestro/perf/thumbwheel-scroll.yaml",
        shouldSkipStabilization: true,
      });

      expect(result.metrics.frameTime.p50Ms).toBe(6);
      expect(result.metrics.jankPercentage).toBe(1);
      expect(result.metrics.cpu.uiThreadCpuPercent).toBe(5.5);
      expect(result.metrics.cpu.jsThreadCpuPercent).toBe(4);
      expect(
        messages.some((msg) =>
          msg.includes("Flashlight atrace profiler is unavailable")
        )
      ).toBe(true);
    });

    it("skips hardware stabilization when skipStabilization is true", async () => {
      const commandLog: string[] = [];
      const executor = createMockExecutor(
        {
          "dumpsys gfxinfo": {
            stdout: mockGfxInfoOutput,
          },
        },
        commandLog
      );

      const customExecutor: CommandExecutor = (command, args = []) => {
        const fullCmd = [command, ...args].join(" ");
        if (fullCmd.includes("flashlight test")) {
          const resultsPathIndex = args.indexOf("--resultsFilePath");
          const targetPath = args[resultsPathIndex + 1];
          if (resultsPathIndex !== -1 && targetPath) {
            fs.mkdirSync(path.dirname(targetPath), {
              recursive: true,
            });
            fs.writeFileSync(targetPath, mockFlashlightJson);
          }
        }
        return executor(command, args);
      };

      const result = await measureBenchmark({
        customCommit: "skipcommit",
        executor: customExecutor,
        outputDirectory: testOutputDir,
        reporter: jest.fn(),
        scenarioPath: ".maestro/perf/thumbwheel-scroll.yaml",
        shouldSkipStabilization: true,
      });

      expect(result.hasWarmupExecuted).toBe(false);
      expect(commandLog).not.toContain(
        expect.stringContaining("min_refresh_rate")
      );
      expect(commandLog).not.toContain(
        expect.stringContaining("airplane-mode enable")
      );
    });
  });

  describe("CLI Argument Parser", () => {
    it("provides defaults when no arguments are passed", () => {
      const options = parseMeasureCliArgs([]);

      expect(options.scenarioPath).toBe(".maestro/perf/thumbwheel-scroll.yaml");
      expect(options.shouldSkipStabilization).toBeUndefined();
      expect(options.shouldWarmup).toBeUndefined();
    });

    it("expands positional short scenario name into .maestro/perf/ path", () => {
      const options = parseCliArguments(["menu-tabs-swipe"]);

      expect(options.scenarioPath).toBe(
        path.join(".maestro/perf", "menu-tabs-swipe.yaml")
      );
    });

    it("parses comprehensive CLI flags", () => {
      const options = parseMeasureCliArgs([
        "--scenario",
        ".maestro/perf/timer-workout-run.yaml",
        "--package",
        "com.pkcarreno.cron.custom",
        "--device",
        "device-serial-99",
        "--output",
        "custom/results",
        "--refresh-rate",
        "120",
        "--iterations",
        "5",
        "--duration",
        "15000",
        "--skip-stabilization",
        "--no-warmup",
      ]);

      expect(options.scenarioPath).toBe(".maestro/perf/timer-workout-run.yaml");
      expect(options.packageId).toBe("com.pkcarreno.cron.custom");
      expect(options.deviceId).toBe("device-serial-99");
      expect(options.outputDirectory).toBe("custom/results");
      expect(options.refreshRateHz).toBe(120);
      expect(options.iterationCount).toBe(5);
      expect(options.durationMs).toBe(15_000);
      expect(options.shouldSkipStabilization).toBe(true);
      expect(options.shouldWarmup).toBe(false);
    });
  });
});
