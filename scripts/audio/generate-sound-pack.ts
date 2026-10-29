import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";

export const SAMPLE_RATE = 44_100;
export const DEFAULT_AUDIO_DIR = path.resolve(
  process.cwd(),
  "assets/audio/default"
);

export interface GeneratedSoundSummary {
  filePath: string;
  durationMs: number;
  sampleCount: number;
  byteSize: number;
  peakDbFs: number;
}

/**
 * Removes direct current (DC) offset by centering the signal on a zero mean.
 * Prevents speaker cone excursion and transducer clicks.
 *
 * @param samples - Float32 audio samples.
 * @returns Centered Float32Array signal.
 */
export const removeDcOffset = (samples: Float32Array): Float32Array => {
  if (samples.length === 0) {
    return new Float32Array(0);
  }

  let sum = 0;
  for (const sample of samples) {
    sum += sample;
  }
  const mean = sum / samples.length;

  const centered = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i += 1) {
    centered[i] = samples[i] - mean;
  }

  return centered;
};

/**
 * Normalizes signal amplitude to target peak level.
 * Guarantees peak amplitude is bounded within <= 0 dBFS.
 *
 * @param samples - Float32 audio samples.
 * @param peakTarget - Target peak absolute amplitude (default: 0.98, ~ -0.18 dBFS).
 * @returns Normalized Float32Array signal.
 */
export const normalizeAudio = (
  samples: Float32Array,
  peakTarget = 0.98
): Float32Array => {
  let peak = 0;
  for (const sample of samples) {
    const absVal = Math.abs(sample);
    if (absVal > peak) {
      peak = absVal;
    }
  }

  if (peak === 0) {
    return new Float32Array(samples);
  }

  const factor = peakTarget / peak;
  const normalized = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i += 1) {
    normalized[i] = samples[i] * factor;
  }

  return normalized;
};

/**
 * Applies a raised cosine (Hann) window taper to the start and end of a signal.
 * Prevents spectral splatter and phase discontinuity clicks on DAC output.
 *
 * @param samples - Float32 audio samples.
 * @param taperSampleCount - Number of samples for fade-in and fade-out.
 * @returns Tapered Float32Array signal.
 */
export const applyCosineTaper = (
  samples: Float32Array,
  taperSampleCount: number
): Float32Array => {
  const tapered = new Float32Array(samples);
  const totalSamples = tapered.length;
  const actualTaper = Math.min(taperSampleCount, Math.floor(totalSamples / 2));

  for (let i = 0; i < actualTaper; i += 1) {
    const window = 0.5 * (1 - Math.cos((Math.PI * i) / actualTaper));
    tapered[i] *= window;
    tapered[totalSamples - 1 - i] *= window;
  }

  return tapered;
};

/**
 * Encodes Float32 audio samples into an uncompressed 16-bit Mono PCM RIFF WAVE buffer.
 *
 * @param samples - Normalized Float32 audio samples.
 * @param sampleRate - Sampling frequency in Hz (default: 44,100 Hz).
 * @returns Node.js Buffer containing valid RIFF WAVE binary data.
 */
export const encodeWav = (
  samples: Float32Array,
  sampleRate = SAMPLE_RATE
): Buffer => {
  const numChannels = 1;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = samples.length * bytesPerSample;
  const headerSize = 44;
  const totalFileSize = headerSize + dataSize;

  const buffer = Buffer.alloc(totalFileSize);

  // RIFF Chunk Descriptor
  buffer.write("RIFF", 0, "ascii");
  buffer.writeUInt32LE(totalFileSize - 8, 4);
  buffer.write("WAVE", 8, "ascii");

  // fmt Subchunk
  buffer.write("fmt ", 12, "ascii");
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);

  // data Subchunk
  buffer.write("data", 36, "ascii");
  buffer.writeUInt32LE(dataSize, 40);

  let offset = 44;
  for (const sample of samples) {
    const clamped = Math.max(-1, Math.min(1, sample));
    const intSample =
      clamped < 0 ? Math.round(clamped * 32_768) : Math.round(clamped * 32_767);
    buffer.writeInt16LE(Math.max(-32_768, Math.min(32_767, intSample)), offset);
    offset += 2;
  }

  return buffer;
};

/**
 * Synthesizes countdown_beep: 120 ms pulse at 2,400 Hz with 2 ms cosine taper.
 * Rich in odd harmonics for high psychoacoustic penetration in noisy gym environments.
 */
