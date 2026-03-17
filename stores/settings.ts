import { atomWithMMKV } from './storage';

export const isRawTimerEnabledAtom = atomWithMMKV<boolean>(
  'settings.isRawTimerEnabled',
  false
);

export const preparationTimeMsAtom = atomWithMMKV<number>(
  'settings.preparationTimeMs',
  10_000
);
