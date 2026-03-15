import { useBatteryLevel } from 'expo-battery';

export const useIsLowBattery = () => {
  const batteryLevel = useBatteryLevel();

  return batteryLevel < 0.2;
};
