import fs from "node:fs";
import path from "node:path";

import {
  DEFAULT_AUDIO_DIR,
  SAMPLE_RATE,
  applyCosineTaper,
  encodeWav,
  generateSoundPack,
  normalizeAudio,
  removeDcOffset,
  synthesizeCountdownBeep,
  synthesizeFinish,
  synthesizeGo,
  synthesizeRest,
  synthesizeRoundChange,
} from "./generate-sound-pack";

describe("Audio DSP & Sound Pack Generator", () => {
  describe("removeDcOffset", () => {
    it("eliminates DC bias from an audio signal", () => {
      const biasedSignal = new Float32Array([1.5, 2.5, 3.5, 4.5]);
      const centered = removeDcOffset(biasedSignal);

      const mean =
        centered.reduce((sum, val) => sum + val, 0) / centered.length;
      expect(Math.abs(mean)).toBeLessThan(1e-6);
    });
  });

  describe("normalizeAudio", () => {
    it("scales signal peak to target amplitude without clipping", () => {
      const signal = new Float32Array([0.1, -0.5, 0.25]);
      const normalized = normalizeAudio(signal, 0.98);

      let maxPeak = 0;
      for (const sample of normalized) {
        maxPeak = Math.max(maxPeak, Math.abs(sample));
      }

      expect(maxPeak).toBeCloseTo(0.98, 4);
    });

    it("handles zero signal gracefully", () => {
      const signal = new Float32Array([0, 0, 0]);
      const normalized = normalizeAudio(signal, 0.98);
      expect([...normalized]).toEqual([0, 0, 0]);
    });
  });

  describe("applyCosineTaper", () => {
    it("smoothly tapers start and end samples to zero", () => {
      const buffer = new Float32Array(100).fill(1);
      const tapered = applyCosineTaper(buffer, 10);

      expect(tapered[0]).toBeCloseTo(0, 4);
      expect(tapered[10]).toBeCloseTo(1, 4);
      expect(tapered[89]).toBeCloseTo(1, 4);
      expect(tapered[99]).toBeCloseTo(0, 4);
    });
  });

  describe("encodeWav", () => {
    it("produces valid 44-byte RIFF WAVE header for 16-bit mono 44.1kHz audio", () => {
      const sampleCount = 441;
      const samples = new Float32Array(sampleCount).fill(0.5);
      const wavBuffer = encodeWav(samples, SAMPLE_RATE);

      expect(wavBuffer.length).toBe(44 + sampleCount * 2);

      expect(wavBuffer.subarray(0, 4).toString("ascii")).toBe("RIFF");
      expect(wavBuffer.readUInt32LE(4)).toBe(36 + sampleCount * 2);
      expect(wavBuffer.subarray(8, 12).toString("ascii")).toBe("WAVE");

      expect(wavBuffer.subarray(12, 16).toString("ascii")).toBe("fmt ");
      expect(wavBuffer.readUInt32LE(16)).toBe(16);
      expect(wavBuffer.readUInt16LE(20)).toBe(1);
      expect(wavBuffer.readUInt16LE(22)).toBe(1);
      expect(wavBuffer.readUInt32LE(24)).toBe(44_100);
      expect(wavBuffer.readUInt32LE(28)).toBe(88_200);
      expect(wavBuffer.readUInt16LE(32)).toBe(2);
      expect(wavBuffer.readUInt16LE(34)).toBe(16);

      expect(wavBuffer.subarray(36, 40).toString("ascii")).toBe("data");
      expect(wavBuffer.readUInt32LE(40)).toBe(sampleCount * 2);
    });
  });

  describe("Sound Synthesizers", () => {
    it("synthesizes countdown_beep with 120 ms duration and tapered zero boundary", () => {
      const audio = synthesizeCountdownBeep();
      const expectedSampleCount = Math.round(SAMPLE_RATE * 0.12);

      expect(audio.length).toBe(expectedSampleCount);
      const maxPeak = Math.max(...[...audio].map(Math.abs));
      expect(maxPeak).toBeLessThanOrEqual(1);
      expect(audio[0]).toBeCloseTo(0, 4);
      expect(audio.at(-1)).toBeCloseTo(0, 4);
    });

    it("synthesizes go with 700 ms duration and tapered zero boundary", () => {
      const audio = synthesizeGo();
      const expectedSampleCount = Math.round(SAMPLE_RATE * 0.7);

      expect(audio.length).toBe(expectedSampleCount);
      const maxPeak = Math.max(...[...audio].map(Math.abs));
      expect(maxPeak).toBeLessThanOrEqual(1);
      expect(audio[0]).toBeCloseTo(0, 4);
      expect(audio.at(-1)).toBeCloseTo(0, 4);
    });

    it("synthesizes rest with 350 ms duration and tapered zero boundary", () => {
      const audio = synthesizeRest();
      const expectedSampleCount = Math.round(SAMPLE_RATE * 0.35);

      expect(audio.length).toBe(expectedSampleCount);
      const maxPeak = Math.max(...[...audio].map(Math.abs));
      expect(maxPeak).toBeLessThanOrEqual(1);
      expect(audio[0]).toBeCloseTo(0, 4);
      expect(audio.at(-1)).toBeCloseTo(0, 4);
    });

    it("synthesizes round_change with 140 ms dual-chirp duration and clean silence", () => {
      const audio = synthesizeRoundChange();
      const expectedSampleCount = Math.round(SAMPLE_RATE * 0.14);

      expect(audio.length).toBe(expectedSampleCount);
      const maxPeak = Math.max(...[...audio].map(Math.abs));
      expect(maxPeak).toBeLessThanOrEqual(1);

      // Verify 40ms silence region around the midpoint is strictly zero
      const midPoint = Math.floor(audio.length / 2);
      expect(audio[midPoint]).toBe(0);
      expect(audio[midPoint - 100]).toBe(0);
      expect(audio[midPoint + 100]).toBe(0);
    });

    it("synthesizes finish with 1.5 s triple-blast sequence and clean silence pauses", () => {
      const audio = synthesizeFinish();
      const expectedSampleCount = Math.round(SAMPLE_RATE * 1.5);

      expect(audio.length).toBe(expectedSampleCount);
      const maxPeak = Math.max(...[...audio].map(Math.abs));
      expect(maxPeak).toBeLessThanOrEqual(1);

      // Verify silence between blast 1 (200ms) and blast 2 (200ms)
      const pause1Index = Math.round(SAMPLE_RATE * 0.275);
      expect(audio[pause1Index]).toBe(0);
    });
  });

  describe("generateSoundPack", () => {
    const testOutputDir = path.join(
      process.cwd(),
      ".tmp",
      "test-audio-pack",
      "default"
    );

    beforeEach(() => {
      if (fs.existsSync(testOutputDir)) {
        fs.rmSync(testOutputDir, { force: true, recursive: true });
      }
    });

    afterAll(() => {
      if (fs.existsSync(testOutputDir)) {
        fs.rmSync(testOutputDir, { force: true, recursive: true });
      }
    });

    it("generates and writes all 5 canonical wav files with exact duration and headers", async () => {
      const generatedFiles = await generateSoundPack(testOutputDir);

      expect(generatedFiles).toHaveLength(5);
      const fileNames = generatedFiles.map((file) =>
        path.basename(file.filePath)
      );
      expect(fileNames.toSorted()).toEqual([
        "countdown_beep.wav",
        "finish.wav",
        "go.wav",
        "rest.wav",
        "round_change.wav",
      ]);

      const expectedDurationsMs: Record<string, number> = {
        "countdown_beep.wav": 120,
        "finish.wav": 1500,
        "go.wav": 700,
        "rest.wav": 350,
        "round_change.wav": 140,
      };

      for (const item of generatedFiles) {
        expect(fs.existsSync(item.filePath)).toBe(true);
        const fileName = path.basename(item.filePath);
        expect(item.durationMs).toBe(expectedDurationsMs[fileName]);

        const buffer = fs.readFileSync(item.filePath);
        expect(buffer.subarray(0, 4).toString("ascii")).toBe("RIFF");
        expect(buffer.subarray(8, 12).toString("ascii")).toBe("WAVE");
        expect(buffer.readUInt32LE(24)).toBe(44_100);
        expect(buffer.readUInt16LE(22)).toBe(1);
        expect(buffer.readUInt16LE(34)).toBe(16);

        // Header duration check
        const dataBytes = buffer.readUInt32LE(40);
        const sampleCount = dataBytes / 2;
        const durationSec = sampleCount / 44_100;
        expect(Math.round(durationSec * 1000)).toBe(
          expectedDurationsMs[fileName]
        );
      }
    });
  });

  describe("Canonical assets in assets/audio/default/", () => {
    const canonicalFiles = [
      { durationMs: 120, name: "countdown_beep.wav" },
      { durationMs: 700, name: "go.wav" },
      { durationMs: 350, name: "rest.wav" },
      { durationMs: 140, name: "round_change.wav" },
      { durationMs: 1500, name: "finish.wav" },
    ];

    it.each(canonicalFiles)(
      "verifies $name exists with valid RIFF header and exact duration ($durationMs ms)",
      ({ durationMs, name }) => {
        const filePath = path.join(DEFAULT_AUDIO_DIR, name);
        expect(fs.existsSync(filePath)).toBe(true);

        const buffer = fs.readFileSync(filePath);
        expect(buffer.subarray(0, 4).toString("ascii")).toBe("RIFF");
        expect(buffer.subarray(8, 12).toString("ascii")).toBe("WAVE");
        expect(buffer.readUInt32LE(24)).toBe(44_100);
        expect(buffer.readUInt16LE(22)).toBe(1);
        expect(buffer.readUInt16LE(34)).toBe(16);

        const dataBytes = buffer.readUInt32LE(40);
        const sampleCount = dataBytes / 2;
        const actualDurationMs = Math.round((sampleCount / 44_100) * 1000);
        expect(actualDurationMs).toBe(durationMs);
      }
    );
  });
});
