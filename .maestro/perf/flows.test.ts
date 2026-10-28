import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { parseAllDocuments } from "yaml";

const ROOT_DIR = process.cwd();
const MAESTRO_DIR = path.resolve(ROOT_DIR, ".maestro");
const PERF_DIR = path.resolve(MAESTRO_DIR, "perf");
const SCRIPTS_DIR = path.resolve(MAESTRO_DIR, "scripts");

const THUMBWHEEL_FLOW = path.resolve(PERF_DIR, "thumbwheel-scroll.yaml");
const MENU_TABS_FLOW = path.resolve(PERF_DIR, "menu-tabs-swipe.yaml");
const TIMER_WORKOUT_FLOW = path.resolve(PERF_DIR, "timer-workout-run.yaml");
const SLEEP_SCRIPT = path.resolve(SCRIPTS_DIR, "sleep.js");

const ALL_FLOWS = [
  { name: "thumbwheel-scroll", path: THUMBWHEEL_FLOW },
  { name: "menu-tabs-swipe", path: MENU_TABS_FLOW },
  { name: "timer-workout-run", path: TIMER_WORKOUT_FLOW },
];

/**
 * Detects whether the Maestro CLI executable is available in the host environment.
 * Prevents CI failure when running in headless environments lacking the Maestro binary.
 */
const hasMaestroCli = (): boolean => {
  try {
    const result = spawnSync("maestro", ["--version"], {
      encoding: "utf-8",
      stdio: "ignore",
    });
    return result.status === 0 && !result.error;
  } catch {
    return false;
  }
};

