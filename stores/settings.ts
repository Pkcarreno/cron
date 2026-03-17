import { atomWithMMKV } from './storage';

export const isRawTimerEnabledAtom = atomWithMMKV<boolean>(
  'settings.isRawTimerEnabled',
  false
);

export const hasHapticEnabledAtom = atomWithMMKV<boolean>(
  'settings.hasHapticEnabled',
  true
);

export const isSoundEnabledAtom = atomWithMMKV<boolean>(
  'settings.isSoundEnabled',
  true
);

export const preparationTimeMsAtom = atomWithMMKV<number>(
  'settings.preparationTimeMs',
  10_000
);
