import {
  checkAdbInstalled,
  checkConnectedDevice,
  checkDisplayRefreshRate,
  checkFlashlightInstalled,
  checkMaestroInstalled,
  parseRefreshRate,
  runDoctor,
} from "./doctor";
import type { CommandExecutor } from "./doctor";

const createMockExecutor =
  (
    responses: Record<
      string,
      { exitCode: number; stderr: string; stdout: string }
    >
  ): CommandExecutor =>
  (command: string, args: string[] = []) => {
    const fullCmd = [command, ...args].join(" ");
    for (const [key, val] of Object.entries(responses)) {
      if (fullCmd.includes(key)) {
        return Promise.resolve(val);
      }
    }
    return Promise.resolve({
      exitCode: 1,
      stderr: `Command not found: ${fullCmd}`,
      stdout: "",
    });
  };

describe("Performance Doctor (scripts/perf/doctor)", () => {
  describe("checkAdbInstalled", () => {
    it("reports ok when adb is available", async () => {
      const executor = createMockExecutor({
        "adb version": {
          exitCode: 0,
          stderr: "",
          stdout: "Android Debug Bridge version 1.0.41",
        },
      });

      const result = await checkAdbInstalled(executor);
      expect(result.isOk).toBe(true);
      expect(result.message).toContain("Android Debug Bridge version 1.0.41");
    });

    it("reports failure and actionable remediation when adb is missing", async () => {
      const executor = createMockExecutor({});

      const result = await checkAdbInstalled(executor);
      expect(result.isOk).toBe(false);
      expect(result.remediation).toBeDefined();
      expect(result.remediation).toContain("Android SDK Platform-Tools");
    });
  });

  describe("checkConnectedDevice", () => {
    it("reports ok and returns device ID when an active device is connected", async () => {
      const executor = createMockExecutor({
        "adb devices": {
          exitCode: 0,
          stderr: "",
          stdout: "List of devices attached\nemulator-5554\tdevice\n\n",
        },
      });

      const result = await checkConnectedDevice(executor);
      expect(result.isOk).toBe(true);
      expect(result.deviceId).toBe("emulator-5554");
      expect(result.message).toContain("emulator-5554");
    });

    it("reports failure when device is unauthorized", async () => {
      const executor = createMockExecutor({
        "adb devices": {
          exitCode: 0,
          stderr: "",
          stdout: "List of devices attached\nemulator-5554\tunauthorized\n\n",
        },
      });

      const result = await checkConnectedDevice(executor);
      expect(result.isOk).toBe(false);
      expect(result.remediation).toContain("USB debugging");
    });

    it("reports failure when no devices are connected", async () => {
      const executor = createMockExecutor({
        "adb devices": {
          exitCode: 0,
          stderr: "",
          stdout: "List of devices attached\n\n",
        },
      });

      const result = await checkConnectedDevice(executor);
      expect(result.isOk).toBe(false);
      expect(result.remediation).toContain("emulator");
    });
  });

  describe("parseRefreshRate", () => {
    it("parses 60.0 fps from dumpsys output", () => {
      const dumpsys = "DisplayDeviceInfo{... 1080 x 2400, 60.000004 fps, ...}";
      const parsed = parseRefreshRate(dumpsys);
      expect(parsed?.rateHz).toBe(60);
      expect(parsed?.isVariable).toBe(false);
    });

    it("parses 120.0 fps from dumpsys output", () => {
      const dumpsys = "DisplayDeviceInfo{... 1440 x 3120, 120.0 fps, ...}";
      const parsed = parseRefreshRate(dumpsys);
      expect(parsed?.rateHz).toBe(120);
      expect(parsed?.isVariable).toBe(false);
    });

    it("detects variable refresh rate when min and peak rates differ", () => {
      const parsed = parseRefreshRate("", { min: "60.0", peak: "120.0" });
      expect(parsed?.isVariable).toBe(true);
      expect(parsed?.rateHz).toBe(120);
    });

    it("identifies locked 60 Hz when min and peak match", () => {
      const parsed = parseRefreshRate("", { min: "60.0", peak: "60.0" });
      expect(parsed?.isLocked).toBe(true);
      expect(parsed?.isVariable).toBe(false);
      expect(parsed?.rateHz).toBe(60);
    });
  });

  describe("checkDisplayRefreshRate", () => {
    it("reports failure when deviceId is missing", async () => {
      const executor = createMockExecutor({});
      const result = await checkDisplayRefreshRate(executor);

      expect(result.isOk).toBe(false);
      expect(result.message).toContain("No active connected Android device");
    });

    it("reports ok when display refresh rate is 60 Hz", async () => {
      const executor = createMockExecutor({
        "dumpsys display": {
          exitCode: 0,
          stderr: "",
          stdout: "1080 x 2400, 60.0 fps",
        },
        "settings get system min_refresh_rate": {
          exitCode: 0,
          stderr: "",
          stdout: "60.0\n",
        },
        "settings get system peak_refresh_rate": {
          exitCode: 0,
          stderr: "",
          stdout: "60.0\n",
        },
      });

      const result = await checkDisplayRefreshRate(executor, "emulator-5554");
      expect(result.isOk).toBe(true);
      expect(result.message).toContain("60 Hz");
    });

    it("reports ok when display refresh rate is 120 Hz", async () => {
      const executor = createMockExecutor({
        "dumpsys display": {
          exitCode: 0,
          stderr: "",
          stdout: "1440 x 3120, 120.0 fps",
        },
        "settings get system min_refresh_rate": {
          exitCode: 0,
          stderr: "",
          stdout: "120.0\n",
        },
        "settings get system peak_refresh_rate": {
          exitCode: 0,
          stderr: "",
          stdout: "120.0\n",
        },
      });

      const result = await checkDisplayRefreshRate(executor, "emulator-5554");
      expect(result.isOk).toBe(true);
      expect(result.message).toContain("120 Hz");
    });

    it("reports failure and actionable lock command when refresh rate is variable", async () => {
      const executor = createMockExecutor({
        "dumpsys display": {
          exitCode: 0,
          stderr: "",
          stdout: "variable fps",
        },
        "settings get system min_refresh_rate": {
          exitCode: 0,
          stderr: "",
          stdout: "60.0\n",
        },
        "settings get system peak_refresh_rate": {
          exitCode: 0,
          stderr: "",
          stdout: "120.0\n",
        },
      });

      const result = await checkDisplayRefreshRate(executor, "emulator-5554");
      expect(result.isOk).toBe(false);
      expect(result.remediation).toContain("min_refresh_rate 60.0");
      expect(result.remediation).toContain("peak_refresh_rate 60.0");
    });

    it("reports failure when refresh rate is not 60 or 120 Hz (e.g. 90 Hz)", async () => {
      const executor = createMockExecutor({
        "dumpsys display": {
          exitCode: 0,
          stderr: "",
          stdout: "1080 x 2400, 90.0 fps",
        },
        "settings get system min_refresh_rate": {
          exitCode: 0,
          stderr: "",
          stdout: "null\n",
        },
        "settings get system peak_refresh_rate": {
          exitCode: 0,
          stderr: "",
          stdout: "null\n",
        },
      });

      const result = await checkDisplayRefreshRate(executor, "emulator-5554");
      expect(result.isOk).toBe(false);
      expect(result.message).toContain("90 Hz");
      expect(result.remediation).toContain("settings put system");
    });
  });

  describe("checkMaestroInstalled", () => {
    it("reports ok when maestro is available", async () => {
      const executor = createMockExecutor({
        "maestro --version": {
          exitCode: 0,
          stderr: "",
          stdout: "1.39.0",
        },
      });

      const result = await checkMaestroInstalled(executor);
      expect(result.isOk).toBe(true);
      expect(result.message).toContain("1.39.0");
    });

    it("reports failure with mise install remediation when maestro is missing", async () => {
      const executor = createMockExecutor({});

      const result = await checkMaestroInstalled(executor);
      expect(result.isOk).toBe(false);
      expect(result.remediation).toContain("mise install maestro");
    });
  });

  describe("checkFlashlightInstalled", () => {
    it("reports ok when flashlight is available", async () => {
      const executor = createMockExecutor({
        "flashlight --version": {
          exitCode: 0,
          stderr: "",
          stdout: "0.9.0",
        },
      });

      const result = await checkFlashlightInstalled(executor);
      expect(result.isOk).toBe(true);
      expect(result.message).toContain("0.9.0");
    });

    it("reports failure with mise task remediation when flashlight is missing", async () => {
      const executor = createMockExecutor({});

      const result = await checkFlashlightInstalled(executor);
      expect(result.isOk).toBe(false);
      expect(result.remediation).toContain("mise run flashlight-setup");
    });
  });

  describe("runDoctor", () => {
    it("returns isSuccess=true and exitCode=0 when all checks pass", async () => {
      const executor = createMockExecutor({
        "adb devices": {
          exitCode: 0,
          stderr: "",
          stdout: "List of devices attached\nemulator-5554\tdevice\n",
        },
        "adb version": {
          exitCode: 0,
          stderr: "",
          stdout: "Android Debug Bridge version 1.0.41",
        },
        "dumpsys display": {
          exitCode: 0,
          stderr: "",
          stdout: "60.0 fps",
        },
        "flashlight --version": {
          exitCode: 0,
          stderr: "",
          stdout: "0.9.0",
        },
        "maestro --version": {
          exitCode: 0,
          stderr: "",
          stdout: "1.39.0",
        },
        "settings get system min_refresh_rate": {
          exitCode: 0,
          stderr: "",
          stdout: "60.0",
        },
        "settings get system peak_refresh_rate": {
          exitCode: 0,
          stderr: "",
          stdout: "60.0",
        },
      });

      const reporter = jest.fn();
      const outcome = await runDoctor({ executor, reporter });

      expect(outcome.isSuccess).toBe(true);
      expect(outcome.exitCode).toBe(0);
      expect(outcome.results).toHaveLength(5);
      expect(reporter).toHaveBeenCalled();
    });

    it("returns isSuccess=false and exitCode=1 when any check fails", async () => {
      const executor = createMockExecutor({});

      const reporter = jest.fn();
      const outcome = await runDoctor({ executor, reporter });

      expect(outcome.isSuccess).toBe(false);
      expect(outcome.exitCode).toBe(1);
      expect(reporter).toHaveBeenCalled();
    });
  });
});