export const synthesizeCountdownBeep = (): Float32Array => {
  const durationSec = 0.12;
  const totalSamples = Math.round(SAMPLE_RATE * durationSec);
  const taperSamples = Math.round(SAMPLE_RATE * 0.002);
  const freq = 2400;

  const raw = new Float32Array(totalSamples);
  for (let i = 0; i < totalSamples; i += 1) {
    const t = i / SAMPLE_RATE;
    const tone =
      Math.sin(2 * Math.PI * freq * t) +
      0.35 * Math.sin(2 * Math.PI * (freq * 3) * t) +
      0.15 * Math.sin(2 * Math.PI * (freq * 5) * t) +
      0.05 * Math.sin(2 * Math.PI * (freq * 7) * t);
    raw[i] = Math.tanh(1.3 * tone);
  }

  // Remove DC bias first so taper converges cleanly to exact zero without step discontinuity
  const centered = removeDcOffset(raw);
  const tapered = applyCosineTaper(centered, taperSamples);
  return normalizeAudio(tapered, 0.98);
};

/**
 * Synthesizes go: 700 ms continuous buzzer at 3,200 Hz with odd harmonic saturation.
 * Authoritative, high-energy cue signaling workout start.
 */
export const synthesizeGo = (): Float32Array => {
  const durationSec = 0.7;
  const totalSamples = Math.round(SAMPLE_RATE * durationSec);
  const taperSamples = Math.round(SAMPLE_RATE * 0.002);
  const freq = 3200;

  const raw = new Float32Array(totalSamples);
  for (let i = 0; i < totalSamples; i += 1) {
    const t = i / SAMPLE_RATE;
    const tone =
      Math.sin(2 * Math.PI * freq * t) +
      0.3 * Math.sin(2 * Math.PI * (freq * 3) * t) +
      0.1 * Math.sin(2 * Math.PI * (freq * 5) * t);
    raw[i] = Math.tanh(2.5 * tone);
  }

  // Remove DC bias before tapering to guarantee absolute zero at boundaries
  const centered = removeDcOffset(raw);
  const tapered = applyCosineTaper(centered, taperSamples);
  return normalizeAudio(tapered, 0.98);
};

/**
 * Synthesizes rest: 350 ms descending two-stage tone (1,200 Hz to 800 Hz).
 * Clear psychoacoustic transition indicating cessation of effort.
 */
export const synthesizeRest = (): Float32Array => {
  const durationSec = 0.35;
  const totalSamples = Math.round(SAMPLE_RATE * durationSec);
  const taperSamples = Math.round(SAMPLE_RATE * 0.002);

  const raw = new Float32Array(totalSamples);
  let phase = 0;

  for (let i = 0; i < totalSamples; i += 1) {
    const t = i / SAMPLE_RATE;
    let currentFreq: number;
    if (t < 0.165) {
      currentFreq = 1200;
    } else if (t > 0.185) {
      currentFreq = 800;
    } else {
      const u = (t - 0.165) / 0.02;
      const smoothGlide = 0.5 * (1 - Math.cos(Math.PI * u));
      currentFreq = 1200 - 400 * smoothGlide;
    }

    phase += (2 * Math.PI * currentFreq) / SAMPLE_RATE;
    const tone = Math.sin(phase) + 0.25 * Math.sin(3 * phase);
    raw[i] = Math.tanh(1.2 * tone);
  }

  // Center prior to taper to preserve zeroed boundaries
  const centered = removeDcOffset(raw);
  const tapered = applyCosineTaper(centered, taperSamples);
  return normalizeAudio(tapered, 0.98);
};

/**
 * Synthesizes round_change: 140 ms dual-chirp at 2,800 Hz (50 ms tone + 40 ms silence + 50 ms tone).
 * Distinct metric marker for interval progression without breaking pacing.
 */
export const synthesizeRoundChange = (): Float32Array => {
  const toneDurationSec = 0.05;
  const silenceDurationSec = 0.04;
  const toneSamples = Math.round(SAMPLE_RATE * toneDurationSec);
  const silenceSamples = Math.round(SAMPLE_RATE * silenceDurationSec);
  const totalSamples = toneSamples * 2 + silenceSamples;
  const taperSamples = Math.round(SAMPLE_RATE * 0.002);
  const freq = 2800;

  const singleChirp = new Float32Array(toneSamples);
  for (let i = 0; i < toneSamples; i += 1) {
    const t = i / SAMPLE_RATE;
    const tone =
      Math.sin(2 * Math.PI * freq * t) +
      0.3 * Math.sin(2 * Math.PI * (freq * 3) * t);
    singleChirp[i] = Math.tanh(1.5 * tone);
  }

  // Remove DC bias and taper individual chirp burst so silence remains strictly zero
  const centeredChirp = removeDcOffset(singleChirp);
  const taperedChirp = applyCosineTaper(centeredChirp, taperSamples);
  const normalizedChirp = normalizeAudio(taperedChirp, 0.98);

  const buffer = new Float32Array(totalSamples);
  buffer.set(normalizedChirp, 0);
  buffer.set(normalizedChirp, toneSamples + silenceSamples);

  return buffer;
};

