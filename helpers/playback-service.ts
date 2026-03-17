import { isSoundEnabledAtom } from '@/stores/settings';
import { store } from '@/stores/storage';
import type { OscillatorNode } from 'react-native-audio-api';
import { AudioContext } from 'react-native-audio-api';

let audioContext: AudioContext | null = null;
let currentOscillator: OscillatorNode | null = null;
let currentTimeout: ReturnType<typeof setTimeout> | null = null;

let playbackToken = 0;

interface ToneSequenceStep {
  frequencyHz: number;
  durationMs: number;
  silenceAfterMs: number;
}

const getAudioContext = async () => {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  if (audioContext.state === 'suspended') {
    await audioContext.resume();
  }
  return audioContext;
};

const clearPlaybackState = () => {
  if (currentTimeout) {
    clearTimeout(currentTimeout);
    currentTimeout = null;
  }

  if (currentOscillator) {
    try {
      currentOscillator.stop();
      currentOscillator.disconnect();
    } catch (error) {
      console.error(error);
    }
    currentOscillator = null;
  }
};

export const stopAudio = () => {
  playbackToken += 1;
  clearPlaybackState();
};

// oxlint-disable eslint/avoid-new
const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    currentTimeout = setTimeout(resolve, ms);
  });

const createAndStartOscillator = (
  ctx: AudioContext,
  frequencyHz: number,
  durationMs: number
) => {
  const osc = ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.value = frequencyHz;
  osc.connect(ctx.destination);

  const now = ctx.currentTime;
  osc.start(now);
  osc.stop(now + durationMs / 1000);

  return osc;
};

const executeTone = async (
  frequencyHz: number,
  durationMs: number,
  token: number
): Promise<void> => {
  clearPlaybackState();

  const ctx = await getAudioContext();

  if (token !== playbackToken) {
    return;
  }

  currentOscillator = createAndStartOscillator(ctx, frequencyHz, durationMs);

  await delay(durationMs);

  if (token === playbackToken) {
    clearPlaybackState();
  }
};

export const playTone = async (frequencyHz: number, durationMs: number) => {
  if (!store.get(isSoundEnabledAtom)) {
    return;
  }

  stopAudio();
  await executeTone(frequencyHz, durationMs, playbackToken);
};

export const playToneSequence = async (steps: ToneSequenceStep[]) => {
  if (!store.get(isSoundEnabledAtom)) {
    return;
  }

  stopAudio();
  const token = playbackToken;

  for (const step of steps) {
    if (token !== playbackToken) {
      break;
    }

    await executeTone(step.frequencyHz, step.durationMs, token);

    if (token !== playbackToken) {
      break;
    }

    if (step.silenceAfterMs > 0) {
      await delay(step.silenceAfterMs);
    }
  }
};
