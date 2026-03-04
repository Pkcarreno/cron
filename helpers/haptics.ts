import { Haptics } from 'react-native-nitro-haptics';
import { NitroModules } from 'react-native-nitro-modules';

const boxed = NitroModules.box(Haptics);

export const triggerHapticLight = () => {
  'worklet';
  boxed.unbox().impact('light');
};

export const triggerHapticMedium = () => {
  'worklet';
  boxed.unbox().impact('medium');
};

export const triggerHapticHeavy = () => {
  'worklet';
  boxed.unbox().impact('medium');
};

export const triggerHapticSoft = () => {
  'worklet';
  boxed.unbox().impact('soft');
};

export const triggerHapticSuccess = () => {
  'worklet';
  boxed.unbox().notification('success');
};
