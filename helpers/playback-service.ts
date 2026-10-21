import type { ToneSequenceStep } from "@/services/audio/web-audio-oscillator-service";
import { WebAudioOscillatorService } from "@/services/audio/web-audio-oscillator-service";
import { isSoundEnabledAtom } from "@/stores/settings";
import { store } from "@/stores/storage";

const defaultOscillatorService = new WebAudioOscillatorService({
  isSoundEnabled: () => store.get(isSoundEnabledAtom),
});

export const stopAudio = (): void => {
  defaultOscillatorService.stopAudio();
};

export const playTone = async (
  frequencyHz: number,
  durationMs: number
): Promise<void> => {
  await defaultOscillatorService.playTone(frequencyHz, durationMs);
};

export const playToneSequence = async (
  steps: ToneSequenceStep[]
): Promise<void> => {
  await defaultOscillatorService.playToneSequence(steps);
};
