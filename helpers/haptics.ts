import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

const isCompatibleAndroid =
  Platform.OS === 'android' &&
  typeof Platform.Version === 'number' &&
  Platform.Version >= 30;

export enum triggerType {
  Impact = 'Impact',
  Notification = 'Notification',
  Selection = 'Selection',
}

type triggerHapticType =
  | {
      type: triggerType.Impact;
      mode: Haptics.ImpactFeedbackStyle;
    }
  | {
      type: triggerType.Notification;
      mode: Haptics.NotificationFeedbackType;
    }
  | {
      type: triggerType.Selection;
    };

export const triggerHaptic = (config: triggerHapticType) => {
  switch (config.type) {
    case triggerType.Impact: {
      Haptics.impactAsync(config.mode);
      break;
    }

    case triggerType.Notification: {
      Haptics.notificationAsync(config.mode);
      break;
    }

    case triggerType.Selection: {
      Haptics.selectionAsync();
      break;
    }

    default: {
      console.error('no trigger found');
    }
  }
};

export const triggerAndroidHaptic = (
  type: Haptics.AndroidHaptics,
  fallback?: triggerHapticType
) => {
  if (isCompatibleAndroid) {
    Haptics.performAndroidHapticsAsync(type);
  } else if (fallback) {
    triggerHaptic(fallback);
  } else {
    console.warn('Haptics: no haptic found to be triggered');
  }
};