/**
 * Synthesizes finish: 1.5 s triple-blast sequence (200 ms - 200 ms - 800 ms) at 3,200 Hz.
 * Industrial finish fanfare marking workout completion.
 */
export const synthesizeFinish = (): Float32Array => {
  const blast1Samples = Math.round(SAMPLE_RATE * 0.2);
  const pause1Samples = Math.round(SAMPLE_RATE * 0.15);
  const blast2Samples = Math.round(SAMPLE_RATE * 0.2);
  const pause2Samples = Math.round(SAMPLE_RATE * 0.15);
  const blast3Samples = Math.round(SAMPLE_RATE * 0.8);
  const totalSamples =
    blast1Samples +
    pause1Samples +
    blast2Samples +
    pause2Samples +
    blast3Samples;
  const taperSamples = Math.round(SAMPLE_RATE * 0.002);
  const freq = 3200;

  const createBlast = (length: number): Float32Array => {
    const blast = new Float32Array(length);
    for (let i = 0; i < length; i += 1) {
      const t = i / SAMPLE_RATE;
      const tone =
        Math.sin(2 * Math.PI * freq * t) +
        0.35 * Math.sin(2 * Math.PI * (freq * 3) * t) +
        0.15 * Math.sin(2 * Math.PI * (freq * 5) * t);
      blast[i] = Math.tanh(2.2 * tone);
    }
    const centeredBlast = removeDcOffset(blast);
    const taperedBlast = applyCosineTaper(centeredBlast, taperSamples);
    return normalizeAudio(taperedBlast, 0.98);
  };

  const buffer = new Float32Array(totalSamples);
  let offset = 0;

  buffer.set(createBlast(blast1Samples), offset);
  offset += blast1Samples + pause1Samples;

  buffer.set(createBlast(blast2Samples), offset);
  offset += blast2Samples + pause2Samples;

  buffer.set(createBlast(blast3Samples), offset);

  return buffer;
};

/**
 * Generates the canonical sound pack of 5 uncompressed 16-bit Mono PCM .wav files at 44.1 kHz.
 *
 * @param outputDir - Destination directory (default: assets/audio/default).
 * @returns Array of metadata for each generated asset.
 */
export const generateSoundPack = async (
  outputDir = DEFAULT_AUDIO_DIR
): Promise<GeneratedSoundSummary[]> => {
  if (!existsSync(outputDir)) {
    await fs.mkdir(outputDir, { recursive: true });
  }

  const assetDefinitions: {
    fileName: string;
    synthesizer: () => Float32Array;
  }[] = [
    {
      fileName: "countdown_beep.wav",
      synthesizer: synthesizeCountdownBeep,
    },
    {
      fileName: "go.wav",
      synthesizer: synthesizeGo,
    },
    {
      fileName: "rest.wav",
      synthesizer: synthesizeRest,
    },
    {
      fileName: "round_change.wav",
      synthesizer: synthesizeRoundChange,
    },
    {
      fileName: "finish.wav",
      synthesizer: synthesizeFinish,
    },
  ];

  return Promise.all(
    assetDefinitions.map(async (asset) => {
      const samples = asset.synthesizer();
      const wavBuffer = encodeWav(samples, SAMPLE_RATE);
      const targetPath = path.join(outputDir, asset.fileName);

      await fs.writeFile(targetPath, wavBuffer);

      let maxPeak = 0;
      for (const sample of samples) {
        const absVal = Math.abs(sample);
        if (absVal > maxPeak) {
          maxPeak = absVal;
        }
      }

      const peakDbFs = maxPeak > 0 ? 20 * Math.log10(maxPeak) : -Infinity;

      return {
        byteSize: wavBuffer.length,
        durationMs: Math.round((samples.length / SAMPLE_RATE) * 1000),
        filePath: targetPath,
        peakDbFs,
        sampleCount: samples.length,
      };
    })
  );
};

const isDirectScriptExecution = (): boolean => {
  const scriptFilename =
    import.meta !== undefined && import.meta.filename
      ? import.meta.filename
      : null;
  if (!scriptFilename || !process.argv[1]) {
    return false;
  }
  return path.resolve(scriptFilename) === path.resolve(process.argv[1]);
};

if (isDirectScriptExecution()) {
  void (async () => {
    try {
      console.log("Synthesizing canonical HIIT audio sound pack...");
      const summaries = await generateSoundPack();
      console.log(
        `Generated ${summaries.length} audio assets in ${DEFAULT_AUDIO_DIR}:`
      );
      for (const item of summaries) {
        console.log(
          `  - ${path.basename(item.filePath)}: ${item.durationMs}ms, ${item.sampleCount} samples, ${item.byteSize} bytes, peak ${item.peakDbFs.toFixed(2)} dBFS`
        );
      }
    } catch (error) {
      console.error("Audio generation failed:", error);
      process.exit(1);
    }
  })();
}
