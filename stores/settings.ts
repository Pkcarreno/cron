import { atomWithMMKV } from './storage';

export const isRawTimerAtom = atomWithMMKV<boolean>(
  'settings.isRawTimer',
  false
);

export const preparationTimeMsAtom = atomWithMMKV<number>(
  'settings.preparationTimeMs',
  10_000
);
