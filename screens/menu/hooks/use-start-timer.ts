import { useRouter } from "expo-router";
import { useAtomValue, useStore } from "jotai";
import { useCallback } from "react";

import { serializeTimerConfig } from "@/helpers/timer/utils/config-serializer";
import { isRawTimerEnabledAtom } from "@/stores/settings";
import {
  activeTimerConfigAtom,
  isCurrentTimerValidAtom,
} from "@/stores/workout";

/**
 * Triggers timer navigation with active workout configuration.
 * Reads store values imperatively on press to avoid re-renders during input edits.
 */
export const useStartTimer = () => {
  const router = useRouter();
  const isRawTimerEnabled = useAtomValue(isRawTimerEnabledAtom);
  const store = useStore();

  return useCallback(() => {
    const isValid = store.get(isCurrentTimerValidAtom);
    if (!isValid) {
      return;
    }
    const config = store.get(activeTimerConfigAtom);
    router.push({
      params: serializeTimerConfig(config),
      pathname: isRawTimerEnabled ? "/timer/inspector" : "/timer",
    });
  }, [isRawTimerEnabled, router, store]);
};