describe("Maestro Performance Benchmark Flows", () => {
  describe("file existence", () => {
    it.each(ALL_FLOWS)("contains $name flow file", ({ path: flowPath }) => {
      expect(fs.existsSync(flowPath)).toBe(true);
    });

    it("contains the sleep script helper", () => {
      expect(fs.existsSync(SLEEP_SCRIPT)).toBe(true);
    });
  });

  describe("sleep script helper (.maestro/scripts/sleep.js)", () => {
    it("provides cross-engine settling sleep with thread sleep and fallback", () => {
      const content = fs.readFileSync(SLEEP_SCRIPT, "utf-8");
      expect(content).toMatch(/durationMs/u);
      expect(content).toMatch(/Thread\.sleep/u);
      expect(content).toMatch(/Date\.now\(\)/u);
      expect(content).toMatch(/while\s*\(/u);
    });
  });

  describe("yaml structure and schema validation", () => {
    it.each(ALL_FLOWS)(
      "parses $name flow without syntax errors",
      ({ path: flowPath }) => {
        const content = fs.readFileSync(flowPath, "utf-8");
        const documents = parseAllDocuments(content);
        expect(documents.length).toBeGreaterThanOrEqual(2);
        for (const doc of documents) {
          expect(doc.errors).toHaveLength(0);
        }
      }
    );

    it.each(ALL_FLOWS)(
      "defines appId: com.pkcarreno.cron.preview for $name flow",
      ({ path: flowPath }) => {
        const content = fs.readFileSync(flowPath, "utf-8");
        const documents = parseAllDocuments(content);
        const header = documents[0]?.toJSON() as { appId?: string };
        expect(header?.appId).toMatch(
          /\$\{APP_ID:-com\.pkcarreno\.cron\.preview\}|com\.pkcarreno\.cron\.preview/u
        );
      }
    );
  });

  describe("maestro syntax check", () => {
    const isMaestroAvailable = hasMaestroCli();

    it.each(ALL_FLOWS)(
      "passes `maestro check-syntax` on $name flow when CLI is present",
      ({ name, path: flowPath }) => {
        if (!isMaestroAvailable) {
          console.info(
            `Skipping \`maestro check-syntax\` for ${name}: Maestro CLI is not installed in the environment.`
          );
          return;
        }

        const result = spawnSync("maestro", ["check-syntax", flowPath], {
          encoding: "utf-8",
        });

        expect(result.status).toBe(0);
        expect(result.error).toBeUndefined();
      }
    );
  });

  describe("flow specifications", () => {
    describe("thumbwheel-scroll.yaml", () => {
      it("defines explicit percentage coordinates, animation completion, and settling checks", () => {
        const content = fs.readFileSync(THUMBWHEEL_FLOW, "utf-8");
        const documents = parseAllDocuments(content);
        const steps = documents[1]?.toJSON() as (
          | Record<string, unknown>
          | string
        )[];

        expect(steps).toBeDefined();

        const serialized = JSON.stringify(steps);
        expect(serialized).toContain("input-number-trigger");
        expect(serialized).toContain("thumbwheel-picker");
        expect(serialized).toContain("number-picker-save-button");

        // Percentage coordinates with matching horizontal Y coordinates (75%)
        const swipeSteps = steps.filter(
          (step): step is Record<string, unknown> =>
            typeof step === "object" && step !== null && "swipe" in step
        );
        expect(swipeSteps).toHaveLength(2);
        for (const step of swipeSteps) {
          const swipe = step.swipe as {
            duration: number;
            end: string;
            start: string;
          };
          expect(swipe.start).toMatch(/[0-9]+%,\s*75%/u);
          expect(swipe.end).toMatch(/[0-9]+%,\s*75%/u);
          expect(swipe.duration).toBe(800);
        }

        // Animation stabilization ensuring Reanimated decay concludes before settling
        const waitAnimationSteps = steps.filter(
          (step) =>
            step === "waitForAnimationToEnd" ||
            (typeof step === "object" &&
              step !== null &&
              "waitForAnimationToEnd" in step)
        );
        expect(waitAnimationSteps).toHaveLength(2);

        // Settling checks using sleep.js
        const settlingSteps = steps.filter((step) => {
          if (
            typeof step !== "object" ||
            step === null ||
            !("runScript" in step)
          ) {
            return false;
          }
          const runScript = step.runScript as {
            env?: { durationMs?: number };
            file?: string;
          };
          return (
            runScript.file?.includes("sleep.js") &&
            runScript.env?.durationMs === 1000
          );
        });
        expect(settlingSteps).toHaveLength(2);
      });
    });

    describe("menu-tabs-swipe.yaml", () => {
      it("defines forward tab navigation across 5 workout modes with animation stabilization and settling", () => {
        const content = fs.readFileSync(MENU_TABS_FLOW, "utf-8");
        const documents = parseAllDocuments(content);
        const steps = documents[1]?.toJSON() as (
          | Record<string, unknown>
          | string
        )[];

        expect(steps).toBeDefined();

        // Exactly 4 forward transitions across the 5 modes without reverse duplication
        const swipeSteps = steps.filter(
          (step): step is Record<string, unknown> =>
            typeof step === "object" && step !== null && "swipe" in step
        );
        expect(swipeSteps).toHaveLength(4);

        for (const step of swipeSteps) {
          const swipe = step.swipe as {
            duration: number;
            end: string;
            start: string;
          };
          expect(swipe.start).toBe("85%, 50%");
          expect(swipe.end).toBe("15%, 50%");
          expect(swipe.duration).toBe(600);
        }

        // Animation stabilization between each transition
        const waitAnimationSteps = steps.filter(
          (step) =>
            step === "waitForAnimationToEnd" ||
            (typeof step === "object" &&
              step !== null &&
              "waitForAnimationToEnd" in step)
        );
        expect(waitAnimationSteps).toHaveLength(4);

        // Settling sleep (500ms) between transitions
        const settlingSteps = steps.filter((step) => {
          if (
            typeof step !== "object" ||
            step === null ||
            !("runScript" in step)
          ) {
            return false;
          }
          const runScript = step.runScript as {
            env?: { durationMs?: number };
            file?: string;
          };
          return (
            runScript.file?.includes("sleep.js") &&
            runScript.env?.durationMs === 500
          );
        });
        expect(settlingSteps).toHaveLength(4);
      });
    });

    describe("timer-workout-run.yaml", () => {
      it("starts interval workout, waits for active WORK phase, and records 15s execution", () => {
        const content = fs.readFileSync(TIMER_WORKOUT_FLOW, "utf-8");
        const documents = parseAllDocuments(content);
        const steps = documents[1]?.toJSON() as (
          | Record<string, unknown>
          | string
        )[];

        expect(steps).toBeDefined();

        const serialized = JSON.stringify(steps);
        expect(serialized).toContain("menu-tab-INTERVAL");
        expect(serialized).toContain("start-timer-button");
        expect(serialized).toContain("timer-screen");

        // Asserts preparation countdown completes and active WORK phase begins
        const workAssertStep = steps.find(
          (step) =>
            typeof step === "object" &&
            step !== null &&
            "assertVisible" in step &&
            step.assertVisible === "WORK"
        );
        expect(workAssertStep).toBeDefined();

        // Records 15 seconds (15000ms) of active interval execution
        const recordingStep = steps.find((step) => {
          if (
            typeof step !== "object" ||
            step === null ||
            !("runScript" in step)
          ) {
            return false;
          }
          const runScript = step.runScript as {
            env?: { durationMs?: number };
            file?: string;
          };
          return (
            runScript.file?.includes("sleep.js") &&
            runScript.env?.durationMs === 15_000
          );
        });
        expect(recordingStep).toBeDefined();
      });
    });
  });
});
